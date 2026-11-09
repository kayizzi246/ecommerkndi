// Automatic FlutterFlow imports
import '/flutter_flow/flutter_flow_theme.dart';
import '/flutter_flow/flutter_flow_util.dart';
import '/custom_code/widgets/index.dart'; // Imports other custom widgets
import '/flutter_flow/custom_functions.dart'; // Imports custom functions
import 'package:flutter/material.dart';
// Begin custom widget code
// DO NOT REMOVE OR MODIFY THE CODE ABOVE!


// ============================================================
//  KANDI — CHECKOUT
//  Address, delivery price, items, reward points, payment.
//
//  The order is placed by the Supabase Edge Function
//  `place-order`, which creates the real order in WooCommerce
//  (same prices, stock and delivery rules as the website) and
//  keeps a copy in Supabase. Mobile Money and card go through
//  Pesapal on the website, exactly as the web checkout does.
// ============================================================

import 'dart:convert';
import 'dart:math' as math;
import 'package:cached_network_image/cached_network_image.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:webview_flutter/webview_flutter.dart';

// Other Kandi screens are reached through '/custom_code/widgets/index.dart' above.

class KandiCheckoutScreen extends StatefulWidget {
  const KandiCheckoutScreen({super.key, this.width, this.height});
  final double? width;
  final double? height;

  @override
  State<KandiCheckoutScreen> createState() => _KandiCheckoutScreenState();
}

/// Cash on delivery: within 40 km of central Kampala (the website's rule).
bool _codAllowed(double? lat, double? lng) {
  if (lat == null || lng == null) return false;
  double rad(double deg) => deg * math.pi / 180;
  const centreLat = 0.3476, centreLng = 32.5825;
  final dLat = rad(lat - centreLat), dLng = rad(lng - centreLng);
  final h = math.pow(math.sin(dLat / 2), 2) +
      math.cos(rad(centreLat)) * math.cos(rad(lat)) * math.pow(math.sin(dLng / 2), 2);
  return 2 * 6371 * math.asin(math.sqrt(h)) <= 40;
}

class _KandiCheckoutScreenState extends State<KandiCheckoutScreen> {
  final _cart = _KCart.instance;
  final _notes = TextEditingController();

  Map<String, dynamic>? _address;
  Map<String, dynamic>? _quote;
  bool _quoting = false;
  String? _quoteError;

  int _balance = 0;
  int _pointValue = 10;
  int _minRedeem = 100;
  int _maxPercent = 50;
  bool _usePoints = false;

  String _payment = 'pesapal';
  bool _placing = false;
  String? _error;
  Map<String, dynamic>? _placed;

  /// An order already created in WooCommerce whose Pesapal payment did not
  /// finish. Paying again pays for THIS order, instead of creating a second one
  /// and spending the shopper's points twice.
  Map<String, dynamic>? _unpaid;

  @override
  void initState() {
    super.initState();
    _start();
  }

  Future<void> _start() async {
    await _cart.load();
    if (!_KAuth.signedIn) {
      final ok = await _KAuth.ensure(context, reason: 'Sign in to check out');
      if (!ok) {
        if (mounted) Navigator.of(context).pop();
        return;
      }
    }
    await Future.wait([_loadAddress(), _loadPoints()]);
  }

  Future<void> _loadPoints() async {
    try {
      final settings = await _kSupa.from('reward_settings').select().eq('id', 1).maybeSingle();
      final profile = await _kSupa.from('profiles').select('points_balance').eq('id', _KAuth.user!.id).maybeSingle();
      if (!mounted) return;
      setState(() {
        _balance = (profile?['points_balance'] as num?)?.toInt() ?? 0;
        _pointValue = (settings?['point_value_ugx'] as num?)?.toInt() ?? 10;
        _minRedeem = (settings?['min_redeem_points'] as num?)?.toInt() ?? 100;
        _maxPercent = (settings?['max_redeem_percent'] as num?)?.toInt() ?? 50;
      });
    } catch (_) {}
  }

  Future<void> _loadAddress() async {
    final prefs = await SharedPreferences.getInstance();
    final id = prefs.getString(_KKeys.address);
    final rows = (await _kSupa.from('addresses').select().order('is_default', ascending: false).order('created_at')
        as List).cast<Map<String, dynamic>>();
    Map<String, dynamic>? chosen;
    for (final row in rows) {
      if (row['id'] == id) chosen = row;
    }
    chosen ??= rows.isNotEmpty ? rows.first : null;
    if (!mounted) return;
    setState(() => _address = chosen);
    if (chosen == null) {
      await _changeAddress();
    } else {
      await _price();
    }
  }

  Future<void> _changeAddress() async {
    final changed = await Navigator.of(context).push<bool>(
      MaterialPageRoute(builder: (_) => const KandiAddressPickerScreen()),
    );
    if (changed == true) await _loadAddress();
  }

  /// Delivery price from the website's own quote, the same one the web checkout uses.
  Future<void> _price() async {
    final address = _address;
    if (address == null) return;
    setState(() {
      _quoting = true;
      _quoteError = null;
    });
    try {
      final lat = (address['lat'] as num?)?.toDouble();
      final lng = (address['lng'] as num?)?.toDouble();
      final response = await http
          .post(
            Uri.parse('$_kSiteUrl/api/delivery/quote'),
            headers: const {'Content-Type': 'application/json'},
            body: jsonEncode(lat != null && lng != null
                ? {'subtotal': _cart.subtotal, 'point': {'lat': lat, 'lng': lng}}
                : {
                    'subtotal': _cart.subtotal,
                    'address': [address['street'], address['area'], address['city']]
                        .where((part) => part != null && '$part'.isNotEmpty)
                        .join(', '),
                  }),
          )
          .timeout(const Duration(seconds: 20));
      final data = jsonDecode(response.body) as Map<String, dynamic>;
      if (!mounted) return;
      setState(() {
        _quoting = false;
        if (data['fee'] is num) {
          _quote = data;
          final point = data['point'];
          final ok = _codAllowed(
            (point is Map ? point['lat'] as num? : null)?.toDouble() ?? lat,
            (point is Map ? point['lng'] as num? : null)?.toDouble() ?? lng,
          );
          if (!ok && _payment == 'cod') _payment = 'pesapal';
        } else {
          _quote = null;
          _quoteError = '${data['error'] ?? 'We could not price delivery to this address.'}';
        }
      });
    } catch (_) {
      if (mounted) {
        setState(() {
          _quoting = false;
          _quoteError = 'Could not price delivery. Check your connection.';
        });
      }
    }
  }

