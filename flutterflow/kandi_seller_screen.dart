// Automatic FlutterFlow imports
// ---- Two boilerplate imports are deliberately absent ----
//
// FlutterFlow's generated header normally opens with
//
//     import '/backend/backend.dart';
//     import '/backend/supabase/supabase.dart';
//
// and this project has neither file. See the note at the head of
// kandi_design.dart — adding them back breaks the web build in every custom
// widget at once. Do not add them back.
import '/flutter_flow/flutter_flow_theme.dart';
import '/flutter_flow/flutter_flow_util.dart';
import '/custom_code/widgets/index.dart'; // Imports other custom widgets
import '/flutter_flow/custom_functions.dart'; // Imports custom functions
import 'package:flutter/material.dart';
// Begin custom widget code
// DO NOT REMOVE OR MODIFY THE CODE ABOVE!

// ---- Direct imports, rather than leaning on index.dart ----
//
// FlutterFlow's generated `/custom_code/widgets/index.dart` re-exports each
// custom widget with a `show <WidgetName>` clause — so it carries the WIDGET
// across files and nothing else. That is enough for the old screens, which
// only ever referenced each other's widget classes; it is not enough here,
// where every screen needs `KandiColors`, `KandiType`, `KandiCache` and the
// rest, none of which is a widget.
//
// Importing the sibling file directly takes the whole of it. Harmless if
// index.dart turns out to re-export everything, and essential if it does
// not — which is why it is done this way rather than assumed either way.
//
// The paths follow FlutterFlow's own naming: a custom widget called
// `KandiDesign` is written to `lib/custom_code/widgets/kandi_design.dart`.
// Name the widgets exactly as SETUP.md says or these paths will not resolve.
import '/custom_code/widgets/kandi_design.dart';

import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

// ============================================================
//  KANDI — SELLER CENTRE
//
//  The phone half of the Seller Centre: sign in as a seller,
//  then see what the shop owes you and what it is waiting for
//  you to pack.
//
//  TWO SESSIONS, DELIBERATELY SEPARATE
//  -----------------------------------------------------------
//  A seller signing in here does NOT sign the shopper out, and
//  the two tokens live under different keys. They are different
//  WordPress accounts with different permissions, and one person
//  routinely has both — a seller who shops on the same handset
//  must not have their basket and order history swapped out from
//  under them because they checked a payout.
//
//  This is why `KandiSellerSession` exists beside `KandiAuth`
//  rather than reusing it.
//
//  WHY THE APP HAS ITS OWN ENDPOINTS
//  -----------------------------------------------------------
//  `/api/app/seller/*` rather than `/api/seller/*`. The
//  website's routes keep the session in an httpOnly cookie,
//  which Dart's HTTP client does not persist — a cookie sign-in
//  would succeed and be forgotten before the next request. The
//  app routes hand the token back in the body instead, exactly
//  as the shopper sign-in already does.
//
//  WHAT IS NOT HERE, AND WHY
//  -----------------------------------------------------------
//  Editing listings. The dashboard reads; adding and pricing
//  products happens on the web, where the photograph upload and
//  the review queue already live. The screen SAYS so rather than
//  showing a dead button — a tap that does nothing is a bug
//  report, and a sentence naming where the feature lives is an
//  instruction.
// ============================================================

/// The signed-in seller, on this device.
///
/// Keys are prefixed `kandi_seller_` and share nothing with the shopper's
/// `kandi_auth_*`. See the note at the head of this file.
class KandiSellerSession {
  KandiSellerSession._();

  static const String _tokenKey = 'kandi_seller_token';
  static const String _expiresKey = 'kandi_seller_expires';
  static const String _sellerKey = 'kandi_seller_record';

  static final ValueNotifier<bool> signedIn = ValueNotifier<bool>(false);

  static String? _token;
  static Map<String, dynamic>? _seller;
  static bool _loaded = false;

  static Map<String, dynamic>? get seller => _seller;
  static bool get isActive => (_token ?? '').isNotEmpty;

