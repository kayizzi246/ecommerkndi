// Automatic FlutterFlow imports
import '/flutter_flow/flutter_flow_theme.dart';
import '/flutter_flow/flutter_flow_util.dart';
import '/custom_code/widgets/index.dart'; // Imports other custom widgets
import '/flutter_flow/custom_functions.dart'; // Imports custom functions
import 'package:flutter/material.dart';
// Begin custom widget code
// DO NOT REMOVE OR MODIFY THE CODE ABOVE!

// Imports go BELOW the header — FlutterFlow rewrites it on save and drops
// anything added there. Do not add the `/backend/` imports it offers.
import 'dart:convert';

import 'package:flutter/services.dart';

import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

// ============================================================
//  KANDI — SELLER ORDERS
//
//  What a trader has been sold, and the one action a phone is
//  genuinely better at than a desk: confirming they are packing
//  it.
//
//  Self-contained like every page here; the architecture is at
//  the head of kandi_home_screen.dart.
//
//  ---- Why accepting an order belongs in the app ----
//
//  Everything else in the Seller Centre is reading, and reading
//  is what a phone is for. Accepting is a WRITE, and it is the
//  one write worth building here because of WHEN it happens: an
//  order arrives, and the trader is in their shop or on a boda,
//  not at a desk. Ten minutes of "yes I have it, I am packing
//  it" is the difference between a customer who gets a
//  confirmation and one who rings to ask.
//
//  It is also safe to do from a phone in a way that editing a
//  price is not — one boolean, no form, and nothing a mistyped
//  field can corrupt.
//
//  ---- Accepting is optimistic, and it reverts ----
//
//  The row flips the moment it is tapped rather than waiting
//  for the round trip, because on a Ugandan mobile connection
//  that wait is long enough for a trader to tap again. If the
//  request fails the row flips back and says so. What must
//  never happen is a row that says "accepted" when the shop
//  never heard.
// ============================================================

class _KColors {
  const _KColors._();
  static const Color canvas = Color(0xFFFFFFFF);
  static const Color panel = Color(0xFFFFFFFF);
  static const Color ink = Color(0xFF0B0B0B);
  static const Color body = Color(0xFF414346);
  static const Color muted = Color(0xFF5D6066);
  static const Color line = Color(0xFFE0E0E0);
  static const Color hairline = Color(0xFFF2F2F2);
  static const Color primary = Color(0xFFFF6A00);
  static const Color primarySoft = Color(0xFFFFF3E8);
  static const Color save = Color(0xFF15803D);
  static const Color saveSoft = Color(0xFFECFDF3);
  static const Color warn = Color(0xFFB45309);
  static const Color warnSoft = Color(0xFFFDF3E6);
  static const Color info = Color(0xFF1A56C4);
  static const Color infoSoft = Color(0xFFEAF1FD);

  /// ---- The money colour ----
  ///
  /// Every price on the page is printed in it. A price set in the same ink as
  /// the product name is a price a scanning eye has to hunt for, and on a grid
  /// of forty tiles that hunt is the whole difference between browsing and
  /// giving up.
  ///
  /// #D62200 rather than a brighter red: white on it is 5.1:1, so the same
  /// value works as a ground under white button text AND as text on white at
  /// the 11px a card's price line runs at. The brighter reds do one or the
  /// other, never both.
  static const Color flame = Color(0xFFD62200);
  static const Color flameSoft = Color(0xFFFFF1ED);

  /// ---- The edge that makes a white card visible on a white page ----
  ///
  /// The app used to stand its tiles on #F5F5F5 and let the contrast do the
  /// separating. The site does not: its canvas is #ffffff, the same as the
  /// panel, so the tile is drawn by a 1px ring and nothing else. Matching the
  /// ground without matching the ring would have produced a grid of tiles with
  /// no edges at all.
  static const Color edge = Color(0xFFDEDEDE);


}

class _KSpace {
  const _KSpace._();
  static const double sm = 8;
  static const double md = 12;
  static const double lg = 16;
  static const double xl = 24;
}

const double _rPanel = 12;
const double _rChip = 8;

/// The brand gradient: Kandi orange running into the deep red.
///
/// It carries the chrome — app bars, the home band, the primary buttons — so
/// that every screen is recognisably one shop. Horizontal rather than vertical
/// because an app bar is a wide, short box: a vertical ramp across 56px reads
/// as a flat muddy colour, where a horizontal one across the whole width
/// actually travels.
const LinearGradient _brandGradient = LinearGradient(
  begin: Alignment.centerLeft,
  end: Alignment.centerRight,
  colors: [Color(0xFFFF6A00), Color(0xFFD62200)],
);