  bool get _codHere {
    final point = _quote?['point'];
    final lat = (point is Map ? point['lat'] as num? : null)?.toDouble() ?? (_address?['lat'] as num?)?.toDouble();
    final lng = (point is Map ? point['lng'] as num? : null)?.toDouble() ?? (_address?['lng'] as num?)?.toDouble();
    return _codAllowed(lat, lng);
  }

  int get _redeemable {
    final cap = (_cart.subtotal * _maxPercent / 100 / math.max(_pointValue, 1)).floor();
    final points = math.min(_balance, cap);
    return points >= _minRedeem ? points : 0;
  }

  double get _fee => ((_quote?['fee'] as num?) ?? 0).toDouble();
  double get _discount => _usePoints ? (_redeemable * _pointValue).toDouble() : 0;
  double get _total => math.max(0, _cart.subtotal + _fee - _discount);

  Future<void> _place() async {
    if (_address == null || _quote == null || _cart.lines.isEmpty) return;
    if (_quote?['deliverable'] == false) {
      setState(() => _error = 'We do not deliver to this address yet.');
      return;
    }
    setState(() {
      _placing = true;
      _error = null;
    });

    if (_unpaid != null && _payment == 'pesapal') {
      final order = _unpaid!;
      final paid = await _pay(order);
      if (!mounted) return;
      if (!paid) {
        setState(() {
          _placing = false;
          _error = 'Order #${order['woo_order_id']} is still not paid. Try again, or call us on $_kSupportPhone.';
        });
        return;
      }
      await _cart.clear();
      if (!mounted) return;
      setState(() {
        _placing = false;
        _placed = order;
      });
      return;
    }

    // Assigned in the try; both catch branches return before it is read.
    late final Map<String, dynamic> result;
    try {
      final response = await _kSupa.functions.invoke('place-order', body: {
        'items': _cart.lines
            .map((line) => {
                  'product_id': line.productId,
                  'variation_id': line.variationId,
                  'quantity': line.quantity,
                  'options': line.options,
                })
            .toList(),
        'address_id': _address!['id'],
        'payment_method': _payment,
        'redeem_points': _usePoints ? _redeemable : 0,
        'notes': _notes.text.trim(),
      });
      result = (response.data as Map).cast<String, dynamic>();
    } on FunctionException catch (e) {
      final details = e.details;
      setState(() {
        _placing = false;
        _error = details is Map && details['error'] != null ? '${details['error']}' : 'Could not place your order.';
      });
      return;
    } catch (_) {
      setState(() {
        _placing = false;
        _error = 'Could not place your order. Check your connection and try again.';
      });
      return;
    }

    final placed = result;
    if (_payment == 'pesapal') {
      final paid = await _pay(placed);
      if (!mounted) return;
      if (!paid) {
        setState(() {
          _placing = false;
          _unpaid = placed;
          _error = 'Your order #${placed['woo_order_id']} is saved but not paid yet. Tap Pay to try again.';
        });
        return;
      }
    }

    await _cart.clear();
    if (!mounted) return;
    setState(() {
      _placing = false;
      _placed = placed;
    });
  }