  static Future<void> load() async {
    if (_loaded) return;
    _loaded = true;

    try {
      final prefs = await SharedPreferences.getInstance();

      // Expired locally is signed out, without asking the server. A screen
      // that renders a dashboard and then throws it away when the first
      // request comes back 401 is worse than one that never drew it.
      final expires = prefs.getInt(_expiresKey) ?? 0;
      if (expires > 0 && DateTime.now().millisecondsSinceEpoch > expires) {
        await clear();
        return;
      }

      _token = prefs.getString(_tokenKey);
      final raw = prefs.getString(_sellerKey);
      if (raw != null && raw.isNotEmpty) {
        final decoded = jsonDecode(raw);
        if (decoded is Map) _seller = Map<String, dynamic>.from(decoded);
      }
    } catch (_) {
      _token = null;
    }

    signedIn.value = isActive;
  }

  static Future<void> save({
    required String token,
    required int expiresIn,
    Map<String, dynamic>? seller,
  }) async {
    _token = token;
    _seller = seller;
    _loaded = true;

    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_tokenKey, token);
      await prefs.setInt(
        _expiresKey,
        DateTime.now().millisecondsSinceEpoch + expiresIn * 1000,
      );
      if (seller != null) {
        await prefs.setString(_sellerKey, jsonEncode(seller));
      }
    } catch (_) {}

    signedIn.value = true;
  }

  static Future<void> clear() async {
    _token = null;
    _seller = null;
    _loaded = true;
    signedIn.value = false;

    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.remove(_tokenKey);
      await prefs.remove(_expiresKey);
      await prefs.remove(_sellerKey);
    } catch (_) {}

    KandiCache.invalidate('seller:stats');
    KandiCache.invalidate('seller:orders');
  }

  static Map<String, String> get headers => {
        'Content-Type': 'application/json',
        if ((_token ?? '').isNotEmpty) 'Authorization': 'Bearer $_token',
      };
}

/// One call to the Seller Centre.
///
/// A 401 clears the session as it passes: the token is gone or revoked, and
/// carrying on with it produces four more 401s and a dashboard full of zeroes.
Future<({int status, dynamic data})> _sellerCall(String path) async {
  final result = await KandiApi.get(
    '/api/app/seller$path',
    headers: KandiSellerSession.headers,
  );
  if (result.status == 401) await KandiSellerSession.clear();
  return result;
}

// ============================================================
//  THE ENTRY POINT
// ============================================================

/// One screen that decides between the sign-in form and the dashboard.
///
/// The caller does not have to know which — and would get it wrong the first
/// time a token expired.
/// Seller Centre — sign in, and the numbers a seller checks daily.
///
/// The things this deliberately does NOT do — adding products, uploading
/// documents, paying the joining fee — open kandiug.com in the phone's
/// browser. That used to be an `onOpenWeb` callback for a page to fill in;
/// [KandiNav.openUrl] does it here, so an unwired parameter can no longer
/// leave a seller looking at a button that does nothing.
class KandiSellerScreen extends StatefulWidget {
  const KandiSellerScreen({super.key, this.width, this.height});

  final double? width;
  final double? height;

  @override
  State<KandiSellerScreen> createState() => _KandiSellerScreenState();
}

class _KandiSellerScreenState extends State<KandiSellerScreen> {
  bool _booting = true;

  @override
  void initState() {
    super.initState();
    KandiSellerSession.load().then((_) {
      if (mounted) setState(() => _booting = false);
    });
  }

  @override
  Widget build(BuildContext context) {
    if (_booting) {
      return Container(
        width: widget.width,
        height: widget.height,
        color: KandiColors.page,
        child: const Center(
          child: CircularProgressIndicator(
              strokeWidth: 2, color: KandiColors.primary),
        ),
      );
    }

    return ValueListenableBuilder<bool>(
      valueListenable: KandiSellerSession.signedIn,
      builder: (context, signedIn, _) {
        return signedIn
            ? _SellerDashboard(width: widget.width, height: widget.height)
            : _SellerSignIn(width: widget.width, height: widget.height);
      },
    );
  }
}

// ============================================================
//  SIGN IN
// ============================================================

class _SellerSignIn extends StatefulWidget {
  const _SellerSignIn({this.width, this.height});

  final double? width;
  final double? height;

  @override
  State<_SellerSignIn> createState() => _SellerSignInState();
}

class _SellerSignInState extends State<_SellerSignIn> {
  final _email = TextEditingController();
  final _password = TextEditingController();

  bool _busy = false;
  bool _obscure = true;
  String? _error;

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final email = _email.text.trim();
    if (email.isEmpty || _password.text.isEmpty) {
      setState(() => _error = 'Enter your email and your password.');
      return;
    }

    FocusScope.of(context).unfocus();
    setState(() {
      _busy = true;
      _error = null;
    });

