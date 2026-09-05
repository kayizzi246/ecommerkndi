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
import 'package:url_launcher/url_launcher.dart';

// Navigation only.
import '/custom_code/widgets/kandi_seller_products_screen.dart';
import '/custom_code/widgets/kandi_seller_orders_screen.dart';
import '/custom_code/widgets/kandi_seller_payouts_screen.dart';

// ============================================================
//  KANDI — SELLER CENTRE
//
//  The other half of the marketplace: a trader's takings, their
//  stock and their orders. Reached from the account page.
//
//  Self-contained like every page here; the architecture is at
//  the head of kandi_home_screen.dart.
//
//  ---- A seller session is NOT a shopper session ----
//
//  The token lives under `kandi-seller-auth-v1`, separate from
//  the shopper's `kandi-auth-v1`, and that separation is
//  load-bearing rather than tidy.
//
//  They are different accounts on different endpoints: a seller
//  signs in at `/api/app/seller/login` with an email and a
//  password, and a shopper at `/api/app/auth/otp` with a code
//  texted or emailed to them. The tokens are not
//  interchangeable. Sharing one key would mean signing in as a
//  seller silently signed you out as a shopper — and worse,
//  would send a seller token to the customer orders endpoint,
//  which answers 401 and then clears it, logging the trader out
//  of a session they never noticed breaking.
//
//  Most sellers here are also shoppers. Both sessions coexist.
//
//  ---- What this page is for, and what it is not ----
//
//  It answers the three questions a trader opens their phone
//  to ask: what did I take, what is waiting to be sent, and is
//  anything out of stock. Those are read-only and they are
//  what a phone is good for.
//
//  Orders, products and commissions are full pages in the app —
//  see the three seller screens this one opens. They are
//  reading, plus one write: accepting an order, which is a
//  single boolean with no form behind it and happens when a
//  trader is in their shop rather than at a desk.
//
//  Adding a product and store settings are NOT here. They are
//  forms — a media picker, a variations table, a payout account
//  — and a cramped version of any of them on a phone is how a
//  seller publishes at the wrong price or types the wrong MoMo
//  number. Those open the website, which is built for them.
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

/// The seller session. Deliberately not the shopper's key — see the note above.
const String _sellerAuthKey = 'kandi-seller-auth-v1';
const String _sellerNameKey = 'kandi-seller-name';

String _money(num amount) {
  final whole = amount.round().toString();
  final out = StringBuffer();
  for (int i = 0; i < whole.length; i++) {
    if (i > 0 && (whole.length - i) % 3 == 0) out.write(',');
    out.write(whole[i]);
  }
  return 'UGX $out';
}

/// A trader's figures for the chosen range.
///
/// Every field is optional-by-default rather than required: these come from a
/// WordPress plugin, older installs of which do not send all of them, and a
/// dashboard that throws on a missing key is a dashboard that shows a trader
/// nothing because one number is absent.
class _KStats {
  const _KStats({
    this.revenue = 0,
    this.revenueChange = 0,
    this.orders = 0,
    this.ordersChange = 0,
    this.unitsSold = 0,
    this.commissionOwed = 0,
    this.payoutDue = 0,
    this.productsLive = 0,
    this.productsPending = 0,
    this.productsOutOfStock = 0,
    this.views,
  });

  final num revenue;
  final num revenueChange;
  final int orders;
  final num ordersChange;
  final int unitsSold;
  final num commissionOwed;
  final num payoutDue;
  final int productsLive;
  final int productsPending;
  final int productsOutOfStock;

  /// Null means "this install does not count views", which is different from
  /// zero — "counted, and nobody looked". A tile drawn for the first would tell
  /// a trader their listings are dead when they are not, so it is not drawn.
  final int? views;

  static _KStats from(dynamic json) {
    if (json is! Map) return const _KStats();
    num n(String key) => json[key] is num ? json[key] as num : 0;
    int i(String key) => json[key] is int ? json[key] as int : 0;
    return _KStats(
      revenue: n('revenue'),
      revenueChange: n('revenue_change'),
      orders: i('orders'),
      ordersChange: n('orders_change'),
      unitsSold: i('units_sold'),
      commissionOwed: n('commission_owed'),
      payoutDue: n('payout_due'),
      productsLive: i('products_live'),
      productsPending: i('products_pending'),
      productsOutOfStock: i('products_out_of_stock'),
      views: json['views'] is int ? json['views'] as int : null,
    );
  }
}