  /// Opens Pesapal in a sheet. True when the money arrived.
  Future<bool> _pay(Map<String, dynamic> order) async {
    try {
      final response = await http
          .post(
            Uri.parse('$_kSiteUrl/api/payments/pesapal/start'),
            headers: const {'Content-Type': 'application/json', 'Accept': 'application/json'},
            body: jsonEncode({
              'purpose': {'kind': 'order', 'orderId': order['woo_order_id']},
              'token': order['payment_token'],
            }),
          )
          .timeout(const Duration(seconds: 30));
      final data = jsonDecode(response.body);
      final url = data is Map ? '${data['redirect_url'] ?? ''}' : '';
      if (response.statusCode != 200 || url.isEmpty || !mounted) return false;
      final outcome = await showModalBottomSheet<bool>(
        context: context,
        isScrollControlled: true,
        isDismissible: false,
        enableDrag: false,
        backgroundColor: Colors.transparent,
        builder: (_) => _PaymentSheet(url: url, amount: _kMoney((order['total'] as num?) ?? _total)),
      );
      return outcome == true;
    } catch (_) {
      return false;
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_placed != null) return _success();

    return Scaffold(
      backgroundColor: _KColors.ground,
      appBar: AppBar(
        backgroundColor: _KColors.white,
        foregroundColor: _KColors.ink,
        elevation: 0,
        title: const Text('Checkout', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 20)),
      ),
      body: ListView(
        padding: const EdgeInsets.all(12),
        children: [
          _card(
            title: 'Deliver to',
            action: _address == null ? 'Add' : 'Change',
            onAction: _changeAddress,
            child: _address == null
                ? const Text('Add the address we should deliver to.', style: TextStyle(color: _KColors.muted))
                : Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('${_address!['recipient']} · ${_address!['phone']}',
                          style: const TextStyle(fontWeight: FontWeight.w800)),
                      const SizedBox(height: 2),
                      Text(
                        [_address!['street'], _address!['area'], _address!['city']]
                            .where((part) => part != null && '$part'.isNotEmpty)
                            .join(', '),
                        style: const TextStyle(color: _KColors.body),
                      ),
                      const SizedBox(height: 10),
                      if (_quoting)
                        const LinearProgressIndicator(color: _KColors.ink, backgroundColor: _KColors.line)
                      else if (_quoteError != null)
                        Text(_quoteError!, style: const TextStyle(color: _KColors.sale, fontWeight: FontWeight.w700))
                      else if (_quote != null)
                        Row(
                          children: [
                            const Icon(Icons.local_shipping_outlined, size: 18),
                            const SizedBox(width: 8),
                            Expanded(child: Text('${_quote!['label'] ?? 'Delivery'}', style: const TextStyle(color: _KColors.body))),
                            Text(_fee == 0 ? 'Free' : _kMoney(_fee),
                                style: TextStyle(fontWeight: FontWeight.w900, color: _fee == 0 ? _KColors.green : _KColors.ink)),
                          ],
                        ),
                    ],
                  ),
          ),
          _card(
            title: '${_cart.count} ${_cart.count == 1 ? 'item' : 'items'}',
            child: Column(
              children: [
                for (final line in _cart.lines)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 8),
                    child: Row(
                      children: [
                        SizedBox(width: 48, height: 48, child: _KPhoto(line.image, radius: 10)),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(line.name, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 13)),
                              Text(
                                [if (line.optionText.isNotEmpty) line.optionText, 'Qty ${line.quantity}'].join(' · '),
                                style: const TextStyle(fontSize: 12, color: _KColors.muted),
                              ),
                            ],
                          ),
                        ),
                        Text(_kMoney(line.price * line.quantity), style: const TextStyle(fontWeight: FontWeight.w800)),
                      ],
                    ),
                  ),
              ],
            ),
          ),
          _card(
            title: 'Reward points',
            child: _redeemable > 0
                ? SwitchListTile(
                    contentPadding: EdgeInsets.zero,
                    activeColor: _KColors.ink,
                    value: _usePoints,
                    onChanged: (value) => setState(() => _usePoints = value),
                    title: Text('Use $_redeemable points', style: const TextStyle(fontWeight: FontWeight.w800)),
                    subtitle: Text('Save ${_kMoney(_redeemable * _pointValue)} · you have $_balance'),
                  )
                : Text(
                    _balance > 0
                        ? 'You have $_balance points. You can use them from $_minRedeem points.'
                        : 'You will earn about ${(_cart.subtotal / 1000).floor()} points when this order is delivered.',
                    style: const TextStyle(color: _KColors.body),
                  ),
          ),
          _card(
            title: 'Payment',
            child: Column(
              children: [
                _payOption('pesapal', 'Mobile Money or card', 'MTN MoMo, Airtel Money, Visa, Mastercard', true),
                _payOption(
                  'cod',
                  'Cash on delivery',
                  _unpaid != null
                      ? 'Finish paying order #${_unpaid!['woo_order_id']} first'
                      : _codHere
                          ? 'Pay the rider when it arrives'
                          : 'Only within 40 km of central Kampala',
                  _codHere && _unpaid == null,
                ),
              ],
            ),
          ),
          _card(
            title: 'Note for the rider (optional)',
            child: TextField(
              controller: _notes,
              maxLines: 2,
              decoration: InputDecoration(
                hintText: 'Call when you reach the gate',
                filled: true,
                fillColor: _KColors.ground,
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: BorderSide.none),
              ),
            ),
          ),
          if (_error != null)
            Container(
              margin: const EdgeInsets.only(bottom: 12),
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(color: const Color(0xFFFDECEC), borderRadius: BorderRadius.circular(14)),
              child: Text(_error!, style: const TextStyle(color: _KColors.sale, fontWeight: FontWeight.w700)),
            ),
          const SizedBox(height: 80),
        ],
      ),
      bottomNavigationBar: Container(
        decoration: const BoxDecoration(color: _KColors.white, border: Border(top: BorderSide(color: _KColors.line))),
        child: SafeArea(
          top: false,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 10, 16, 10),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                _row('Items', _kMoney(_cart.subtotal)),
                _row('Delivery', _quote == null ? '—' : (_fee == 0 ? 'Free' : _kMoney(_fee))),
                if (_discount > 0) _row('Points', '−${_kMoney(_discount)}', color: _KColors.green),
                const SizedBox(height: 4),
                _row('Total', _kMoney(_total), bold: true),
                const SizedBox(height: 10),
                _KButton(
                  label: _payment == 'cod' ? 'Place order' : 'Pay ${_kMoney(_total)}',
                  busy: _placing,
                  onPressed: _address == null || _quote == null || _cart.lines.isEmpty ? null : _place,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _row(String label, String value, {bool bold = false, Color? color}) {
    final style = TextStyle(
      fontSize: bold ? 18 : 14,
      fontWeight: bold ? FontWeight.w900 : FontWeight.w600,
      color: color ?? (bold ? _KColors.ink : _KColors.body),
    );
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 1),
      child: Row(children: [Text(label, style: style), const Spacer(), Text(value, style: style)]),
    );
  }

  Widget _payOption(String value, String title, String subtitle, bool enabled) {
    final on = _payment == value;
    return Opacity(
      opacity: enabled ? 1 : 0.45,
      child: GestureDetector(
        onTap: enabled ? () => setState(() => _payment = value) : null,
        child: Container(
          margin: const EdgeInsets.only(bottom: 8),
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: on ? _KColors.ink : _KColors.line, width: on ? 2 : 1),
          ),
          child: Row(
            children: [
              Icon(on ? Icons.radio_button_checked : Icons.radio_button_off, color: _KColors.ink),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(title, style: const TextStyle(fontWeight: FontWeight.w800)),
                    Text(subtitle, style: const TextStyle(fontSize: 12, color: _KColors.muted)),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _card({required String title, required Widget child, String? action, VoidCallback? onAction}) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(color: _KColors.white, borderRadius: BorderRadius.circular(18)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(child: Text(title, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w900))),
              if (action != null)
                GestureDetector(
                  onTap: onAction,
                  child: Text(action, style: const TextStyle(fontWeight: FontWeight.w800, decoration: TextDecoration.underline)),
                ),
            ],
          ),
          const SizedBox(height: 10),
          child,
        ],
      ),
    );
  }

  Widget _success() {
    return Scaffold(
      backgroundColor: _KColors.white,
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Container(
                width: 96,
                height: 96,
                decoration: const BoxDecoration(color: _KColors.greenSoft, shape: BoxShape.circle),
                child: const Icon(Icons.check_rounded, size: 56, color: _KColors.green),
              ),
              const SizedBox(height: 20),
              const Text('Order placed!', style: TextStyle(fontSize: 30, fontWeight: FontWeight.w900, letterSpacing: -0.5)),
              const SizedBox(height: 8),
              Text(
                'Order #${_placed!['woo_order_id']} · ${_kMoney((_placed!['total'] as num?) ?? 0)}\nWe will call you before delivery.',
                textAlign: TextAlign.center,
                style: const TextStyle(fontSize: 15, color: _KColors.body, height: 1.5),
              ),
              const SizedBox(height: 28),
              _KButton(label: 'Keep shopping', onPressed: () => _KNav.tab(context, 0)),
              const SizedBox(height: 10),
              _KButton(
                label: 'See my orders',
                outline: true,
                onPressed: () => Navigator.of(context).pushAndRemoveUntil(
                  MaterialPageRoute(builder: (_) => const KandiAccountScreen()),
                  (_) => false,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Pesapal inside the app. When Pesapal sends the shopper to the website's
/// /payment/callback, the website is asked whether the money actually arrived.
class _PaymentSheet extends StatefulWidget {
  const _PaymentSheet({required this.url, required this.amount});
  final String url;
  final String amount;
  @override
  State<_PaymentSheet> createState() => _PaymentSheetState();
}

class _PaymentSheetState extends State<_PaymentSheet> {
  late final WebViewController _controller;
  bool _loading = true;
  bool _settling = false;

  @override
  void initState() {
    super.initState();
    _controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setNavigationDelegate(NavigationDelegate(
        onPageStarted: (_) {
          if (mounted) setState(() => _loading = true);
        },
        onPageFinished: (_) {
          if (mounted) setState(() => _loading = false);
        },
        onNavigationRequest: (request) {
          final uri = Uri.tryParse(request.url);
          if (uri == null || !uri.path.contains('/payment/callback')) return NavigationDecision.navigate;
          if (_settling) return NavigationDecision.prevent;
          _settling = true;
          _finish(
            cancelled: uri.queryParameters['cancelled'] != null,
            tracking: uri.queryParameters['OrderTrackingId'] ?? '',
            reference: uri.queryParameters['OrderMerchantReference'] ?? '',
          );
          return NavigationDecision.prevent;
        },
      ))
      ..loadRequest(Uri.parse(widget.url));
  }

  Future<void> _finish({required bool cancelled, required String tracking, required String reference}) async {
    if (cancelled || tracking.isEmpty) {
      if (mounted) Navigator.of(context).pop(false);
      return;
    }
    if (mounted) setState(() => _loading = true);
    var paid = false;
    try {
      final response = await http
          .post(
            Uri.parse('$_kSiteUrl/api/app/payment/status'),
            headers: const {'Content-Type': 'application/json', 'Accept': 'application/json'},
            body: jsonEncode({'order_tracking_id': tracking, 'merchant_reference': reference}),
          )
          .timeout(const Duration(seconds: 30));
      final data = jsonDecode(response.body);
      paid = response.statusCode == 200 && data is Map && data['paid'] == true;
    } catch (_) {}
    if (mounted) Navigator.of(context).pop(paid);
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      height: MediaQuery.of(context).size.height * 0.92,
      decoration: const BoxDecoration(
        color: _KColors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 8, 8),
            child: Row(
              children: [
                Expanded(
                  child: Text('Pay ${widget.amount}', style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w900)),
                ),
                IconButton(
                  onPressed: () => Navigator.of(context).pop(false),
                  icon: const Icon(Icons.close_rounded),
                ),
              ],
            ),
          ),
          if (_loading) const LinearProgressIndicator(color: _KColors.ink, backgroundColor: _KColors.line),
          Expanded(child: WebViewWidget(controller: _controller)),
        ],
      ),
    );
  }
}