    final result = await KandiApi.post(
      '/api/app/seller/login',
      body: {'email': email, 'password': _password.text},
    );

    if (!mounted) return;

    if (result.status == 0) {
      setState(() {
        _busy = false;
        _error = 'Could not reach Kandi. Check your connection.';
      });
      return;
    }

    final data = result.data;
    if (result.status != 200 || data is! Map || data['token'] is! String) {
      setState(() {
        _busy = false;
        _error = KandiApi.message(data, 'Could not sign you in.');
      });
      return;
    }

    await KandiSellerSession.save(
      token: data['token'] as String,
      expiresIn: data['expires_in'] is num
          ? (data['expires_in'] as num).toInt()
          : 60 * 60 * 24 * 14,
      seller: data['seller'] is Map
          ? Map<String, dynamic>.from(data['seller'] as Map)
          : null,
    );

    if (mounted) setState(() => _busy = false);
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      width: widget.width,
      height: widget.height,
      color: KandiColors.page,
      child: Scaffold(
        backgroundColor: KandiColors.page,
        appBar: kandiAppBar(context, 'Seller Centre'),
        body: ListView(
          padding: const EdgeInsets.all(KandiSpace.gutter),
          children: [
            const SizedBox(height: KandiSpace.sm),
            Container(
              width: 54,
              height: 54,
              decoration: const BoxDecoration(
                color: KandiColors.primarySoft,
                borderRadius: KandiRadius.md,
              ),
              child: const Icon(Icons.storefront_rounded,
                  size: 26, color: KandiColors.primary),
            ),
            const SizedBox(height: KandiSpace.lg),
            Text('Sign in to your store', style: KandiType.display()),
            const SizedBox(height: KandiSpace.sm),
            Text(
              'See your orders, your payouts and what needs packing.',
              style: KandiType.bodyText(),
            ),
            const SizedBox(height: KandiSpace.xl),

            KandiCard(
              child: Column(
                children: [
                  _field(_email, 'Email address',
                      keyboard: TextInputType.emailAddress),
                  const SizedBox(height: KandiSpace.md),
                  _field(
                    _password,
                    'Password',
                    obscure: _obscure,
                    trailing: IconButton(
                      onPressed: () => setState(() => _obscure = !_obscure),
                      icon: Icon(
                        _obscure
                            ? Icons.visibility_outlined
                            : Icons.visibility_off_outlined,
                        size: 19,
                        color: KandiColors.muted,
                      ),
                    ),
                  ),
                ],
              ),
            ),

            if (_error != null) ...[
              const SizedBox(height: KandiSpace.md),
              Container(
                padding: const EdgeInsets.all(KandiSpace.md),
                decoration: BoxDecoration(
                  color: KandiColors.saleSoft,
                  borderRadius: KandiRadius.md,
                ),
                child: Text(_error!,
                    style: KandiType.label(color: KandiColors.sale)),
              ),
            ],

            const SizedBox(height: KandiSpace.lg),
            KandiButton(
              label: 'Sign in',
              busy: _busy,
              onPressed: _busy ? null : _submit,
            ),

            const SizedBox(height: KandiSpace.xl),
            const Divider(height: 1, color: KandiColors.line),
            const SizedBox(height: KandiSpace.lg),

            Text('New to Kandi?', style: KandiType.title()),
            const SizedBox(height: KandiSpace.xs),
            Text(
              // Says plainly what the app does and does not do. The documents
              // and the joining fee live in the onboarding gate on the web,
              // which the dashboard cannot be reached past — so promising a
              // full sign-up here would strand somebody halfway.
              'Opening a store takes a few minutes. Documents and the joining '
              'fee are collected on the web.',
              style: KandiType.bodyText(),
            ),
            const SizedBox(height: KandiSpace.md),
            KandiButton(
              label: 'Open a store',
              tone: KandiButtonTone.outline,
              onPressed: () => KandiNav.openUrl(
                context,
                '$kandiApiBase/seller/register',
              ),
            ),
            const SizedBox(height: KandiSpace.xxl),
          ],
        ),
      ),
    );
  }

  Widget _field(
    TextEditingController controller,
    String label, {
    bool obscure = false,
    TextInputType? keyboard,
    Widget? trailing,
  }) {
    return TextField(
      controller: controller,
      obscureText: obscure,
      keyboardType: keyboard,
      style: KandiType.bodyText(color: KandiColors.ink),
      onSubmitted: (_) => _submit(),
      decoration: InputDecoration(
        labelText: label,
        labelStyle: KandiType.label(color: KandiColors.muted),
        suffixIcon: trailing,
        filled: true,
        fillColor: KandiColors.hairline,
        contentPadding: const EdgeInsets.all(KandiSpace.md),
        border: const OutlineInputBorder(
          borderRadius: KandiRadius.md,
          borderSide: BorderSide.none,
        ),
        enabledBorder: const OutlineInputBorder(
          borderRadius: KandiRadius.md,
          borderSide: BorderSide.none,
        ),
        focusedBorder: const OutlineInputBorder(
          borderRadius: KandiRadius.md,
          borderSide: BorderSide(color: KandiColors.primary, width: 1.5),
        ),
      ),
    );
  }
}