class KandiSellerScreen extends StatefulWidget {
  const KandiSellerScreen({super.key, this.width, this.height});

  final double? width;
  final double? height;

  @override
  State<KandiSellerScreen> createState() => _KandiSellerScreenState();
}

class _KandiSellerScreenState extends State<KandiSellerScreen> {
  final TextEditingController _email = TextEditingController();
  final TextEditingController _password = TextEditingController();

  bool _loading = true;
  bool _busy = false;
  bool _obscure = true;
  String? _token;
  String _store = '';
  String? _error;

  _KStats _stats = const _KStats();
  bool _statsFailed = false;
  String _range = '30d';

  @override
  void initState() {
    super.initState();
    _restore();
  }

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    super.dispose();
  }

  Future<void> _restore() async {
    String? token;
    String store = '';
    try {
      final prefs = await SharedPreferences.getInstance();
      token = prefs.getString(_sellerAuthKey);
      store = prefs.getString(_sellerNameKey) ?? '';
    } catch (_) {
      token = null;
    }

    if (!mounted) return;
    setState(() {
      _token = (token != null && token.isNotEmpty) ? token : null;
      _store = store;
      _loading = false;
    });

    if (_token != null) _loadStats();
  }

  Future<void> _signIn() async {
    final email = _email.text.trim();
    final password = _password.text;

    if (email.isEmpty || password.isEmpty) {
      setState(() => _error = 'Enter your email and your password.');
      return;
    }

    setState(() {
      _busy = true;
      _error = null;
    });

    dynamic data;
    int status = 0;
    try {
      final response = await http
          .post(
            Uri.parse('$_apiBase/api/app/seller/login'),
            headers: const {'Content-Type': 'application/json'},
            body: jsonEncode({'email': email, 'password': password}),
          )
          .timeout(const Duration(seconds: 25));
      status = response.statusCode;
      data = jsonDecode(response.body);
    } catch (_) {
      status = 0;
    }

    if (!mounted) return;

    if (status != 200 || data is! Map) {
      setState(() {
        _busy = false;
        // The server's wording where there is one: it knows whether this was a
        // wrong password, an unapproved seller or a locked account, and this
        // screen does not.
        _error = (data is Map && data['message'] != null)
            ? data['message'].toString()
            : 'Could not sign in. Check your details and your connection.';
      });
      return;
    }

    final token = (data['token'] ?? '').toString();
    if (token.isEmpty) {
      setState(() {
        _busy = false;
        _error = 'Signed in, but the shop did not return a session. Try again.';
      });
      return;
    }

    final seller = data['seller'];
    final store = (seller is Map)
        ? (seller['store_name'] ?? seller['name'] ?? '').toString()
        : '';

    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_sellerAuthKey, token);
      await prefs.setString(_sellerNameKey, store.isNotEmpty ? store : email);
    } catch (_) {
      // The session still works this run; it just will not survive a restart.
    }

    if (!mounted) return;
    setState(() {
      _busy = false;
      _token = token;
      _store = store.isNotEmpty ? store : email;
      _password.clear();
    });
    _loadStats();
  }

  Future<void> _loadStats() async {
    final token = _token;
    if (token == null) return;

    setState(() => _statsFailed = false);

    dynamic data;
    int status = 0;
    try {
      final response = await http.get(
        Uri.parse('$_apiBase/api/app/seller/stats?range=$_range'),
        headers: {'Authorization': 'Bearer $token'},
      ).timeout(const Duration(seconds: 20));
      status = response.statusCode;
      data = jsonDecode(response.body);
    } catch (_) {
      status = 0;
    }

    if (!mounted) return;

    if (status == 401 || status == 403) {
      // A token the shop no longer accepts is not a session. Clearing it puts
      // the trader back at the sign-in rather than leaving every request
      // failing identically with no way out.
      await _signOut(silent: true);
      return;
    }

    if (status != 200) {
      setState(() => _statsFailed = true);
      return;
    }

    setState(() => _stats = _KStats.from(data));
  }

  Future<void> _signOut({bool silent = false}) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.remove(_sellerAuthKey);
      await prefs.remove(_sellerNameKey);
    } catch (_) {}

    if (!mounted) return;
    setState(() {
      _token = null;
      _store = '';
      _stats = const _KStats();
    });

    if (silent) return;
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('Signed out of the Seller Centre.'),
        behavior: SnackBarBehavior.floating,
      ),
    );
  }

  Future<void> _openWeb(String path) async {
    try {
      final opened = await launchUrl(Uri.parse('$_apiBase$path'),
          mode: LaunchMode.externalApplication);
      if (opened || !mounted) return;
    } catch (_) {
      if (!mounted) return;
    }
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('Could not open the browser.'),
        behavior: SnackBarBehavior.floating,
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
          title: const Text('Seller Centre',
              style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w700,
                  color: Colors.white)),
          actions: [
            if (_token != null)
              IconButton(
                onPressed: () => _signOut(),
                tooltip: 'Sign out',
                icon: const Icon(Icons.logout_rounded, color: Colors.white),
              ),
          ],
        ),
        // A dashboard-shaped skeleton rather than a spinner — see `_Skeleton`.
        body: _loading
            ? const _Skeleton()
            : (_token == null ? _buildSignIn() : _buildDashboard()),
      ),
    );
  }

  Widget _buildSignIn() {
    return ListView(
      padding: const EdgeInsets.all(_KSpace.md),
      children: [
        Container(
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
                  Container(
                    width: 44,
                    height: 44,
                    decoration: const BoxDecoration(
                        color: _KColors.primarySoft, shape: BoxShape.circle),
                    child: const Icon(Icons.storefront_rounded,
                        size: 22, color: _KColors.primary),
                  ),
                  const SizedBox(width: _KSpace.md),
                  const Expanded(
                    child: Text('Sign in to sell',
                        style: TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.w800,
                            color: _KColors.ink)),
                  ),
                ],
              ),
              const SizedBox(height: _KSpace.sm),
              const Text(
                'Your seller account is separate from your shopping account. Signing in here does not sign you out as a shopper.',
                style:
                    TextStyle(fontSize: 13, height: 1.45, color: _KColors.body),
              ),
              const SizedBox(height: _KSpace.lg),
              _Field(
                controller: _email,
                label: 'Seller email',
                hint: 'you@yourstore.com',
                icon: Icons.mail_outline_rounded,
                keyboardType: TextInputType.emailAddress,
              ),
              const SizedBox(height: _KSpace.md),
              _Field(
                controller: _password,
                label: 'Password',
                hint: 'Your password',
                icon: Icons.lock_outline_rounded,
                obscure: _obscure,
                trailing: IconButton(
                  onPressed: () => setState(() => _obscure = !_obscure),
                  icon: Icon(
                      _obscure
                          ? Icons.visibility_outlined
                          : Icons.visibility_off_outlined,
                      size: 19,
                      color: _KColors.muted),
                ),
              ),
              if (_error != null) ...[
                const SizedBox(height: _KSpace.md),
                Container(
                  padding: const EdgeInsets.all(_KSpace.md),
                  decoration: BoxDecoration(
                    color: _KColors.warnSoft,
                    borderRadius: BorderRadius.circular(_rChip),
                  ),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Icon(Icons.error_outline_rounded,
                          size: 17, color: _KColors.warn),
                      const SizedBox(width: _KSpace.sm),
                      Expanded(
                        child: Text(_error!,
                            style: const TextStyle(
                                fontSize: 12.5,
                                height: 1.4,
                                color: _KColors.warn)),
                      ),
                    ],
                  ),
                ),
              ],
              const SizedBox(height: _KSpace.lg),
              SizedBox(
                width: double.infinity,
                height: 48,
                child: FilledButton(
                  onPressed: _busy ? null : _signIn,
                  style: FilledButton.styleFrom(
                    backgroundColor: _KColors.flame,
                    disabledBackgroundColor: _KColors.line,
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(_rPill)),
                  ),
                  child: Text(_busy ? 'Signing in…' : 'Sign in',
                      style: const TextStyle(
                          fontSize: 15, fontWeight: FontWeight.w700)),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: _KSpace.md),
        Container(
          padding: const EdgeInsets.all(_KSpace.lg),
          decoration: BoxDecoration(
            color: _KColors.panel,
            borderRadius: BorderRadius.circular(_rPanel),
            border: Border.all(color: _KColors.edge),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('Not selling yet?',
                  style: TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w800,
                      color: _KColors.ink)),
              const SizedBox(height: 4),
              const Text(
                'List your products alongside the shop. Every seller is vetted before they can list.',
                style:
                    TextStyle(fontSize: 13, height: 1.45, color: _KColors.body),
              ),
              const SizedBox(height: _KSpace.md),
              SizedBox(
                width: double.infinity,
                height: 46,
                child: OutlinedButton.icon(
                  onPressed: () => _openWeb('/sell'),
                  icon: const Icon(Icons.open_in_new_rounded, size: 18),
                  label: const Text('Become a seller',
                      style: TextStyle(
                          fontSize: 14.5, fontWeight: FontWeight.w700)),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: _KColors.ink,
                    side: const BorderSide(color: _KColors.line),
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(_rPill)),
                  ),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: _KSpace.xl),
      ],
    );
  }

  Widget _buildDashboard() {
    return RefreshIndicator(
      color: _KColors.primary,
      onRefresh: _loadStats,
      child: ListView(
        padding: const EdgeInsets.all(_KSpace.md),
        children: [
          Container(
            padding: const EdgeInsets.all(_KSpace.lg),
            decoration: BoxDecoration(
              color: _KColors.panel,
              borderRadius: BorderRadius.circular(_rPanel),
              border: Border.all(color: _KColors.edge),
            ),
            child: Row(
              children: [
                Container(
                  width: 48,
                  height: 48,
                  decoration: const BoxDecoration(
                      color: _KColors.primarySoft, shape: BoxShape.circle),
                  child: const Icon(Icons.storefront_rounded,
                      size: 24, color: _KColors.primary),
                ),
                const SizedBox(width: _KSpace.md),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('Signed in as',
                          style:
                              TextStyle(fontSize: 12, color: _KColors.muted)),
                      const SizedBox(height: 2),
                      Text(_store,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.w800,
                              color: _KColors.ink)),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: _KSpace.md),

          // The range picker. Three, not a date range: a trader on a phone
          // wants "this week" or "this month", and a calendar is a control
          // built for a desk.
          Row(
            children: [
              for (final option in const [
                (key: '7d', label: '7 days'),
                (key: '30d', label: '30 days'),
                (key: '90d', label: '90 days'),
              ])
                Padding(
                  padding: const EdgeInsets.only(right: _KSpace.sm),
                  child: GestureDetector(
                    onTap: () {
                      if (_range == option.key) return;
                      setState(() => _range = option.key);
                      _loadStats();
                    },
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: _KSpace.md, vertical: _KSpace.sm),
                      decoration: BoxDecoration(
                        color: _range == option.key
                            ? _KColors.flameSoft
                            : _KColors.panel,
                        // A pill, like every other filter in the app.
                        borderRadius: BorderRadius.circular(_rPill),
                        border: Border.all(
                            color: _range == option.key
                                ? _KColors.flame
                                : _KColors.line,
                            width: _range == option.key ? 1.5 : 1),
                      ),
                      child: Text(option.label,
                          style: TextStyle(
                              fontSize: 13,
                              fontWeight: _range == option.key
                                  ? FontWeight.w700
                                  : FontWeight.w500,
                              color: _KColors.ink)),
                    ),
                  ),
                ),
            ],
          ),
          const SizedBox(height: _KSpace.md),

          if (_statsFailed)
            Container(
              padding: const EdgeInsets.all(_KSpace.md),
              decoration: BoxDecoration(
                color: _KColors.warnSoft,
                borderRadius: BorderRadius.circular(_rChip),
              ),
              child: Row(
                children: [
                  const Icon(Icons.error_outline_rounded,
                      size: 17, color: _KColors.warn),
                  const SizedBox(width: _KSpace.sm),
                  const Expanded(
                    child: Text('Could not load your figures.',
                        style: TextStyle(fontSize: 12.5, color: _KColors.warn)),
                  ),
                  GestureDetector(
                    onTap: _loadStats,
                    child: const Text('Retry',
                        style: TextStyle(
                            fontSize: 12.5,
                            fontWeight: FontWeight.w800,
                            color: _KColors.warn)),
                  ),
                ],
              ),
            )
          else ...[
            Row(
              children: [
                Expanded(
                  child: _Tile(
                    label: 'Revenue',
                    value: _money(_stats.revenue),
                    change: _stats.revenueChange,
                  ),
                ),
                const SizedBox(width: _KSpace.md),
                Expanded(
                  child: _Tile(
                    label: 'Orders',
                    value: '${_stats.orders}',
                    change: _stats.ordersChange,
                  ),
                ),
              ],
            ),
            const SizedBox(height: _KSpace.md),
            Row(
              children: [
                Expanded(
                  child: _Tile(
                      label: 'Units sold', value: '${_stats.unitsSold}'),
                ),
                const SizedBox(width: _KSpace.md),
                Expanded(
                  child: _Tile(
                      label: 'Payout due', value: _money(_stats.payoutDue)),
                ),
              ],
            ),
            // Only drawn when the plugin actually counts views. Absent means
            // "not measured", which is different from nobody looking — see the
            // note on the field.
            if (_stats.views != null) ...[
              const SizedBox(height: _KSpace.md),
              _Tile(label: 'Product views', value: '${_stats.views}'),
            ],
            const SizedBox(height: _KSpace.md),
            _panel(
              title: 'Your listings',
              child: Column(
                children: [
                  _Line(
                      label: 'Live',
                      value: '${_stats.productsLive}',
                      tone: _KColors.save,
                      toneSoft: _KColors.saveSoft),
                  if (_stats.productsPending > 0)
                    _Line(
                        label: 'Awaiting approval',
                        value: '${_stats.productsPending}',
                        tone: _KColors.info,
                        toneSoft: _KColors.infoSoft),
                  // The one figure a trader has to act on today, so it is only
                  // shown when it is real and it is coloured as a warning.
                  if (_stats.productsOutOfStock > 0)
                    _Line(
                        label: 'Out of stock',
                        value: '${_stats.productsOutOfStock}',
                        tone: _KColors.warn,
                        toneSoft: _KColors.warnSoft),
                ],
              ),
            ),
            if (_stats.commissionOwed > 0) ...[
              const SizedBox(height: _KSpace.md),
              _panel(
                title: 'Commission',
                child: Row(
                  children: [
                    const Text('Owed to Kandi',
                        style:
                            TextStyle(fontSize: 13.5, color: _KColors.body)),
                    const Spacer(),
                    Text(_money(_stats.commissionOwed),
                        style: const TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.w800,
                            color: _KColors.ink)),
                  ],
                ),
              ),
            ],
          ],

          const SizedBox(height: _KSpace.md),
          // ---- What the app does, and what it hands to the website ----
          //
          // The split is by whether the task is READING or WRITING, not by
          // what was easiest to build.
          //
          // Orders, products and commissions are reading, plus one write —
          // accepting an order — that is a single boolean with no form behind
          // it. Those are the things a trader checks standing in their shop,
          // so they are native pages here.
          //
          // Adding a product and changing store settings are forms: a media
          // picker, a variations table, a payout account. A cramped version of
          // any of those on a phone is how a seller publishes at the wrong
          // price or types the wrong MoMo number, so they open the website,
          // which is built for them.
          _panel(
            title: 'Your shop',
            child: Column(
              children: [
                _Action(
                  icon: Icons.receipt_long_outlined,
                  label: 'Orders',
                  detail: 'Accept and pack what has sold',
                  external: false,
                  // Reloads on return: accepting an order changes the figures
                  // above, and a dashboard still showing the old ones after the
                  // trader just acted reads as the action not having worked.
                  onTap: () async {
                    await Navigator.of(context).push(MaterialPageRoute(
                        builder: (_) => const KandiSellerOrdersScreen()));
                    await _loadStats();
                  },
                ),
                const Divider(height: 1, color: _KColors.hairline),
                _Action(
                  icon: Icons.inventory_2_outlined,
                  label: 'Products',
                  detail: 'Stock, prices and what is out',
                  external: false,
                  onTap: () => Navigator.of(context).push(MaterialPageRoute(
                      builder: (_) => const KandiSellerProductsScreen())),
                ),
                const Divider(height: 1, color: _KColors.hairline),
                _Action(
                  icon: Icons.payments_outlined,
                  label: 'Commissions and payouts',
                  detail: 'What you are owed, order by order',
                  external: false,
                  onTap: () => Navigator.of(context).push(MaterialPageRoute(
                      builder: (_) => const KandiSellerPayoutsScreen())),
                ),
              ],
            ),
          ),
          const SizedBox(height: _KSpace.md),
          _panel(
            title: 'On the website',
            child: Column(
              children: [
                _Action(
                  icon: Icons.add_box_outlined,
                  label: 'Add a product',
                  detail: 'Needs photographs and a price',
                  onTap: () => _openWeb('/seller/products/new'),
                ),
                const Divider(height: 1, color: _KColors.hairline),
                _Action(
                  icon: Icons.settings_outlined,
                  label: 'Store settings',
                  detail: 'Payout account and store details',
                  onTap: () => _openWeb('/seller/settings'),
                ),
              ],
            ),
          ),
          const SizedBox(height: _KSpace.xl),
        ],
      ),
    );
  }

  Widget _panel({required String title, required Widget child}) {
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
          Text(title,
              style: const TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w800,
                  color: _KColors.ink)),
          const SizedBox(height: _KSpace.md),
          child,
        ],
      ),
    );
  }
}