// ============================================================
//  Shared building blocks, private to this file
//  (the same in every Kandi screen; change one, change all)
// ============================================================

/// The website: delivery quotes, place search and Pesapal.
const String _kSiteUrl = 'https://kandiug.com';

/// Support line shown on Account.
const String _kSupportPhone = '0704892253';

// ------------------------------------------------------------
//  Colours and type
// ------------------------------------------------------------

class _KColors {
  static const ink = Color(0xFF111111);
  static const body = Color(0xFF3A3A3A);
  static const muted = Color(0xFF767676);
  static const line = Color(0xFFE8E8E6);
  static const ground = Color(0xFFF5F5F2);
  static const yellow = Color(0xFFFFCC00);
  static const yellowSoft = Color(0xFFFFF4C2);
  static const sale = Color(0xFFD32F2F);
  static const green = Color(0xFF15803D);
  static const greenSoft = Color(0xFFDFF6E6);
  static const white = Colors.white;
}

/// "UGX 12,000".
String _kMoney(num amount) {
  final whole = amount.round().abs().toString();
  final buffer = StringBuffer();
  for (var i = 0; i < whole.length; i++) {
    if (i > 0 && (whole.length - i) % 3 == 0) buffer.write(',');
    buffer.write(whole[i]);
  }
  return '${amount < 0 ? '−' : ''}UGX $buffer';
}

/// 1234 → "1.2K".
String _kCompact(int value) {
  if (value >= 1000000) return '${(value / 1000000).toStringAsFixed(1)}M';
  if (value >= 1000) return '${(value / 1000).toStringAsFixed(1)}K';
  return '$value';
}

/// Strips HTML from a WooCommerce description for plain display.
String _kPlain(String? html) {
  if (html == null) return '';
  return html
      .replaceAll(RegExp(r'<br\s*/?>', caseSensitive: false), '\n')
      .replaceAll(RegExp(r'</p>', caseSensitive: false), '\n\n')
      .replaceAll(RegExp(r'<li[^>]*>', caseSensitive: false), '• ')
      .replaceAll(RegExp(r'<[^>]+>'), '')
      .replaceAll('&amp;', '&')
      .replaceAll('&nbsp;', ' ')
      .replaceAll(RegExp(r'&#0?39;|&#8217;'), "'")
      .replaceAll(RegExp(r'\n{3,}'), '\n\n')
      .trim();
}

// ------------------------------------------------------------
//  Models
// ------------------------------------------------------------

class _KOption {
  _KOption(this.name, this.value, this.image);
  final String name;
  final String? value; // a colour hex, when the shop set one
  final String? image;
}

class _KAttribute {
  _KAttribute(this.name, this.options);
  final String name;
  final List<_KOption> options;
}

class _KVariation {
  _KVariation({
    required this.id,
    required this.price,
    required this.regularPrice,
    required this.attributes,
    required this.inStock,
    this.image,
  });
  final int id;
  final double price;
  final double regularPrice;
  final Map<String, String> attributes;
  final bool inStock;
  final String? image;
}

class _KProduct {
  _KProduct({
    required this.id,
    required this.name,
    required this.price,
    required this.regularPrice,
    required this.image,
    required this.gallery,
    required this.stockStatus,
    required this.stockQuantity,
    required this.totalSales,
    required this.rating,
    required this.ratingCount,
    required this.categoryIds,
    required this.attributes,
    required this.variations,
    required this.shortDescription,
    required this.description,
  });

  final int id;
  final String name;
  final double price;
  final double regularPrice;
  final String image;
  final List<String> gallery;
  final String stockStatus;
  final int? stockQuantity;
  final int totalSales;
  final double rating;
  final int ratingCount;
  final List<int> categoryIds;
  final List<_KAttribute> attributes;
  final List<_KVariation> variations;
  final String shortDescription;
  final String description;

