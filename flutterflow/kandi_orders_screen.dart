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

// Navigation only.
import '/custom_code/widgets/kandi_track_order_screen.dart';

// ============================================================
//  KANDI — ORDERS PAGE
//
//  What the shopper has bought. Self-contained like every page;
//  the architecture is at the head of kandi_home_screen.dart.
//
//  ---- The one page in the app that needs an account ----
//
//  `/api/app/account/orders` requires the bearer token the
//  account page stores. With no token this page does not show a
//  spinner or an error — it says plainly that orders live behind
//  a sign-in and sends the shopper to the account page.
//
//  A 401 from the server is treated the same way and clears the
//  stored token: a token the shop has stopped accepting is not
//  a session, and leaving it in place means every later request
//  fails the same way with no explanation.
// ============================================================

class _KColors {
  const _KColors._();
  static const Color canvas = Color(0xFFF5F5F5);
  static const Color panel = Color(0xFFFFFFFF);
  static const Color ink = Color(0xFF111827);
  static const Color body = Color(0xFF4B5563);
  static const Color muted = Color(0xFF6B7280);
  static const Color line = Color(0xFFE5E7EB);
  static const Color hairline = Color(0xFFF3F4F6);
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
}

class _KSpace {
  const _KSpace._();
  static const double sm = 8;
  static const double md = 12;
  static const double lg = 16;
  static const double xl = 24;
}

const double _rPanel = 12;

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

// The keys every page in this app agrees on.
const String _authKey = 'kandi-auth-v1';

String _money(num amount) {
  final whole = amount.round().toString();
  final out = StringBuffer();
  for (int i = 0; i < whole.length; i++) {
    if (i > 0 && (whole.length - i) % 3 == 0) out.write(',');
    out.write(whole[i]);
  }
  return 'UGX $out';
}

class _KOrder {
  const _KOrder({
    required this.number,
    required this.status,
    required this.total,
    required this.date,
    required this.itemCount,
  });

  final String number;
  final String status;
  final String total;
  final String date;
  final int itemCount;