class _Tile extends StatelessWidget {
  const _Tile({required this.label, required this.value, this.change});

  final String label;
  final String value;
  final num? change;

  @override
  Widget build(BuildContext context) {
    final movement = change;
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
          Text(label,
              style: const TextStyle(fontSize: 12, color: _KColors.muted)),
          const SizedBox(height: 6),
          Text(value,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                  fontSize: 19,
                  height: 1.1,
                  fontWeight: FontWeight.w800,
                  color: _KColors.ink)),
          // A change of exactly zero is not drawn: an arrow pointing sideways
          // at 0% is noise, and the absence says the same thing.
          if (movement != null && movement != 0) ...[
            const SizedBox(height: 5),
            Row(
              children: [
                Icon(
                  movement > 0
                      ? Icons.arrow_upward_rounded
                      : Icons.arrow_downward_rounded,
                  size: 13,
                  color: movement > 0 ? _KColors.save : _KColors.warn,
                ),
                const SizedBox(width: 2),
                Text(
                  '${movement.abs().toStringAsFixed(movement.abs() < 10 ? 1 : 0)}%',
                  style: TextStyle(
                      fontSize: 11.5,
                      fontWeight: FontWeight.w700,
                      color: movement > 0 ? _KColors.save : _KColors.warn),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}

class _Line extends StatelessWidget {
  const _Line({
    required this.label,
    required this.value,
    required this.tone,
    required this.toneSoft,
  });

  final String label;
  final String value;
  final Color tone;
  final Color toneSoft;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: _KSpace.sm),
      child: Row(
        children: [
          Text(label,
              style: const TextStyle(fontSize: 13.5, color: _KColors.body)),
          const Spacer(),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 3),
            decoration: BoxDecoration(
              color: toneSoft,
              borderRadius: BorderRadius.circular(6),
            ),
            child: Text(value,
                style: TextStyle(
                    fontSize: 13, fontWeight: FontWeight.w800, color: tone)),
          ),
        ],
      ),
    );
  }
}