  bool get soldOut => stockStatus == 'outofstock';
  bool get reduced => regularPrice > price && price > 0;
  int get discount => reduced ? (((regularPrice - price) / regularPrice) * 100).floor() : 0;
  List<String> get photos => [image, ...gallery].where((url) => url.isNotEmpty).toSet().toList();

  static double _num(dynamic value) => value is num ? value.toDouble() : double.tryParse('$value') ?? 0;

  factory _KProduct.fromRow(Map<String, dynamic> row) {
    final attributes = <_KAttribute>[];
    for (final raw in (row['attributes'] is List ? row['attributes'] as List : const [])) {
      if (raw is! Map) continue;
      final options = <_KOption>[];
      for (final option in (raw['options'] is List ? raw['options'] as List : const [])) {
        if (option is Map) {
          options.add(_KOption('${option['name'] ?? ''}', option['value']?.toString(), option['image']?.toString()));
        } else {
          options.add(_KOption('$option', null, null));
        }
      }
      if (options.isNotEmpty) attributes.add(_KAttribute('${raw['name'] ?? ''}', options));
    }

    final variations = <_KVariation>[];
    for (final raw in (row['variations'] is List ? row['variations'] as List : const [])) {
      if (raw is! Map) continue;
      final attrs = <String, String>{};
      final rawAttributes = raw['attributes'];
      if (rawAttributes is Map) rawAttributes.forEach((key, value) => attrs['$key'] = '$value');
      variations.add(_KVariation(
        id: (raw['id'] as num?)?.toInt() ?? 0,
        price: _num(raw['price']),
        regularPrice: _num(raw['regular_price']),
        attributes: attrs,
        inStock: raw['is_in_stock'] != false,
        image: raw['image']?.toString(),
      ));
    }

    return _KProduct(
      id: (row['id'] as num).toInt(),
      name: '${row['name'] ?? ''}',
      price: _num(row['price']),
      regularPrice: _num(row['regular_price']),
      image: '${row['image'] ?? ''}',
      gallery: (row['gallery'] is List ? row['gallery'] as List : const []).map((url) => '$url').toList(),
      stockStatus: '${row['stock_status'] ?? 'instock'}',
      stockQuantity: (row['stock_quantity'] as num?)?.toInt(),
      totalSales: (row['total_sales'] as num?)?.toInt() ?? 0,
      rating: _num(row['average_rating']),
      ratingCount: (row['rating_count'] as num?)?.toInt() ?? 0,
      categoryIds: (row['category_ids'] is List ? row['category_ids'] as List : const []).map((id) => id is num ? id.toInt() : int.tryParse('$id') ?? 0).toList(),
      attributes: attributes,
      variations: variations,
      shortDescription: '${row['short_description'] ?? ''}',
      description: '${row['description'] ?? ''}',
    );
  }
}

class _KCategory {
  _KCategory({required this.id, required this.name, required this.slug, required this.parent, required this.count, this.image});
  final int id;
  final String name;
  final String slug;
  final int parent;
  final int count;
  final String? image;

  factory _KCategory.fromRow(Map<String, dynamic> row) => _KCategory(
        id: (row['id'] as num).toInt(),
        name: '${row['name'] ?? ''}',
        slug: '${row['slug'] ?? ''}',
        parent: (row['parent'] as num?)?.toInt() ?? 0,
        count: (row['count'] as num?)?.toInt() ?? 0,
        image: row['image']?.toString(),
      );
}

// ------------------------------------------------------------
//  Supabase queries
// ------------------------------------------------------------

SupabaseClient get _kSupa => Supabase.instance.client;

/// The columns a product card needs; the product page asks for '*'.
const String _kCardColumns =
    'id,name,price,regular_price,image,gallery,stock_status,stock_quantity,total_sales,average_rating,rating_count,category_ids,attributes,variations,short_description,description';

class _KApi {
  static List<_KCategory>? _categories;

  /// Every category with products in it (a category with none, or with only
  /// empty children, is left out so the app never shows an empty shelf).
  static Future<List<_KCategory>> categories({bool refresh = false}) async {
    if (_categories != null && !refresh) return _categories!;
    final rows = await _kSupa.from('categories').select().order('count', ascending: false);
    final all = (rows as List).map((row) => _KCategory.fromRow(row as Map<String, dynamic>)).toList();
    bool hasProducts(_KCategory category) =>
        category.count > 0 || all.any((child) => child.parent == category.id && hasProducts(child));
    _categories = all.where(hasProducts).toList();
    return _categories!;
  }

  static Future<List<_KCategory>> departments() async =>
      (await categories()).where((category) => category.parent == 0 && category.slug != 'uncategorized').toList();

  static Future<List<_KCategory>> childrenOf(int id) async =>
      (await categories()).where((category) => category.parent == id).toList();

  /// Products, newest first unless [order] says otherwise.
  static Future<List<_KProduct>> products({
    int? categoryId,
    bool onlyReduced = false,
    String order = 'date_created',
    bool ascending = false,
    String search = '',
    int offset = 0,
    int limit = 20,
    List<int> excludeIds = const [],
  }) async {
    var query = _kSupa.from('products').select(_kCardColumns).neq('stock_status', 'outofstock');
    if (categoryId != null) query = query.contains('category_ids', [categoryId]);
    if (onlyReduced) query = query.gt('discount_percent', 0);
    if (search.trim().isNotEmpty) query = query.ilike('name', '%${search.trim()}%');
    if (excludeIds.isNotEmpty) query = query.not('id', 'in', '(${excludeIds.join(',')})');
    final rows = await query.order(order, ascending: ascending).range(offset, offset + limit - 1);
    return (rows as List).map((row) => _KProduct.fromRow(row as Map<String, dynamic>)).toList();
  }

  static Future<_KProduct?> product(int id) async {
    final row = await _kSupa.from('products').select().eq('id', id).maybeSingle();
    return row == null ? null : _KProduct.fromRow(row);
  }
}

// ------------------------------------------------------------
//  Small hand-offs between screens, kept on the device
//  (so FlutterFlow's own Navigate To actions work too)
// ------------------------------------------------------------

class _KKeys {
  static const openProduct = 'kandi-open-product';
  static const shopCategory = 'kandi-shop-category';
  static const shopQuery = 'kandi-shop-query';
  static const shopSort = 'kandi-shop-sort';
  static const cart = 'kandi-cart-v2';
  static const address = 'kandi-address-id';
}