/// Fully rounded. The primary calls to action are pills, which is what tells
/// them apart from the square panels they sit on.
const double _rPill = 999;
const String _apiBase = 'https://kandiug.com';
const String _sellerAuthKey = 'kandi-seller-auth-v1';

String _money(num amount) {
  final whole = amount.round().toString();
  final out = StringBuffer();
  for (int i = 0; i < whole.length; i++) {
    if (i > 0 && (whole.length - i) % 3 == 0) out.write(',');
    out.write(whole[i]);
  }
  return 'UGX $out';
}

class _KLine {
  const _KLine({required this.name, required this.quantity, required this.total});
  final String name;
  final int quantity;
  final num total;

  static List<_KLine> listFrom(dynamic json) {
    if (json is! List) return const [];
    final out = <_KLine>[];
    for (final entry in json) {
      if (entry is! Map) continue;
      out.add(_KLine(
        name: (entry['name'] ?? '').toString(),
        quantity: entry['quantity'] is int ? entry['quantity'] as int : 1,
        total: entry['total'] is num ? entry['total'] as num : 0,
      ));
    }
    return out;
  }
}

class _KOrder {
  _KOrder({
    required this.id,
    required this.number,
    required this.status,
    required this.accepted,
    required this.customer,
    required this.city,
    required this.date,
    required this.sellerTotal,
    required this.netPayout,
    required this.items,
  });

  final int id;
  final String number;
  final String status;

  /// Mutable: the row flips this optimistically on tap and reverts on failure.
  bool accepted;

  final String customer;
  final String city;
  final String date;
  final num sellerTotal;
  final num netPayout;
  final List<_KLine> items;

  Color get tone {
    final lower = status.toLowerCase();
    if (lower.contains('complete') || lower.contains('deliver')) {
      return _KColors.save;
    }
    if (lower.contains('cancel') || lower.contains('fail') ||
        lower.contains('refund')) {
      return _KColors.warn;
    }
    return _KColors.info;
  }

  Color get toneSoft {
    final colour = tone;
    if (colour == _KColors.save) return _KColors.saveSoft;
    if (colour == _KColors.warn) return _KColors.warnSoft;
    return _KColors.infoSoft;
  }

  /// Whether accepting is still meaningful.
  ///
  /// A cancelled or completed order cannot be "accepted" into packing, and
  /// offering the button on one is offering an action the server will refuse.
  bool get canAccept {
    if (accepted) return false;
    final lower = status.toLowerCase();
    return !lower.contains('cancel') &&
        !lower.contains('refund') &&
        !lower.contains('complete') &&
        !lower.contains('fail');
  }

  static _KOrder? from(dynamic json) {
    if (json is! Map) return null;
    final id = json['id'];
    if (id is! int) return null;
    return _KOrder(
      id: id,
      number: (json['number'] ?? id).toString(),
      status: (json['status'] ?? 'processing').toString(),
      accepted: json['accepted'] == true,
      customer: (json['customer'] ?? '').toString(),
      city: (json['city'] ?? '').toString(),
      date: (json['date'] ?? '').toString(),
      sellerTotal: json['seller_total'] is num ? json['seller_total'] as num : 0,
      netPayout: json['net_payout'] is num ? json['net_payout'] as num : 0,
      items: _KLine.listFrom(json['items']),
    );
  }

  static List<_KOrder> listFrom(dynamic json) {
    final list = json is Map && json['orders'] is List
        ? json['orders'] as List
        : (json is List ? json : const []);
    return list.map(_KOrder.from).whereType<_KOrder>().toList();
  }
}

class KandiSellerOrdersScreen extends StatefulWidget {
  const KandiSellerOrdersScreen({super.key, this.width, this.height});

  final double? width;
  final double? height;

  @override
  State<KandiSellerOrdersScreen> createState() =>
      _KandiSellerOrdersScreenState();
}

class _KandiSellerOrdersScreenState extends State<KandiSellerOrdersScreen> {
  static const List<({String key, String label})> _filters = [
    (key: 'any', label: 'All'),
    (key: 'processing', label: 'To pack'),
    (key: 'completed', label: 'Completed'),
  ];

  bool _loading = true;
  bool _signedOut = false;
  bool _failed = false;
  String _filter = 'any';
  List<_KOrder> _orders = const [];