class _Action extends StatelessWidget {
  const _Action({
    required this.icon,
    required this.label,
    required this.onTap,
    this.detail,
    this.external = true,
  });

  final IconData icon;
  final String label;
  final VoidCallback onTap;
  final String? detail;

  /// Whether tapping leaves the app.
  ///
  /// The trailing icon is the only warning a trader gets before the browser
  /// opens, so it has to be accurate: a chevron promises another screen in the
  /// app, and an out-arrow promises a browser. Getting the two the wrong way
  /// round is a small lie the shopper notices immediately.
  final bool external;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: _KSpace.md),
        child: Row(
          children: [
            Icon(icon, size: 20, color: _KColors.ink),
            const SizedBox(width: _KSpace.md),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(label,
                      style: const TextStyle(
                          fontSize: 14.5,
                          fontWeight: FontWeight.w600,
                          color: _KColors.ink)),
                  if (detail != null)
                    Text(detail!,
                        style: const TextStyle(
                            fontSize: 12, color: _KColors.muted)),
                ],
              ),
            ),
            Icon(
                external
                    ? Icons.open_in_new_rounded
                    : Icons.chevron_right_rounded,
                size: external ? 18 : 20,
                color: _KColors.muted),
          ],
        ),
      ),
    );
  }
}

class _Field extends StatelessWidget {
  const _Field({
    required this.controller,
    required this.label,
    required this.hint,
    required this.icon,
    this.keyboardType,
    this.obscure = false,
    this.trailing,
  });