  /// The colour a status is shown in.
  ///
  /// Grouped rather than mapped one-to-one: WooCommerce ships a dozen statuses
  /// and plugins add more, so an unknown one has to land somewhere sensible
  /// instead of rendering uncoloured. Delivered and completed are green,
  /// cancelled and failed are amber, everything else is "in progress" blue.
  Color get tone {
    final lower = status.toLowerCase();
    if (lower.contains('complete') || lower.contains('deliver')) {
      return _KColors.save;
    }
    if (lower.contains('cancel') ||
        lower.contains('fail') ||
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

  static _KOrder? from(dynamic json) {
    if (json is! Map) return null;

    // The customer API's field names have moved before, so each is read from
    // the first key that is present rather than one spelling. A missing number
    // is the only thing that makes a row undrawable.
    final number =
        (json['number'] ?? json['orderNumber'] ?? json['id'] ?? '').toString();
    if (number.isEmpty) return null;

    final items = json['items'];
    return _KOrder(
      number: number,
      status: (json['status'] ?? 'processing').toString(),
      total: (json['totalLabel'] ??
              json['total'] ??
              json['amount'] ??
              '')
          .toString(),
      date: (json['date'] ?? json['created'] ?? '').toString(),
      itemCount: items is List ? items.length : 0,
    );
  }

  static List<_KOrder> listFrom(dynamic json) {
    // The endpoint has returned both a bare list and `{orders: [...]}`, so both
    // are accepted rather than assuming one.
    final list = json is List
        ? json
        : (json is Map && json['orders'] is List)
            ? json['orders'] as List
            : const [];
    return list.map(_KOrder.from).whereType<_KOrder>().toList();
  }
}

class KandiOrdersScreen extends StatefulWidget {
  const KandiOrdersScreen({super.key, this.width, this.height});

  final double? width;
  final double? height;

  @override
  State<KandiOrdersScreen> createState() => _KandiOrdersScreenState();
}

class _KandiOrdersScreenState extends State<KandiOrdersScreen> {
  bool _loading = true;
  bool _signedOut = false;
  bool _failed = false;
  List<_KOrder> _orders = const [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    if (mounted) setState(() => _loading = true);

    String? token;
    try {
      final prefs = await SharedPreferences.getInstance();
      token = prefs.getString(_authKey);
    } catch (_) {
      token = null;
    }

    if (token == null || token.isEmpty) {
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
        Uri.parse('$_apiBase/api/app/account/orders'),
        headers: {'Authorization': 'Bearer $token'},
      ).timeout(const Duration(seconds: 20));
      status = response.statusCode;
      data = jsonDecode(response.body);
    } catch (_) {
      status = 0;
    }

    if (!mounted) return;

    if (status == 401 || status == 403) {
      // The token is no longer accepted. Clearing it is the honest response —
      // leaving it means every future request fails identically with no
      // explanation, and the shopper has no way to reach the sign-in.
      try {
        final prefs = await SharedPreferences.getInstance();
        await prefs.remove(_authKey);
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
      _signedOut = false;
      _orders = _KOrder.listFrom(data);
    });
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
          title: const Text('My orders',
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
    if (_loading) {
      // A skeleton of the right shape rather than a spinner. A spinner says
      // "something is happening"; three order-shaped blocks say "your orders
      // are arriving", and the list does not jump when they do. Same argument,
      // same mechanism as the home screen's.
      return const _Skeleton();
    }

    if (_signedOut) {
      return _message(
        icon: Icons.lock_outline_rounded,
        title: 'Sign in to see your orders',
        message:
            'Your orders are tied to your account. Everything else in the app — browsing, your basket, your saved items — works without one.',
        actionLabel: 'Go to account',
        // Back rather than a push: this page is reached FROM the account page,
        // and pushing a second copy would leave two on the stack.
        onAction: () => Navigator.of(context).maybePop(),
        // ---- The way out for most of this shop's customers ----
        //
        // Checkout does not require an account, so the majority of orders here
        // were never tied to one and never will be. Offering only "sign in"
        // tells those shoppers to create an account that still would not show
        // the order they are looking for. Tracking takes the order number and
        // the phone they ordered with, which they have.
        secondaryLabel: 'Track an order instead',
        onSecondary: () => Navigator.of(context).push(MaterialPageRoute(
            builder: (_) => const KandiTrackOrderScreen())),
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

    if (_orders.isEmpty) {
      return _message(
        icon: Icons.receipt_long_rounded,
        title: 'No orders yet',
        message: 'When you buy something it will appear here with its status.',
        actionLabel: 'Start shopping',
        onAction: () => Navigator.of(context).maybePop(),
      );
    }

    return RefreshIndicator(
      color: _KColors.primary,
      onRefresh: _load,
      child: ListView.separated(
        padding: const EdgeInsets.all(_KSpace.md),
        itemCount: _orders.length,
        separatorBuilder: (_, __) => const SizedBox(height: _KSpace.md),
        itemBuilder: (context, index) {
          final order = _orders[index];
          return Container(
            padding: const EdgeInsets.all(_KSpace.lg),
            decoration: BoxDecoration(
              color: _KColors.panel,
              borderRadius: BorderRadius.circular(_rPanel),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text('Order #${order.number}',
                          style: const TextStyle(
                              fontSize: 15,
                              fontWeight: FontWeight.w800,
                              color: _KColors.ink)),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 9, vertical: 4),
                      decoration: BoxDecoration(
                        color: order.toneSoft,
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Text(
                        order.status,
                        style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w800,
                            color: order.tone),
                      ),
                    ),
                  ],
                ),
                if (order.date.isNotEmpty) ...[
                  const SizedBox(height: 4),
                  Text(order.date,
                      style:
                          const TextStyle(fontSize: 12, color: _KColors.muted)),
                ],
                const SizedBox(height: _KSpace.md),
                Row(
                  children: [
                    if (order.itemCount > 0)
                      Text(
                        '${order.itemCount} ${order.itemCount == 1 ? 'item' : 'items'}',
                        style: const TextStyle(
                            fontSize: 13, color: _KColors.body),
                      ),
                    const Spacer(),
                    if (order.total.isNotEmpty)
                      Text(
                        // The API sends a formatted label on most builds and a
                        // bare number on some. A plain figure is formatted
                        // here so the two never render differently.
                        num.tryParse(order.total) != null
                            ? _money(num.parse(order.total))
                            : order.total,
                        style: const TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.w800,
                            color: _KColors.ink),
                      ),
                  ],
                ),
              ],
            ),
          );
        },
      ),
    );
  }

  Widget _message({
    required IconData icon,
    required String title,
    required String message,
    required String actionLabel,
    required VoidCallback onAction,
    String? secondaryLabel,
    VoidCallback? onSecondary,
  }) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(_KSpace.xl),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 76,
              height: 76,
              decoration: const BoxDecoration(
                  color: _KColors.primarySoft, shape: BoxShape.circle),
              child: Icon(icon, size: 34, color: _KColors.primary),
            ),
            const SizedBox(height: _KSpace.lg),
            Text(title,
                textAlign: TextAlign.center,
                style: const TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.w800,
                    color: _KColors.ink)),
            const SizedBox(height: _KSpace.sm),
            Text(message,
                textAlign: TextAlign.center,
                style: const TextStyle(
                    fontSize: 13.5, height: 1.5, color: _KColors.body)),
            const SizedBox(height: _KSpace.xl),
            SizedBox(
              width: 220,
              height: 48,
              child: FilledButton(
                onPressed: onAction,
                style: FilledButton.styleFrom(
                  backgroundColor: _KColors.flame,
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(_rPill)),
                ),
                child: Text(actionLabel,
                    style: const TextStyle(
                        fontSize: 15, fontWeight: FontWeight.w700)),
              ),
            ),
            if (secondaryLabel != null && onSecondary != null) ...[
              const SizedBox(height: _KSpace.md),
              // An outline, not a second filled button. Two filled buttons on
              // one empty state is two primary actions, and a shopper reading a
              // screen that has just told them something went wrong should not
              // also have to work out which button the shop meant.
              SizedBox(
                width: 220,
                height: 48,
                child: OutlinedButton(
                  onPressed: onSecondary,
                  style: OutlinedButton.styleFrom(
                    foregroundColor: _KColors.ink,
                    side: const BorderSide(color: _KColors.line),
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(_rPill)),
                  ),
                  child: Text(secondaryLabel,
                      style: const TextStyle(
                          fontSize: 14.5, fontWeight: FontWeight.w700)),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

/// What the screen shows before the first answer arrives.
///
/// A shimmering block of roughly the right shape rather than a spinner: a
/// spinner says "something is happening", a skeleton says "a list of orders is
/// arriving", and the second stops the layout jumping when it does. The same
/// widget the home screen uses, sized for order cards rather than for tiles.
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
      itemCount: 3,
      separatorBuilder: (_, __) => const SizedBox(height: _KSpace.md),
      itemBuilder: (_, __) => Container(
        padding: const EdgeInsets.all(_KSpace.lg),
        decoration: BoxDecoration(
          color: _KColors.panel,
          borderRadius: BorderRadius.circular(_rPanel),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                _block(120, 16),
                const Spacer(),
                _block(70, 18, 6),
              ],
            ),
            const SizedBox(height: _KSpace.sm),
            _block(90, 12),
            const SizedBox(height: _KSpace.lg),
            Row(
              children: [
                _block(60, 13),
                const Spacer(),
                _block(96, 18),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