  /// Ids with an accept in flight, so the button cannot be double-tapped.
  final Set<int> _accepting = <int>{};

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<String?> _token() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final token = prefs.getString(_sellerAuthKey);
      return (token != null && token.isNotEmpty) ? token : null;
    } catch (_) {
      return null;
    }
  }

  Future<void> _load() async {
    if (mounted) setState(() => _loading = true);

    final token = await _token();
    if (token == null) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _signedOut = true;
      });
      return;
    }

    dynamic data;
    int status = 0;
    try {
      final response = await http.get(
        Uri.parse('$_apiBase/api/app/seller/orders?status=$_filter'),
        headers: {'Authorization': 'Bearer $token'},
      ).timeout(const Duration(seconds: 20));
      status = response.statusCode;
      data = jsonDecode(response.body);
    } catch (_) {
      status = 0;
    }

    if (!mounted) return;

    if (status == 401 || status == 403) {
      // The seller token is no longer accepted. Cleared here as well as on the
      // dashboard, so whichever page discovers it puts the trader back at the
      // sign-in rather than leaving a session that silently fails.
      try {
        final prefs = await SharedPreferences.getInstance();
        await prefs.remove(_sellerAuthKey);
      } catch (_) {}
      if (!mounted) return;
      setState(() {
        _loading = false;
        _signedOut = true;
      });
      return;
    }

    if (status != 200) {
      setState(() {
        _loading = false;
        _failed = true;
      });
      return;
    }

    setState(() {
      _loading = false;
      _failed = false;
      _orders = _KOrder.listFrom(data);
    });
  }

  Future<void> _accept(_KOrder order) async {
    if (_accepting.contains(order.id)) return;

    final token = await _token();
    if (token == null) return;

    // Optimistic: the row flips now. On a slow connection the wait is long
    // enough for a trader to tap again and wonder if it worked.
    setState(() {
      _accepting.add(order.id);
      order.accepted = true;
    });

    int status = 0;
    try {
      final response = await http.post(
        Uri.parse('$_apiBase/api/app/seller/orders/${order.id}/accept'),
        headers: {
          'Authorization': 'Bearer $token',
          'Content-Type': 'application/json',
        },
      ).timeout(const Duration(seconds: 20));
      status = response.statusCode;
    } catch (_) {
      status = 0;
    }

    if (!mounted) return;

    if (status != 200) {
      // Reverted, and said out loud. A row that claims "accepted" when the shop
      // never heard is the one outcome this screen must never produce — the
      // customer is waiting on a confirmation that will not come.
      setState(() {
        _accepting.remove(order.id);
        order.accepted = false;
      });
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Could not accept order ${order.number}. Try again.'),
          behavior: SnackBarBehavior.floating,
        ),
      );
      return;
    }

    setState(() => _accepting.remove(order.id));
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('Order ${order.number} accepted — get it packed.'),
        behavior: SnackBarBehavior.floating,
        duration: const Duration(seconds: 2),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: widget.width,
      height: widget.height,
      child: Scaffold(
        backgroundColor: _KColors.canvas,
        appBar: AppBar(
          backgroundColor: Colors.transparent,
          surfaceTintColor: Colors.transparent,
          elevation: 0,
          scrolledUnderElevation: 0,
          // The gradient goes behind the bar rather than in `backgroundColor`,
          // which only takes a flat colour. `flexibleSpace` fills the whole
          // bar including the status-bar strip above it, so the ramp starts at
          // the top of the screen and not under the clock.
          // SizedBox.expand is load-bearing. A childless DecoratedBox has
          // no size, and AppBar puts flexibleSpace in a Stack under loose
          // constraints — so the gradient painted nothing at all and every
          // sub-page had a white title on a white bar.
          flexibleSpace: const DecoratedBox(
            decoration: BoxDecoration(gradient: _brandGradient),
            child: SizedBox.expand(),
          ),
          systemOverlayStyle: SystemUiOverlayStyle.light,
          iconTheme: const IconThemeData(color: Colors.white),
          title: const Text('Orders',
              style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w700,
                  color: Colors.white)),
        ),
        body: _buildBody(),
      ),
    );
  }

  Widget _buildBody() {
    // A skeleton of the right shape rather than a spinner — see `_Skeleton`.
    if (_loading) return const _Skeleton();

    if (_signedOut) {
      return _message(
        icon: Icons.lock_outline_rounded,
        title: 'Your seller session ended',
        message: 'Sign in again from the Seller Centre to see your orders.',
        actionLabel: 'Back',
        onAction: () => Navigator.of(context).maybePop(),
      );
    }

    if (_failed) {
      return _message(
        icon: Icons.wifi_off_rounded,
        title: 'Could not load your orders',
        message: 'Check your connection and try again.',
        actionLabel: 'Try again',
        onAction: _load,
      );
    }

    return Column(
      children: [
        SizedBox(
          height: 52,
          child: ListView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(
                horizontal: _KSpace.md, vertical: _KSpace.sm),
            children: [
              for (final option in _filters)
                Padding(
                  padding: const EdgeInsets.only(right: _KSpace.sm),
                  child: GestureDetector(
                    onTap: () {
                      if (_filter == option.key) return;
                      setState(() => _filter = option.key);
                      _load();
                    },
                    child: Container(
                      alignment: Alignment.center,
                      padding:
                          const EdgeInsets.symmetric(horizontal: _KSpace.lg),
                      decoration: BoxDecoration(
                        color: _filter == option.key
                            ? _KColors.flameSoft
                            : _KColors.panel,
                        // A pill, like every other filter in the app.
                        borderRadius: BorderRadius.circular(_rPill),
                        border: Border.all(
                            color: _filter == option.key
                                ? _KColors.flame
                                : _KColors.line,
                            width: _filter == option.key ? 1.5 : 1),
                      ),
                      child: Text(option.label,
                          style: TextStyle(
                              fontSize: 13,
                              fontWeight: _filter == option.key
                                  ? FontWeight.w700
                                  : FontWeight.w500,
                              color: _KColors.ink)),
                    ),
                  ),
                ),
            ],
          ),
        ),
        Expanded(
          child: _orders.isEmpty
              ? _message(
                  icon: Icons.inbox_rounded,
                  title: 'No orders here',
                  message: _filter == 'any'
                      ? 'When somebody buys from your store it will appear here.'
                      : 'Nothing under this filter right now.',
                  actionLabel: 'Refresh',
                  onAction: _load,
                )
              : RefreshIndicator(
                  color: _KColors.primary,
                  onRefresh: _load,
                  child: ListView.separated(
                    padding: const EdgeInsets.fromLTRB(
                        _KSpace.md, 0, _KSpace.md, _KSpace.xl),
                    itemCount: _orders.length,
                    separatorBuilder: (_, __) =>
                        const SizedBox(height: _KSpace.md),
                    itemBuilder: (context, index) => _card(_orders[index]),
                  ),
                ),
        ),
      ],
    );
  }

  Widget _card(_KOrder order) {
    final busy = _accepting.contains(order.id);
    return Container(
      padding: const EdgeInsets.all(_KSpace.lg),
      decoration: BoxDecoration(
        color: _KColors.panel,
        borderRadius: BorderRadius.circular(_rPanel),
        border: Border.all(color: _KColors.edge),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text('#${order.number}',
                    style: const TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w800,
                        color: _KColors.ink)),
              ),
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
                decoration: BoxDecoration(
                  color: order.toneSoft,
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text(order.status,
                    style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w800,
                        color: order.tone)),
              ),
            ],
          ),
          if (order.customer.isNotEmpty || order.city.isNotEmpty) ...[
            const SizedBox(height: 4),
            Text(
              [order.customer, order.city]
                  .where((part) => part.isNotEmpty)
                  .join(' · '),
              style: const TextStyle(fontSize: 12.5, color: _KColors.muted),
            ),
          ],
          if (order.date.isNotEmpty)
            Text(order.date,
                style: const TextStyle(fontSize: 12, color: _KColors.muted)),
          if (order.items.isNotEmpty) ...[
            const SizedBox(height: _KSpace.md),
            for (final line in order.items)
              Padding(
                padding: const EdgeInsets.only(bottom: 4),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('${line.quantity}×',
                        style: const TextStyle(
                            fontSize: 12.5,
                            fontWeight: FontWeight.w700,
                            color: _KColors.muted)),
                    const SizedBox(width: _KSpace.sm),
                    Expanded(
                      child: Text(line.name,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                              fontSize: 12.5,
                              height: 1.35,
                              color: _KColors.ink)),
                    ),
                    const SizedBox(width: _KSpace.sm),
                    Text(_money(line.total),
                        style: const TextStyle(
                            fontSize: 12.5,
                            fontWeight: FontWeight.w700,
                            color: _KColors.ink)),
                  ],
                ),
              ),
          ],
          const Divider(color: _KColors.hairline, height: _KSpace.lg),
          Row(
            children: [
              const Text('Your payout',
                  style: TextStyle(fontSize: 13, color: _KColors.muted)),
              const Spacer(),
              Text(_money(order.netPayout),
                  style: const TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w800,
                      color: _KColors.ink)),
            ],
          ),
          const SizedBox(height: _KSpace.md),
          if (order.accepted)
            Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(vertical: 11),
              decoration: BoxDecoration(
                color: _KColors.saveSoft,
                borderRadius: BorderRadius.circular(_rChip),
              ),
              child: const Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.check_circle_rounded,
                      size: 17, color: _KColors.save),
                  SizedBox(width: 6),
                  Text('Accepted — packing',
                      style: TextStyle(
                          fontSize: 13.5,
                          fontWeight: FontWeight.w700,
                          color: _KColors.save)),
                ],
              ),
            )
          else if (order.canAccept)
            SizedBox(
              width: double.infinity,
              height: 44,
              child: FilledButton(
                onPressed: busy ? null : () => _accept(order),
                style: FilledButton.styleFrom(
                  backgroundColor: _KColors.flame,
                  disabledBackgroundColor: _KColors.line,
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(_rPill)),
                ),
                child: Text(busy ? 'Accepting…' : 'Accept and pack',
                    style: const TextStyle(
                        fontSize: 14.5, fontWeight: FontWeight.w700)),
              ),
            ),
        ],
      ),
    );
  }

  Widget _message({
    required IconData icon,
    required String title,
    required String message,
    required String actionLabel,
    required VoidCallback onAction,
  }) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(_KSpace.xl),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 72,
              height: 72,
              decoration: const BoxDecoration(
                  color: _KColors.primarySoft, shape: BoxShape.circle),
              child: Icon(icon, size: 32, color: _KColors.primary),
            ),
            const SizedBox(height: _KSpace.lg),
            Text(title,
                textAlign: TextAlign.center,
                style: const TextStyle(
                    fontSize: 17,
                    fontWeight: FontWeight.w800,
                    color: _KColors.ink)),
            const SizedBox(height: _KSpace.sm),
            Text(message,
                textAlign: TextAlign.center,
                style: const TextStyle(
                    fontSize: 13.5, height: 1.5, color: _KColors.body)),
            const SizedBox(height: _KSpace.lg),
            SizedBox(
              width: 200,
              height: 46,
              child: FilledButton(
                onPressed: onAction,
                style: FilledButton.styleFrom(
                  backgroundColor: _KColors.flame,
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(_rPill)),
                ),
                child: Text(actionLabel,
                    style: const TextStyle(
                        fontSize: 14.5, fontWeight: FontWeight.w700)),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// What the screen shows before the first answer arrives.
///
/// A shimmering block of roughly the right shape rather than a spinner: a
/// spinner says "something is happening", a skeleton says "the rows are
/// arriving", and the second stops the layout jumping when they do. The same
/// widget the home screen uses, sized for cards rather than for product tiles.
///
/// It matters more on a seller's screen than anywhere else in the app. These
/// pages are opened to check a figure — today's takings, what is payable, what
/// is out of stock — and a full-screen spinner gives a trader nothing to read
/// while the shop answers.
class _Skeleton extends StatefulWidget {
  const _Skeleton();

  @override
  State<_Skeleton> createState() => _SkeletonState();
}

class _SkeletonState extends State<_Skeleton>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1100),
  )..repeat(reverse: true);

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Widget _block(double width, double height, [double radius = 6]) {
    return AnimatedBuilder(
      animation: _controller,
      builder: (context, _) => Container(
        width: width,
        height: height,
        decoration: BoxDecoration(
          color:
              Color.lerp(_KColors.hairline, _KColors.line, _controller.value),
          borderRadius: BorderRadius.circular(radius),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return ListView.separated(
      padding: const EdgeInsets.all(_KSpace.md),
      itemCount: 4,
      separatorBuilder: (_, __) => const SizedBox(height: _KSpace.md),
      itemBuilder: (_, __) => Container(
        padding: const EdgeInsets.all(_KSpace.lg),
        decoration: BoxDecoration(
          color: _KColors.panel,
          borderRadius: BorderRadius.circular(_rPanel),
          border: Border.all(color: _KColors.edge),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                _block(130, 16),
                const Spacer(),
                _block(64, 18, 6),
              ],
            ),
            const SizedBox(height: _KSpace.sm),
            _block(96, 12),
            const SizedBox(height: _KSpace.lg),
            Row(
              children: [
                _block(70, 13),
                const Spacer(),
                _block(88, 18),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