  final TextEditingController controller;
  final String label;
  final String hint;
  final IconData icon;
  final TextInputType? keyboardType;
  final bool obscure;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label,
            style: const TextStyle(
                fontSize: 12.5,
                fontWeight: FontWeight.w600,
                color: _KColors.body)),
        const SizedBox(height: 5),
        TextField(
          controller: controller,
          keyboardType: keyboardType,
          obscureText: obscure,
          style: const TextStyle(fontSize: 14.5, color: _KColors.ink),
          decoration: InputDecoration(
            isDense: true,
            filled: true,
            fillColor: _KColors.hairline,
            hintText: hint,
            hintStyle: const TextStyle(fontSize: 14, color: _KColors.muted),
            prefixIcon: Icon(icon, size: 19, color: _KColors.muted),
            suffixIcon: trailing,
            contentPadding: const EdgeInsets.symmetric(
                horizontal: _KSpace.md, vertical: _KSpace.md),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(_rChip),
              borderSide: BorderSide.none,
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(_rChip),
              borderSide: const BorderSide(color: _KColors.flame, width: 1.4),
            ),
          ),
        ),
      ],
    );
  }
}

/// What the Seller Centre shows before the shop answers.
///
/// Shaped like the dashboard rather than like a list: one wide block for the
/// store header, then the stat grid. A trader opens this page to read four
/// figures, and a spinner in the middle of an empty screen tells them nothing
/// about whether those figures are two seconds away or gone. Same mechanism as
/// the home screen's skeleton.
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

  Widget _panel({required Widget child}) {
    return Container(
      padding: const EdgeInsets.all(_KSpace.lg),
      decoration: BoxDecoration(
        color: _KColors.panel,
        borderRadius: BorderRadius.circular(_rPanel),
        border: Border.all(color: _KColors.edge),
      ),
      child: child,
    );
  }

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(_KSpace.md),
      children: [
        _panel(
          child: Row(
            children: [
              _block(46, 46, 10),
              const SizedBox(width: _KSpace.md),
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _block(120, 16),
                  const SizedBox(height: 6),
                  _block(80, 12),
                ],
              ),
            ],
          ),
        ),
        const SizedBox(height: _KSpace.md),
        for (int row = 0; row < 2; row++) ...[
          Row(
            children: [
              for (int column = 0; column < 2; column++) ...[
                Expanded(
                  child: _panel(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        _block(70, 12),
                        const SizedBox(height: _KSpace.sm),
                        _block(110, 20),
                      ],
                    ),
                  ),
                ),
                if (column == 0) const SizedBox(width: _KSpace.md),
              ],
            ],
          ),
          const SizedBox(height: _KSpace.md),
        ],
      ],
    );
  }
}