class _KNav {
  static Future<void> openProduct(BuildContext context, int id) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setInt(_KKeys.openProduct, id);
    if (!context.mounted) return;
    await Navigator.of(context).push(MaterialPageRoute(builder: (_) => const KandiProductScreen()));
  }

  /// Opens Shop already filtered to a category, a search or a sort.
  static Future<void> openShop(BuildContext context, {int? categoryId, String? query, String? sort}) async {
    final prefs = await SharedPreferences.getInstance();
    if (categoryId != null) await prefs.setInt(_KKeys.shopCategory, categoryId);
    if (query != null) await prefs.setString(_KKeys.shopQuery, query);
    if (sort != null) await prefs.setString(_KKeys.shopSort, sort);
    if (!context.mounted) return;
    await Navigator.of(context).push(MaterialPageRoute(builder: (_) => const KandiShopScreen()));
  }

  /// The bottom bar's tabs swap the screen rather than stacking it.
  static void tab(BuildContext context, int index) {
    const screens = <Widget>[
      KandiHomeScreen(),
      KandiShopScreen(),
      KandiRewardsScreen(),
      KandiCartScreen(),
      KandiAccountScreen(),
    ];
    Navigator.of(context).pushAndRemoveUntil(
      PageRouteBuilder(
        pageBuilder: (_, __, ___) => screens[index],
        transitionDuration: Duration.zero,
        reverseTransitionDuration: Duration.zero,
      ),
      (_) => false,
    );
  }
}

// ------------------------------------------------------------
//  The cart, kept on the device
// ------------------------------------------------------------

class _KCartLine {
  _KCartLine({
    required this.productId,
    required this.variationId,
    required this.name,
    required this.image,
    required this.price,
    required this.quantity,
    required this.options,
  });

  final int productId;
  final int variationId;
  final String name;
  final String image;
  final double price;
  int quantity;
  final Map<String, String> options;

  String get key => '$productId:$variationId:${options.entries.map((e) => '${e.key}=${e.value}').join('|')}';
  String get optionText => options.entries.map((e) => '${e.key}: ${e.value}').join(' · ');

  Map<String, dynamic> toJson() => {
        'product_id': productId,
        'variation_id': variationId,
        'name': name,
        'image': image,
        'price': price,
        'quantity': quantity,
        'options': options,
      };

  factory _KCartLine.fromJson(Map<String, dynamic> json) => _KCartLine(
        productId: (json['product_id'] as num).toInt(),
        variationId: (json['variation_id'] as num?)?.toInt() ?? 0,
        name: '${json['name'] ?? ''}',
        image: '${json['image'] ?? ''}',
        price: (json['price'] as num?)?.toDouble() ?? 0,
        quantity: (json['quantity'] as num?)?.toInt() ?? 1,
        options: (json['options'] is Map ? json['options'] as Map : const {}).map((k, v) => MapEntry('$k', '$v')),
      );
}

class _KCart extends ChangeNotifier {
  _KCart._();
  static final _KCart instance = _KCart._();

  final List<_KCartLine> lines = [];

  int get count => lines.fold(0, (sum, line) => sum + line.quantity);
  double get subtotal => lines.fold(0.0, (sum, line) => sum + line.price * line.quantity);

  /// Re-reads the basket from the device. Every screen keeps its own copy of
  /// this class, so the device is the one place the basket really lives, and
  /// each screen reads it fresh before showing or changing it.
  Future<void> load() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_KKeys.cart);
    if (raw != null) {
      try {
        lines
          ..clear()
          ..addAll((jsonDecode(raw) as List).map((e) => _KCartLine.fromJson(e as Map<String, dynamic>)));
      } catch (_) {}
    }
    notifyListeners();
  }

  Future<void> _save() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_KKeys.cart, jsonEncode(lines.map((line) => line.toJson()).toList()));
    notifyListeners();
  }

  Future<void> add(_KCartLine line) async {
    await load();
    final existing = lines.where((l) => l.key == line.key).toList();
    if (existing.isNotEmpty) {
      existing.first.quantity = (existing.first.quantity + line.quantity).clamp(1, 20);
    } else {
      lines.add(line);
    }
    await _save();
  }

  Future<void> setQuantity(_KCartLine line, int quantity) async {
    if (quantity <= 0) {
      lines.remove(line);
    } else {
      line.quantity = quantity.clamp(1, 20);
    }
    await _save();
  }

  Future<void> remove(_KCartLine line) async {
    lines.remove(line);
    await _save();
  }

  Future<void> clear() async {
    lines.clear();
    await _save();
  }
}

// ------------------------------------------------------------
//  Phone sign-in (Supabase Auth, SMS code)
// ------------------------------------------------------------

class _KAuth {
  static User? get user => _kSupa.auth.currentUser;
  static bool get signedIn => user != null;

  /// Signed in already, or signs in now through the sheet. True when signed in.
  static Future<bool> ensure(BuildContext context, {String reason = 'Sign in to continue'}) async {
    if (signedIn) return true;
    final ok = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _KPhoneSignInSheet(reason: reason),
    );
    return ok == true && signedIn;
  }

  /// "0772 123 456" / "772123456" / "+256772123456" → "+256772123456", or null.
  static String? ugPhone(String raw) {
    var digits = raw.replaceAll(RegExp(r'\D'), '');
    if (digits.startsWith('256')) digits = digits.substring(3);
    if (digits.startsWith('0')) digits = digits.substring(1);
    return RegExp(r'^7\d{8}$').hasMatch(digits) ? '+256$digits' : null;
  }
}

class _KPhoneSignInSheet extends StatefulWidget {
  const _KPhoneSignInSheet({super.key, this.reason = 'Sign in to continue'});
  final String reason;
  @override
  State<_KPhoneSignInSheet> createState() => _KPhoneSignInSheetState();
}

class _KPhoneSignInSheetState extends State<_KPhoneSignInSheet> {
  final _phone = TextEditingController();
  final _code = TextEditingController();
  String? _sentTo;
  bool _busy = false;
  String? _error;

