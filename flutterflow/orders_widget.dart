// Automatic FlutterFlow imports
// ---- Two boilerplate imports are deliberately absent ----
//
// FlutterFlow's generated header normally opens with
//
//     import '/backend/backend.dart';
//     import '/backend/supabase/supabase.dart';
//
// and this project has neither file. See the note at the head of
// checkout_widget.dart — adding them back breaks the web build in every
// custom widget at once. Do not add them back.
import '/flutter_flow/flutter_flow_theme.dart';
import '/flutter_flow/flutter_flow_util.dart';
import '/custom_code/widgets/index.dart'; // Imports other custom widgets
import '/flutter_flow/custom_functions.dart'; // Imports custom functions
import 'package:flutter/material.dart';
// Begin custom widget code
// DO NOT REMOVE OR MODIFY THE CODE ABOVE!

import 'dart:convert';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import 'package:url_launcher/url_launcher.dart';

// ============================================================
//  KANDI — MY ORDERS
//
//  Sibling of cart_widget.dart, checkout_widget.dart and
//  account_widget.dart. Same brand, same type, same API base.
//
//  WHAT THIS REPLACES
//  -----------------------------------------------------------
//  A bottom sheet in the account screen that listed orders and
//  did nothing else. A sheet is the right shape for a setting
//  and the wrong one for a record you come back to: it caps at
//  the height of a modal, it cannot hold a detail view without
//  stacking a second sheet on top of itself, and it has nowhere
//  to put the one action a shopper actually wants from an order
//  they already placed, which is to place it again.
//
//  WHAT A SHOPPER DOES HERE
//  -----------------------------------------------------------
//    • See every order, newest first, filtered by what is still
//      happening rather than by WooCommerce's internal statuses.
//    • Open one and see what was in it, what it cost, where it
//      got to.
//    • REORDER — the whole reason this screen earns its place in
//      a shop selling consumables and staples. One tap puts the
//      lines back in the basket.
//    • Track, or ask about it, without retyping the number.
//
//  REORDER IS A CART WRITE, NOT AN API CALL
//  -----------------------------------------------------------
//  There is no "reorder" endpoint and there should not be one.
//  Prices move, stock runs out, and a server-side reorder would
//  either resurrect last month's price or fail the whole basket
//  over one discontinued line. Writing the lines into the local
//  basket instead means the cart screen re-prices every one of
//  them against live stock on its next load, exactly as it does
//  for anything else — so a reorder behaves like adding the
//  items by hand, because that is what it is.
// ============================================================

const String _kApiBaseUrl = 'https://kandiug.com';

// ---- Brand ----
const Color _kOrange = Color(0xFFFF6A00);
const Color _kInk = Color(0xFF111827);
const Color _kBody = Color(0xFF4B5563);
const Color _kMuted = Color(0xFF6B7280);
const Color _kFaint = Color(0xFF9CA3AF);
const Color _kLine = Color(0xFFE5E7EB);
const Color _kSurface = Color(0xFFF3F4F6);
const Color _kGreen = Color(0xFF16A34A);
const Color _kBlue = Color(0xFF2563EB);
const Color _kRed = Color(0xFFE53935);

/// See the note in checkout_widget.dart — the optimiser picks its format from
/// the request, and Dart's client sends no `Accept` at all without this.
const Map<String, String> _kImageHeaders = <String, String>{
  'Accept': 'image/webp,image/*;q=0.8',
};

TextStyle _type({
  double size = 14,
  FontWeight weight = FontWeight.w400,
  Color color = _kInk,
  double height = 1.35,
}) {
  return GoogleFonts.inter(
    fontSize: size,
    fontWeight: weight,
    color: color,
    height: height,
  );
}

String _ugx(num value) {
  final whole = value.round().toString();
  final buffer = StringBuffer();
  for (var i = 0; i < whole.length; i++) {
    if (i > 0 && (whole.length - i) % 3 == 0) buffer.write(',');
    buffer.write(whole[i]);
  }
  return 'UGX ${buffer.toString()}';
}