// ============================================================
//  THE DASHBOARD
// ============================================================

class _SellerDashboard extends StatefulWidget {
  const _SellerDashboard({this.width, this.height});

  final double? width;
  final double? height;

  @override
  State<_SellerDashboard> createState() => _SellerDashboardState();
}

class _SellerDashboardState extends State<_SellerDashboard> {
  Map<String, dynamic>? _stats = KandiCache.peek<Map<String, dynamic>>(
    'seller:stats',
  );
  List<Map<String, dynamic>> _orders =
      KandiCache.peek<List<Map<String, dynamic>>>('seller:orders') ?? const [];

  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    if (mounted) setState(() => _error = null);

    // Both at once. They are independent reads on a shared host where a single
    // call runs the best part of a second — sequentially this screen would
    // take twice as long to draw for no reason.
    final results = await Future.wait([
      _sellerCall('/stats'),
      _sellerCall('/orders?per_page=5'),
    ]);

    if (!mounted) return;

    final stats = results[0];
    final orders = results[1];

    // A 401 on either has already cleared the session inside `_sellerCall`,
    // and the parent is listening — so this screen is about to be replaced by
    // the sign-in form and should not also draw an error over itself.
    if (stats.status == 401 || orders.status == 401) return;

    setState(() {
      _loading = false;

      if (stats.status == 200 && stats.data is Map) {
        _stats = Map<String, dynamic>.from(stats.data as Map);
        // Stored, so the next visit paints from memory on its first frame.
        // This used to call `invalidate`, which is the opposite: the screen
        // seeded itself from `peek` and nothing ever wrote the key, so the seed
        // could never hit and the dashboard always opened on a spinner.
        KandiCache.write('seller:stats', _stats);
      } else if (stats.status == 0) {
        _error = 'Could not reach Kandi. Check your connection.';
      } else {
        _error = KandiApi.message(stats.data, 'Could not load your dashboard.');
      }

      final payload = orders.data;
      final list = payload is Map ? payload['orders'] : payload;
      if (list is List) {
        _orders = list
            .whereType<Map>()
            .map((o) => Map<String, dynamic>.from(o))
            .toList();
        KandiCache.write('seller:orders', _orders);
      }
    });
  }

  num _n(String key) {
    final value = _stats?[key];
    return value is num ? value : 0;
  }

  @override
  Widget build(BuildContext context) {
    final seller = KandiSellerSession.seller;
    final storeName = (seller?['store_name'] ?? 'Your store').toString();
    final status = (seller?['status'] ?? '').toString();

    return Container(
      width: widget.width,
      height: widget.height,
      color: KandiColors.page,
      child: Scaffold(
        backgroundColor: KandiColors.page,
        appBar: kandiAppBar(
          context,
          'Seller Centre',
          actions: [
            IconButton(
              onPressed: _confirmSignOut,
              tooltip: 'Sign out of your store',
              icon: const Icon(Icons.logout_rounded,
                  size: 20, color: KandiColors.ink),
            ),
          ],
        ),
        body: _loading && _stats == null
            ? const Center(
                child: CircularProgressIndicator(
                    strokeWidth: 2, color: KandiColors.primary),
              )
            : RefreshIndicator(
                color: KandiColors.primary,
                onRefresh: _load,
                child: ListView(
                  padding: const EdgeInsets.all(KandiSpace.gutter),
                  children: [
                    _storeHeader(storeName, status),
                    if (_error != null) ...[
                      const SizedBox(height: KandiSpace.md),
                      _errorCard(),
                    ],
                    const SizedBox(height: KandiSpace.md),
                    _payout(),
                    const SizedBox(height: KandiSpace.md),
                    _figures(),
                    const SizedBox(height: KandiSpace.md),
                    _listings(),
                    const SizedBox(height: KandiSpace.md),
                    _recentOrders(),
                    const SizedBox(height: KandiSpace.xxl),
                  ],
                ),
              ),
      ),
    );
  }

  Widget _storeHeader(String storeName, String status) {
    // Only the states a seller can ACT on get a badge. A green "approved" chip
    // on every screen is a sticker; the three that matter are the ones that
    // stop listings being visible, and those must be impossible to miss.
    final warn =
        status == 'pending' || status == 'suspended' || status == 'unpaid';

    return KandiCard(
      child: Row(
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: const BoxDecoration(
              color: KandiColors.primarySoft,
              borderRadius: KandiRadius.md,
            ),
            child: const Icon(Icons.storefront_rounded,
                size: 22, color: KandiColors.primary),
          ),
          const SizedBox(width: KandiSpace.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  storeName,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: KandiType.heading(),
                ),
                const SizedBox(height: 2),
                Text(
                  warn
                      ? switch (status) {
                          'unpaid' =>
                            'Monthly fee due — your listings are hidden',
                          'pending' =>
                            'Awaiting review — listings are not live yet',
                          _ => 'Suspended — contact support',
                        }
                      : 'Open for orders',
                  maxLines: 2,
                  style: KandiType.caption(
                    color: warn ? KandiColors.sale : KandiColors.success,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _errorCard() {
    return Container(
      padding: const EdgeInsets.all(KandiSpace.md),
      decoration: BoxDecoration(
        color: KandiColors.saleSoft,
        borderRadius: KandiRadius.md,
      ),
      child: Row(
        children: [
          const Icon(Icons.error_outline_rounded,
              size: 18, color: KandiColors.sale),
          const SizedBox(width: KandiSpace.sm),
          Expanded(
            child:
                Text(_error!, style: KandiType.label(color: KandiColors.sale)),
          ),
          GestureDetector(
            onTap: _load,
            child: Text(
              'Retry',
              style: KandiType.label(color: KandiColors.sale)
                  .copyWith(fontWeight: FontWeight.w700),
            ),
          ),
        ],
      ),
    );
  }

  /// The figure a seller opens this screen for.
  ///
  /// Given a whole card rather than a tile in the grid, because "what am I
  /// owed" is the question and the rest of the dashboard is context for it.
  Widget _payout() {
    return Container(
      padding: const EdgeInsets.all(KandiSpace.lg),
      decoration: BoxDecoration(
        color: KandiColors.band,
        borderRadius: KandiRadius.md,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'PAYOUT DUE',
            style: KandiType.micro(
              color: const Color(0x8CFFFFFF),
              weight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: KandiSpace.sm),
          Text(
            kandiPrice(_n('payout_due')),
            style: KandiType.price(size: 30, color: Colors.white),
          ),
          const SizedBox(height: KandiSpace.md),
          Row(
            children: [
              Expanded(
                child: _darkStat(
                    'Commission owed', kandiPrice(_n('commission_owed'))),
              ),
              Container(width: 1, height: 30, color: const Color(0x3DFFFFFF)),
              Expanded(
                child: _darkStat(
                    'Paid to date', kandiPrice(_n('commission_paid'))),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _darkStat(String label, String value) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label,
            style: KandiType.micro(
                color: const Color(0x8CFFFFFF), weight: FontWeight.w400)),
        const SizedBox(height: 2),
        Text(value, style: KandiType.price(size: 14, color: Colors.white)),
      ],
    );
  }

  Widget _figures() {
    return Row(
      children: [
        Expanded(
          child: _figure('Revenue', kandiPrice(_n('revenue')),
              _n('revenue_change').toDouble()),
        ),
        const SizedBox(width: KandiSpace.sm),
        Expanded(
          child: _figure('Orders', _n('orders').toString(),
              _n('orders_change').toDouble()),
        ),
      ],
    );
  }

  Widget _figure(String label, String value, double change) {
    final up = change > 0;
    final flat = change == 0;

    return KandiCard(
      padding: const EdgeInsets.all(KandiSpace.md),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: KandiType.caption()),
          const SizedBox(height: KandiSpace.xs),
          Text(
            value,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: KandiType.price(size: 18),
          ),
          const SizedBox(height: KandiSpace.xs),
          // No arrow at all when nothing moved. A grey "0%" beside a flat dash
          // is three pieces of furniture saying nothing happened.
          if (!flat)
            Row(
              children: [
                Icon(
                  up ? Icons.trending_up_rounded : Icons.trending_down_rounded,
                  size: 14,
                  color: up ? KandiColors.success : KandiColors.sale,
                ),
                const SizedBox(width: 3),
                Text(
                  '${change.abs().toStringAsFixed(0)}%',
                  style: KandiType.micro(
                    color: up ? KandiColors.success : KandiColors.sale,
                    weight: FontWeight.w700,
                  ),
                ),
              ],
            ),
        ],
      ),
    );
  }

  Widget _listings() {
    final pending = _n('products_pending');
    final out = _n('products_out_of_stock');

    return KandiCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Listings', style: KandiType.heading()),
          const SizedBox(height: KandiSpace.md),
          Wrap(
            spacing: KandiSpace.sm,
            runSpacing: KandiSpace.sm,
            children: [
              KandiChip(
                label: '${_n('products_live')} live',
                background: KandiColors.successSoft,
                foreground: KandiColors.success,
              ),
              if (pending > 0)
                KandiChip(
                  label: '$pending pending',
                  background: KandiColors.primarySoft,
                  foreground: KandiColors.primaryInk,
                ),
              if (out > 0)
                KandiChip(
                  label: '$out out of stock',
                  background: KandiColors.saleSoft,
                  foreground: KandiColors.sale,
                ),
            ],
          ),
          const SizedBox(height: KandiSpace.md),
          // Editing listings is not in the app, and the screen says where it
          // is rather than showing a dead button. A tap that does nothing is a
          // bug report; a sentence naming the place is an instruction.
          InkWell(
            onTap: () => KandiNav.openUrl(
              context,
              '$kandiApiBase/seller/products',
            ),
            borderRadius: KandiRadius.sm,
            child: Row(
              children: [
                Expanded(
                  child: Text(
                    'Add and edit products on kandiug.com',
                    style: KandiType.caption(),
                  ),
                ),
                const Icon(Icons.open_in_new_rounded,
                    size: 15, color: KandiColors.muted),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _recentOrders() {
    return KandiCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Recent orders', style: KandiType.heading()),
          const SizedBox(height: KandiSpace.md),
          if (_orders.isEmpty)
            Text('No orders yet.', style: KandiType.bodyText())
          else
            for (final order in _orders) ...[
              _orderRow(order),
              if (order != _orders.last)
                const Padding(
                  padding: EdgeInsets.symmetric(vertical: KandiSpace.md),
                  child: Divider(height: 1, color: KandiColors.hairline),
                ),
            ],
        ],
      ),
    );
  }

  Widget _orderRow(Map<String, dynamic> order) {
    final number = (order['number'] ?? order['id'] ?? '').toString();
    final customer = (order['customer'] ?? '').toString();
    final city = (order['city'] ?? '').toString();
    final status = (order['status'] ?? '').toString();
    final net = order['net_payout'];

    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('#$number', style: KandiType.title()),
              const SizedBox(height: 2),
              Text(
                [customer, city].where((s) => s.isNotEmpty).join(' · '),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: KandiType.caption(),
              ),
            ],
          ),
        ),
        const SizedBox(width: KandiSpace.sm),
        Column(
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            Text(
              kandiPrice(net is num ? net : 0),
              style: KandiType.price(size: 14),
            ),
            const SizedBox(height: 2),
            Text(status, style: KandiType.micro(weight: FontWeight.w400)),
          ],
        ),
      ],
    );
  }

  Future<void> _confirmSignOut() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        backgroundColor: KandiColors.surface,
        shape: const RoundedRectangleBorder(borderRadius: KandiRadius.md),
        title: Text('Sign out of your store?', style: KandiType.heading()),
        content: Text(
          // The reassurance that matters. One person routinely has both
          // accounts, and a seller who thinks this signs them out of shopping
          // will not tap it.
          'Your shopping account stays signed in.',
          style: KandiType.bodyText(),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(false),
            child:
                Text('Cancel', style: KandiType.label(color: KandiColors.muted)),
          ),
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(true),
            child: Text(
              'Sign out',
              style: KandiType.label(color: KandiColors.sale)
                  .copyWith(fontWeight: FontWeight.w700),
            ),
          ),
        ],
      ),
    );

    if (confirmed == true) await KandiSellerSession.clear();
  }
}