  Future<void> _send() async {
    final phone = _KAuth.ugPhone(_phone.text);
    if (phone == null) {
      setState(() => _error = 'Enter an MTN or Airtel number, like 0772 123 456.');
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await _kSupa.auth.signInWithOtp(phone: phone);
      setState(() => _sentTo = phone);
    } on AuthException catch (e) {
      setState(() => _error = e.message);
    } catch (_) {
      setState(() => _error = 'Could not send the code. Check your connection and try again.');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _verify() async {
    final code = _code.text.trim();
    if (code.length < 4 || _sentTo == null) {
      setState(() => _error = 'Enter the code from the SMS.');
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await _kSupa.auth.verifyOTP(phone: _sentTo!, token: code, type: OtpType.sms);
      if (mounted) Navigator.of(context).pop(true);
    } on AuthException catch (e) {
      setState(() => _error = e.message);
    } catch (_) {
      setState(() => _error = 'That code did not work. Try again.');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final sent = _sentTo != null;
    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
      child: Container(
        padding: const EdgeInsets.fromLTRB(20, 12, 20, 24),
        decoration: const BoxDecoration(
          color: _KColors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
        ),
        child: SafeArea(
          top: false,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Center(
                child: Container(
                  width: 40,
                  height: 4,
                  decoration: BoxDecoration(color: _KColors.line, borderRadius: BorderRadius.circular(2)),
                ),
              ),
              const SizedBox(height: 18),
              Text(widget.reason,
                  style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w900, color: _KColors.ink, letterSpacing: -0.5)),
              const SizedBox(height: 6),
              Text(
                sent ? 'We sent a code to $_sentTo.' : 'We will text you a code. No password needed.',
                style: const TextStyle(fontSize: 14, color: _KColors.muted),
              ),
              const SizedBox(height: 18),
              if (!sent)
                _KField(
                  controller: _phone,
                  label: 'Phone number',
                  hint: '0772 123 456',
                  keyboard: TextInputType.phone,
                  prefix: '+256 ',
                )
              else
                _KField(
                  controller: _code,
                  label: 'Code',
                  hint: '6-digit code',
                  keyboard: TextInputType.number,
                ),
              if (_error != null) ...[
                const SizedBox(height: 10),
                Text(_error!, style: const TextStyle(color: _KColors.sale, fontSize: 13, fontWeight: FontWeight.w600)),
              ],
              const SizedBox(height: 18),
              _KButton(
                label: sent ? 'Sign in' : 'Send code',
                busy: _busy,
                onPressed: sent ? _verify : _send,
              ),
              if (sent)
                TextButton(
                  onPressed: _busy ? null : () => setState(() => _sentTo = null),
                  child: const Text('Use a different number', style: TextStyle(color: _KColors.ink)),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

// ------------------------------------------------------------
//  Building blocks
// ------------------------------------------------------------

class _KButton extends StatelessWidget {
  const _KButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.busy = false,
    this.dark = false,
    this.outline = false,
    this.icon,
  });

  final String label;
  final VoidCallback? onPressed;
  final bool busy;
  final bool dark;
  final bool outline;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    final background = outline ? _KColors.white : (dark ? _KColors.ink : _KColors.yellow);
    final foreground = dark && !outline ? _KColors.white : _KColors.ink;
    return SizedBox(
      width: double.infinity,
      height: 52,
      child: ElevatedButton(
        onPressed: busy ? null : onPressed,
        style: ElevatedButton.styleFrom(
          elevation: 0,
          backgroundColor: background,
          foregroundColor: foreground,
          disabledBackgroundColor: background.withOpacity(0.6),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(999),
            side: outline ? const BorderSide(color: _KColors.ink, width: 1.5) : BorderSide.none,
          ),
        ),
        child: busy
            ? SizedBox(
                width: 22,
                height: 22,
                child: CircularProgressIndicator(strokeWidth: 2.5, color: foreground),
              )
            : Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  if (icon != null) ...[Icon(icon, size: 20), const SizedBox(width: 8)],
                  Text(label, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800)),
                ],
              ),
      ),
    );
  }
}

class _KField extends StatelessWidget {
  const _KField({
    super.key,
    required this.controller,
    required this.label,
    this.hint,
    this.keyboard,
    this.prefix,
    this.maxLines = 1,
    this.onChanged,
  });

  final TextEditingController controller;
  final String label;
  final String? hint;
  final TextInputType? keyboard;
  final String? prefix;
  final int maxLines;
  final ValueChanged<String>? onChanged;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: _KColors.ink)),
        const SizedBox(height: 6),
        TextField(
          controller: controller,
          keyboardType: keyboard,
          maxLines: maxLines,
          onChanged: onChanged,
          style: const TextStyle(fontSize: 16, color: _KColors.ink),
          decoration: InputDecoration(
            hintText: hint,
            prefixText: prefix,
            filled: true,
            fillColor: _KColors.ground,
            contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: BorderSide.none),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(14),
              borderSide: const BorderSide(color: _KColors.ink, width: 1.5),
            ),
          ),
        ),
      ],
    );
  }
}

/// A product photo on the shop's grey, with white backgrounds blended in.
class _KPhoto extends StatelessWidget {
  const _KPhoto(this.url, {super.key, this.fit = BoxFit.cover, this.radius = 0});
  final String url;
  final BoxFit fit;
  final double radius;

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(radius),
      child: Container(
        color: _KColors.ground,
        child: url.isEmpty
            ? const Center(child: Icon(Icons.image_outlined, color: _KColors.muted))
            : CachedNetworkImage(
                imageUrl: url,
                fit: fit,
                width: double.infinity,
                height: double.infinity,
                color: _KColors.ground,
                colorBlendMode: BlendMode.multiply,
                fadeInDuration: const Duration(milliseconds: 150),
                errorWidget: (_, __, ___) => const Center(child: Icon(Icons.image_not_supported_outlined, color: _KColors.muted)),
              ),
      ),
    );
  }
}