/// WooCommerce statuses in the words a shopper would use.
///
/// The same map the website keeps in `lib/account.ts`, and it has to stay the
/// same map: an order reading "Being prepared" on the phone and "processing" on
/// the web is one order that looks like two.
const Map<String, String> _kStatusLabel = <String, String>{
  'pending': 'Awaiting payment',
  'processing': 'Being prepared',
  'on-hold': 'On hold',
  'completed': 'Delivered',
  'cancelled': 'Cancelled',
  'refunded': 'Refunded',
  'failed': 'Failed',
};

Color _statusColour(String status) {
  switch (status) {
    case 'completed':
      return _kGreen;
    case 'processing':
      return _kBlue;
    case 'cancelled':
    case 'failed':
      return _kRed;
    case 'refunded':
      return const Color(0xFF7C3AED);
    default:
      return _kMuted;
  }
}

/// Statuses where the order is still going somewhere.
///
/// Drives the "Active" filter, and it is defined as a set rather than as "not
/// completed" on purpose: `refunded` and `failed` are also not completed, and
/// neither belongs in a tab a shopper opens to see what is on its way.
const Set<String> _kActive = <String>{'pending', 'processing', 'on-hold'};

String _prettyDate(String? iso) {
  if (iso == null || iso.isEmpty) return '';
  final parsed = DateTime.tryParse(iso);
  if (parsed == null) return '';
  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];
  return '${parsed.day} ${months[parsed.month - 1]} ${parsed.year}';
}

// ============================================================
//  SESSION + CART, read from the keys their owners define
// ============================================================

/// The shopper's bearer token.
///
/// A private reader over the key `auth_widget.dart` owns, in the same pattern
/// every other screen here uses: a top-level class cannot cross a FlutterFlow
/// file boundary, so the STORAGE KEY is the contract and each file carries its
/// own reader. Change the key there and it changes here.
class _Session {
  _Session._();

  static const String _kToken = 'kandi_auth_token';
  static const String _kExpires = 'kandi_auth_expires';

  static Future<String?> token() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final expires = prefs.getInt(_kExpires) ?? 0;
      if (expires > 0 && DateTime.now().millisecondsSinceEpoch > expires) {
        return null;
      }
      final token = prefs.getString(_kToken);
      return (token == null || token.isEmpty) ? null : token;
    } catch (_) {
      return null;
    }
  }
}

/// Writing reordered lines into the basket.
///
/// Same key and same JSON shape as `cart_widget.dart` — see the note at the
/// head of this file on why a reorder is a local cart write rather than a
/// server call.
class _Cart {
  _Cart._();

  static const String storageKey = 'kandi-cart-v2';

  /// The identity of a basket line. Copied from `cart_widget.dart`, because two
  /// files disagreeing about what makes a line unique is how you get the same
  /// product added twice instead of its quantity going up.
  static String lineKey(int productId, Map<String, String> options) {
    if (options.isEmpty) return '$productId';
    final parts = options.entries.map((e) => '${e.key}=${e.value}').toList()
      ..sort();
    return '$productId|${parts.join('|')}';
  }

  /// Merges lines into the saved basket and returns how many were added.
  ///
  /// MERGED, not replaced. A shopper who reorders while already holding a
  /// basket must not lose it — and one who reorders the same thing twice should
  /// see quantity 2, not a second identical row.
  static Future<int> add(List<Map<String, dynamic>> lines) async {
    if (lines.isEmpty) return 0;
    try {
      final prefs = await SharedPreferences.getInstance();

      final existing = <Map<String, dynamic>>[];
      final raw = prefs.getString(storageKey);
      if (raw != null && raw.trim().isNotEmpty) {
        final decoded = jsonDecode(raw);
        if (decoded is List) {
          existing.addAll(
            decoded.whereType<Map>().map((e) => Map<String, dynamic>.from(e)),
          );
        }
      }

      final byKey = <String, Map<String, dynamic>>{
        for (final line in existing) (line['key'] ?? '').toString(): line,
      };

      for (final line in lines) {
        final key = (line['key'] ?? '').toString();
        final current = byKey[key];
        if (current == null) {
          byKey[key] = line;
        } else {
          final have = current['quantity'];
          final more = line['quantity'];
          current['quantity'] =
              (have is num ? have.toInt() : 1) + (more is num ? more.toInt() : 1);
        }
      }

      await prefs.setString(storageKey, jsonEncode(byKey.values.toList()));
      return lines.length;
    } catch (_) {
      return 0;
    }
  }
}

