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

import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

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
  static const Color canvas = Color(0xFFF2F4F7);
  static const Color panel = Color(0xFFFFFFFF);
  static const Color ink = Color(0xFF111827);
  static const Color body = Color(0xFF4B5563);
  static const Color muted = Color(0xFF6B7280);
  static const Color primary = Color(0xFFFF6A00);
  static const Color primarySoft = Color(0xFFFFF3E8);
  static const Color save = Color(0xFF15803D);
  static const Color saveSoft = Color(0xFFECFDF3);
  static const Color warn = Color(0xFFB45309);
  static const Color warnSoft = Color(0xFFFDF3E6);
  static const Color info = Color(0xFF1A56C4);
  static const Color infoSoft = Color(0xFFEAF1FD);
}

class _KSpace {
  const _KSpace._();
  static const double sm = 8;
  static const double md = 12;
  static const double lg = 16;
  static const double xl = 24;
}

const double _rPanel = 14;
const double _rChip = 8;
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
          backgroundColor: _KColors.panel,
          surfaceTintColor: _KColors.panel,
          elevation: 0,
          scrolledUnderElevation: 0.5,
          iconTheme: const IconThemeData(color: _KColors.ink),
          title: const Text('My orders',
              style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w700,
                  color: _KColors.ink)),
        ),
        body: _buildBody(),
      ),
    );
  }

  Widget _buildBody() {
    if (_loading) {
      return const Center(
          child: CircularProgressIndicator(color: _KColors.primary));
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
                  backgroundColor: _KColors.primary,
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(_rChip)),
                ),
                child: Text(actionLabel,
                    style: const TextStyle(
                        fontSize: 15, fontWeight: FontWeight.w700)),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