/// The product tile used everywhere: photo, discount, name, price, sold.
class _KProductCard extends StatelessWidget {
  const _KProductCard(this.product, {super.key, this.width});
  final _KProduct product;
  final double? width;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () => _KNav.openProduct(context, product.id),
      child: Container(
        width: width,
        decoration: BoxDecoration(color: _KColors.white, borderRadius: BorderRadius.circular(14)),
        clipBehavior: Clip.antiAlias,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            AspectRatio(
              aspectRatio: 1,
              child: Stack(
                fit: StackFit.expand,
                children: [
                  _KPhoto(product.image),
                  if (product.discount > 0)
                    Positioned(
                      top: 0,
                      left: 0,
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                        decoration: const BoxDecoration(
                          color: _KColors.yellow,
                          borderRadius: BorderRadius.only(bottomRight: Radius.circular(10)),
                        ),
                        child: Text('-${product.discount}%',
                            style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w900, color: _KColors.ink)),
                      ),
                    ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(10, 8, 10, 10),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(product.name,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: _KColors.body)),
                  const SizedBox(height: 3),
                  Text(_kMoney(product.price),
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w900,
                        color: product.reduced ? _KColors.sale : _KColors.ink,
                      )),
                  Row(
                    children: [
                      if (product.reduced)
                        Flexible(
                          child: Text(_kMoney(product.regularPrice),
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(
                                  fontSize: 11, color: _KColors.muted, decoration: TextDecoration.lineThrough)),
                        ),
                      if (product.reduced && product.totalSales > 0) const SizedBox(width: 6),
                      if (product.totalSales > 0)
                        Text('${_kCompact(product.totalSales)} sold',
                            style: const TextStyle(fontSize: 11, color: _KColors.muted)),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// A titled, swipeable row of product cards, optionally on a colour.
class _KCarousel extends StatelessWidget {
  const _KCarousel({
    super.key,
    required this.title,
    required this.products,
    this.onSeeAll,
    this.background = _KColors.white,
    this.titleColor = _KColors.ink,
  });

  final String title;
  final List<_KProduct> products;
  final VoidCallback? onSeeAll;
  final Color background;
  final Color titleColor;

  @override
  Widget build(BuildContext context) {
    if (products.length < 3) return const SizedBox.shrink();
    return Container(
      margin: const EdgeInsets.fromLTRB(12, 0, 12, 12),
      padding: const EdgeInsets.fromLTRB(0, 14, 0, 14),
      decoration: BoxDecoration(color: background, borderRadius: BorderRadius.circular(20)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 14),
            child: Row(
              children: [
                Expanded(
                  child: Text(title,
                      style: TextStyle(fontSize: 22, fontWeight: FontWeight.w900, color: titleColor, letterSpacing: -0.5)),
                ),
                if (onSeeAll != null)
                  GestureDetector(
                    onTap: onSeeAll,
                    child: Text('See all ›', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: titleColor)),
                  ),
              ],
            ),
          ),
          const SizedBox(height: 12),
          SizedBox(
            height: 248,
            child: ListView.separated(
              padding: const EdgeInsets.symmetric(horizontal: 14),
              scrollDirection: Axis.horizontal,
              itemCount: products.length,
              separatorBuilder: (_, __) => const SizedBox(width: 10),
              itemBuilder: (_, index) => _KProductCard(products[index], width: 158),
            ),
          ),
        ],
      ),
    );
  }
}

/// A two-column grid of product cards as a sliver.
class _KProductGrid extends StatelessWidget {
  const _KProductGrid(this.products, {super.key});
  final List<_KProduct> products;

  @override
  Widget build(BuildContext context) {
    return SliverPadding(
      padding: const EdgeInsets.symmetric(horizontal: 12),
      sliver: SliverGrid(
        gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
          crossAxisCount: 2,
          mainAxisSpacing: 10,
          crossAxisSpacing: 10,
          childAspectRatio: 0.66,
        ),
        delegate: SliverChildBuilderDelegate(
          (_, index) => _KProductCard(products[index]),
          childCount: products.length,
        ),
      ),
    );
  }
}

/// The app's five tabs. Cart shows its count.
class _KBottomNav extends StatelessWidget {
  const _KBottomNav({super.key, required this.current});
  final int current;

  @override
  Widget build(BuildContext context) {
    const items = [
      (Icons.home_outlined, Icons.home, 'Home'),
      (Icons.grid_view_outlined, Icons.grid_view_rounded, 'Shop'),
      (Icons.stars_outlined, Icons.stars_rounded, 'Rewards'),
      (Icons.shopping_bag_outlined, Icons.shopping_bag, 'Cart'),
      (Icons.person_outline, Icons.person, 'Account'),
    ];
    return AnimatedBuilder(
      animation: _KCart.instance,
      builder: (context, _) => Container(
        decoration: const BoxDecoration(
          color: _KColors.white,
          border: Border(top: BorderSide(color: _KColors.line)),
        ),
        child: SafeArea(
          top: false,
          child: SizedBox(
            height: 62,
            child: Row(
              children: [
                for (var i = 0; i < items.length; i++)
                  Expanded(
                    child: InkWell(
                      onTap: i == current ? null : () => _KNav.tab(context, i),
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Badge(
                            isLabelVisible: i == 3 && _KCart.instance.count > 0,
                            label: Text('${_KCart.instance.count}'),
                            backgroundColor: _KColors.sale,
                            child: Icon(i == current ? items[i].$2 : items[i].$1,
                                color: i == current ? _KColors.ink : _KColors.muted, size: 26),
                          ),
                          const SizedBox(height: 2),
                          Text(items[i].$3,
                              style: TextStyle(
                                fontSize: 11,
                                fontWeight: i == current ? FontWeight.w800 : FontWeight.w500,
                                color: i == current ? _KColors.ink : _KColors.muted,
                              )),
                        ],
                      ),
                    ),
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// A grey placeholder block while data loads.
class _KSkeleton extends StatelessWidget {
  const _KSkeleton({super.key, this.height = 120, this.radius = 16});
  final double height;
  final double radius;
  @override
  Widget build(BuildContext context) => Container(
        height: height,
        margin: const EdgeInsets.fromLTRB(12, 0, 12, 12),
        decoration: BoxDecoration(color: _KColors.line, borderRadius: BorderRadius.circular(radius)),
      );
}

/// A centred message with an optional action, for empty and error states.
class _KEmpty extends StatelessWidget {
  const _KEmpty({super.key, required this.icon, required this.title, this.message, this.action, this.onAction});
  final IconData icon;
  final String title;
  final String? message;
  final String? action;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(32),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 72,
            height: 72,
            decoration: const BoxDecoration(color: _KColors.yellowSoft, shape: BoxShape.circle),
            child: Icon(icon, size: 34, color: _KColors.ink),
          ),
          const SizedBox(height: 16),
          Text(title,
              textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w900, color: _KColors.ink)),
          if (message != null) ...[
            const SizedBox(height: 6),
            Text(message!, textAlign: TextAlign.center, style: const TextStyle(fontSize: 14, color: _KColors.muted)),
          ],
          if (action != null) ...[
            const SizedBox(height: 18),
            SizedBox(width: 220, child: _KButton(label: action!, onPressed: onAction)),
          ],
        ],
      ),
    );
  }
}

/// A short message at the bottom of the screen.
void _kToast(BuildContext context, String message) {
  ScaffoldMessenger.of(context)
    ..hideCurrentSnackBar()
    ..showSnackBar(SnackBar(
      content: Text(message, style: const TextStyle(fontWeight: FontWeight.w600)),
      behavior: SnackBarBehavior.floating,
      backgroundColor: _KColors.ink,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
    ));
}