// ============================================================
//  THE SCREEN
// ============================================================

class KandiOrdersPage extends StatefulWidget {
  const KandiOrdersPage({super.key, this.width, this.height});

  final double? width;
  final double? height;

  /// The one symbol FlutterFlow exports from this file.
  static Future<void> open(BuildContext context) {
    return Navigator.of(context).push(
      MaterialPageRoute<void>(builder: (_) => const KandiOrdersPage()),
    );
  }

  @override
  State<KandiOrdersPage> createState() => _KandiOrdersPageState();
}

enum _Filter { all, active, delivered }

class _KandiOrdersPageState extends State<KandiOrdersPage> {
  List<Map<String, dynamic>> _orders = <Map<String, dynamic>>[];
  bool _loading = true;
  String? _error;
  _Filter _filter = _Filter.all;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    if (mounted) setState(() => _error = null);

    final token = await _Session.token();
    if (token == null) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = 'Sign in to see your orders.';
      });
      return;
    }

    try {
      final response = await http.get(
        Uri.parse('$_kApiBaseUrl/api/app/account/orders'),
        headers: {
          'Authorization': 'Bearer $token',
          'Accept': 'application/json',
        },
      ).timeout(const Duration(seconds: 25));

      if (!mounted) return;
      final decoded = jsonDecode(response.body);

      if (response.statusCode != 200) {
        setState(() {
          _loading = false;
          _error = (decoded is Map && decoded['message'] is String)
              ? decoded['message'] as String
              : 'Could not load your orders.';
        });
        return;
      }

      // The payload is either a bare list or `{orders: [...]}` depending on the
      // WordPress version. Accepting both costs one line and saves a support
      // ticket on every install that is a plugin release behind.
      final list = decoded is Map ? decoded['orders'] : decoded;
      setState(() {
        _loading = false;
        _orders = list is List
            ? list
                .whereType<Map>()
                .map((o) => Map<String, dynamic>.from(o))
                .toList()
            : <Map<String, dynamic>>[];
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = 'Could not reach Kandi. Check your connection.';
      });
    }
  }

  List<Map<String, dynamic>> get _visible {
    switch (_filter) {
      case _Filter.active:
        return _orders
            .where((o) => _kActive.contains((o['status'] ?? '').toString()))
            .toList();
      case _Filter.delivered:
        return _orders
            .where((o) => (o['status'] ?? '').toString() == 'completed')
            .toList();
      case _Filter.all:
        return _orders;
    }
  }

  /// Puts an order's lines back in the basket.
  ///
  /// Everything it knows comes from the order itself — no lookup, no price
  /// check. That is deliberate: the cart re-prices every line against live
  /// stock when it loads, so checking here would be a second opinion that the
  /// next screen immediately overrules, and a slower one.
  Future<void> _reorder(Map<String, dynamic> order) async {
    final items = order['items'];
    if (items is! List || items.isEmpty) return;

    HapticFeedback.mediumImpact();

    final lines = <Map<String, dynamic>>[];
    for (final entry in items) {
      if (entry is! Map) continue;
      final id = entry['product_id'];
      if (id is! num || id <= 0) continue;

      final quantity =
          entry['quantity'] is num ? (entry['quantity'] as num).toInt() : 1;
      final total = entry['total'] is num ? (entry['total'] as num).toDouble() : 0;

      lines.add(<String, dynamic>{
        'key': _Cart.lineKey(id.toInt(), const <String, String>{}),
        'productId': id.toInt(),
        'name': (entry['name'] ?? 'Product').toString(),
        // The order stores the LINE total, so the unit price is that over the
        // quantity. It is a starting figure only — the cart replaces it with
        // today's price on the next load, which is the whole point of not
        // reordering server-side.
        'price': quantity > 0 ? total / quantity : total,
        'image': (entry['image'] ?? '').toString(),
        'slug': '',
        'quantity': quantity,
      });
    }

    final added = await _Cart.add(lines);
    if (!mounted) return;

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          added == 0
              ? 'Nothing from this order could be added.'
              : added == 1
                  ? '1 item added to your basket'
                  : '$added items added to your basket',
          style: _type(size: 14, color: Colors.white),
        ),
        backgroundColor: _kInk,
        behavior: SnackBarBehavior.floating,
        duration: const Duration(seconds: 3),
      ),
    );
  }

  Future<void> _openWeb(String path) async {
    final uri = Uri.parse('$_kApiBaseUrl$path');
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: _kSurface,
      appBar: AppBar(
        backgroundColor: Colors.white,
        surfaceTintColor: Colors.white,
        elevation: 0,
        scrolledUnderElevation: 0,
        leading: IconButton(
          onPressed: () => Navigator.of(context).maybePop(),
          icon: const Icon(Icons.arrow_back, color: _kInk, size: 22),
        ),
        title: Text('My orders', style: _type(size: 17, weight: FontWeight.w700)),
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(49),
          child: Container(
            color: Colors.white,
            padding: const EdgeInsets.fromLTRB(12, 0, 12, 10),
            child: Row(
              children: [
                _chip('All', _Filter.all),
                const SizedBox(width: 8),
                _chip('Active', _Filter.active),
                const SizedBox(width: 8),
                _chip('Delivered', _Filter.delivered),
              ],
            ),
          ),
        ),
      ),
      body: _loading
          ? const Center(
              child: CircularProgressIndicator(color: _kOrange, strokeWidth: 2))
          : _error != null
              ? _errorView()
              : _visible.isEmpty
                  ? _emptyView()
                  : RefreshIndicator(
                      color: _kOrange,
                      onRefresh: _load,
                      child: ListView.separated(
                        padding: const EdgeInsets.fromLTRB(14, 14, 14, 28),
                        itemCount: _visible.length,
                        separatorBuilder: (_, __) => const SizedBox(height: 12),
                        itemBuilder: (_, index) => _orderCard(_visible[index]),
                      ),
                    ),
    );
  }

  Widget _chip(String label, _Filter value) {
    final on = _filter == value;
    return GestureDetector(
      onTap: () => setState(() => _filter = value),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 15, vertical: 8),
        decoration: BoxDecoration(
          color: on ? _kInk : _kSurface,
          borderRadius: BorderRadius.circular(20),
        ),
        child: Text(
          label,
          style: _type(
            size: 13,
            weight: FontWeight.w600,
            color: on ? Colors.white : _kBody,
          ),
        ),
      ),
    );
  }

  Widget _orderCard(Map<String, dynamic> order) {
    final status = (order['status'] ?? '').toString();
    final items = (order['items'] is List) ? order['items'] as List : const [];
    final total = order['total'] is num ? order['total'] as num : 0;
    final colour = _statusColour(status);

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
      ),
      padding: const EdgeInsets.all(14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Order #${(order['number'] ?? order['id'] ?? '')}',
                        style: _type(size: 15, weight: FontWeight.w700)),
                    const SizedBox(height: 2),
                    Text(_prettyDate(order['date']?.toString()),
                        style: _type(size: 12.5, color: _kMuted)),
                  ],
                ),
              ),
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                decoration: BoxDecoration(
                  color: colour.withOpacity(0.10),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  _kStatusLabel[status] ?? status,
                  style: _type(
                      size: 11.5, weight: FontWeight.w700, color: colour),
                ),
              ),
            ],
          ),

          const SizedBox(height: 12),

          // The photographs, not a line count. "3 items" is a number; three
          // thumbnails are the order, and a shopper scanning for the one they
          // want to reorder recognises it by sight long before they read it.
          SizedBox(
            height: 54,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              itemCount: items.length,
              separatorBuilder: (_, __) => const SizedBox(width: 8),
              itemBuilder: (_, index) {
                final item = items[index];
                final image =
                    (item is Map ? (item['image'] ?? '') : '').toString();
                return ClipRRect(
                  borderRadius: BorderRadius.circular(9),
                  child: Container(
                    width: 54,
                    height: 54,
                    color: _kSurface,
                    child: image.isEmpty
                        ? const Icon(Icons.image_outlined,
                            size: 20, color: _kFaint)
                        : CachedNetworkImage(
                            imageUrl: image,
                            httpHeaders: _kImageHeaders,
                            fit: BoxFit.cover,
                            errorWidget: (_, __, ___) => const Icon(
                                Icons.image_outlined,
                                size: 20,
                                color: _kFaint),
                          ),
                  ),
                );
              },
            ),
          ),

          const SizedBox(height: 12),
          const Divider(height: 1, color: _kLine),
          const SizedBox(height: 12),

          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Total', style: _type(size: 12, color: _kMuted)),
                    Text(_ugx(total),
                        style: _type(size: 16, weight: FontWeight.w700)),
                  ],
                ),
              ),
              // Track only while there is something to track. A tracking button
              // on an order delivered five weeks ago is a link to a page that
              // says "delivered", which the card already said.
              if (_kActive.contains(status)) ...[
                _ghostButton(
                  'Track',
                  Icons.local_shipping_outlined,
                  () => _openWeb('/track-order'),
                ),
                const SizedBox(width: 8),
              ],
              _solidButton('Reorder', () => _reorder(order)),
            ],
          ),
        ],
      ),
    );
  }

  Widget _ghostButton(String label, IconData icon, VoidCallback onTap) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 9),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: _kLine),
        ),
        child: Row(
          children: [
            Icon(icon, size: 15, color: _kBody),
            const SizedBox(width: 6),
            Text(label,
                style: _type(size: 13, weight: FontWeight.w600, color: _kBody)),
          ],
        ),
      ),
    );
  }

  Widget _solidButton(String label, VoidCallback onTap) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
        decoration: BoxDecoration(
          color: _kOrange,
          borderRadius: BorderRadius.circular(10),
        ),
        child: Row(
          children: [
            const Icon(Icons.refresh_rounded, size: 15, color: Colors.white),
            const SizedBox(width: 6),
            Text(label,
                style: _type(
                    size: 13, weight: FontWeight.w700, color: Colors.white)),
          ],
        ),
      ),
    );
  }

  Widget _errorView() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(28),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.error_outline, size: 40, color: _kFaint),
            const SizedBox(height: 12),
            Text(_error!,
                textAlign: TextAlign.center,
                style: _type(size: 14.5, color: _kBody)),
            const SizedBox(height: 16),
            GestureDetector(
              onTap: _load,
              child: Text('Try again',
                  style: _type(
                      size: 14.5, weight: FontWeight.w700, color: _kOrange)),
            ),
          ],
        ),
      ),
    );
  }

  Widget _emptyView() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(28),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.receipt_long_outlined, size: 44, color: _kFaint),
            const SizedBox(height: 12),
            Text(
              _filter == _Filter.all
                  ? 'No orders yet'
                  : _filter == _Filter.active
                      ? 'Nothing on its way'
                      : 'Nothing delivered yet',
              style: _type(size: 16, weight: FontWeight.w700),
            ),
            const SizedBox(height: 4),
            Text(
              _filter == _Filter.all
                  ? 'Your orders will appear here once you place one.'
                  : 'Switch to All to see your other orders.',
              textAlign: TextAlign.center,
              style: _type(size: 13.5, color: _kMuted),
            ),
          ],
        ),
      ),
    );
  }
}
