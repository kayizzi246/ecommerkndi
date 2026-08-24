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

import 'dart:async';
import 'dart:convert';

import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

// ============================================================
//  KANDI — SELLER CENTRE (app)
//
//  Sibling of cart_widget.dart, checkout_widget.dart and
//  account_widget.dart. Same brand, same type, same API base,
//  same conventions.
//
//  WHAT THIS IS
//  -----------------------------------------------------------
//  The phone half of the Seller Centre that already exists on
//  the website: sign in as a seller, then see what the shop owes
//  you and what it is waiting for you to pack.
//
//  ONE ENTRY POINT, FROM ACCOUNT SETTINGS
//  -----------------------------------------------------------
//  `KandiSellerCentre.open(context)`, called from the account
//  screen. Sellers are a small minority of the people who install
//  a shopping app, so this is a row in settings rather than a tab
//  in the bottom bar — the same call the website makes by putting
//  "Sell on Kandi" at the end of a nav row rather than in the
//  masthead.
//
//  TWO SESSIONS, DELIBERATELY SEPARATE
//  -----------------------------------------------------------
//  A seller signing in here does NOT sign the shopper out, and
//  the two tokens live under different keys. They are different
//  accounts in WordPress with different permissions, and one
//  person routinely has both: a seller who shops on the same
//  handset must not have their basket and order history swapped
//  out from under them because they checked a payout.
//
//  WHY THE APP HAS ITS OWN ENDPOINTS
//  -----------------------------------------------------------
//  `/api/app/seller/*` rather than `/api/seller/*`. The website's
//  routes keep the session in an httpOnly cookie, which Dart's
//  HTTP client does not persist — a cookie sign-in would succeed
//  and be forgotten before the next request. The app routes hand
//  the token back in the body instead, exactly as the shopper
//  sign-in already does. Both sit on the same `callSellerApi`
//  underneath, so the two cannot drift in how they reach
//  WordPress.
// ============================================================

/// Where the storefront lives. Same constant as every sibling screen.
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
const Color _kRed = Color(0xFFE53935);

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

/// Money, in the shop's only currency.
///
/// Grouped by hand rather than with `intl`'s NumberFormat: the sibling screens
/// all do it this way and a second formatter would be a second set of rounding
/// rules for the same figures.
String _ugx(num value) {
  final whole = value.round().toString();
  final buffer = StringBuffer();
  for (var i = 0; i < whole.length; i++) {
    if (i > 0 && (whole.length - i) % 3 == 0) buffer.write(',');
    buffer.write(whole[i]);
  }
  return 'UGX ${buffer.toString()}';
}

// ============================================================
//  SESSION
// ============================================================

/// The signed-in seller, on this device.
///
/// Keys are prefixed `kandi_seller_` and share nothing with the shopper's
/// `kandi_auth_*` — see the note at the head of the file on why the two
/// sessions are deliberately independent.
///
/// On SharedPreferences rather than the Keychain: the same trade the shopper
/// session makes, and written out in full there. The difference worth naming is
/// that this token is worth MORE — it can change prices and request payouts —
/// which is why the expiry below is honoured strictly rather than treated as a
/// hint, and why signing out clears the record rather than only the token.
class _SellerSession {
  static const String _kToken = 'kandi_seller_token';
  static const String _kExpires = 'kandi_seller_expires';
  static const String _kSeller = 'kandi_seller_record';

  static String? _token;
  static Map<String, dynamic>? _seller;
  static bool _loaded = false;

  static Map<String, dynamic>? get seller => _seller;

  static Future<void> load() async {
    if (_loaded) return;
    _loaded = true;
    try {
      final prefs = await SharedPreferences.getInstance();
      final expires = prefs.getInt(_kExpires) ?? 0;
      // Expired locally is signed out, without asking the server. A screen that
      // renders a dashboard and then throws it away when the first request
      // comes back 401 is worse than one that never drew it.
      if (expires > 0 && DateTime.now().millisecondsSinceEpoch > expires) {
        await clear();
        return;
      }
      _token = prefs.getString(_kToken);
      final raw = prefs.getString(_kSeller);
      if (raw != null && raw.isNotEmpty) {
        final decoded = jsonDecode(raw);
        if (decoded is Map) _seller = Map<String, dynamic>.from(decoded);
      }
    } catch (_) {}
  }

  static bool get isActive => (_token ?? '').isNotEmpty;

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
      await prefs.setString(_kToken, token);
      await prefs.setInt(
        _kExpires,
        DateTime.now().millisecondsSinceEpoch + expiresIn * 1000,
      );
      if (seller != null) {
        await prefs.setString(_kSeller, jsonEncode(seller));
      }
    } catch (_) {}
  }

  static Future<void> clear() async {
    _token = null;
    _seller = null;
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.remove(_kToken);
      await prefs.remove(_kExpires);
      await prefs.remove(_kSeller);
    } catch (_) {}
  }

  static Map<String, String> get headers => <String, String>{
        'Content-Type': 'application/json',
        if ((_token ?? '').isNotEmpty) 'Authorization': 'Bearer $_token',
      };
}

/// One call to the Seller Centre, with the session attached.
///
/// Returns the decoded body and the status together rather than throwing,
/// because every caller here has a screen state for failure and none of them
/// wants a stack trace. A 401 clears the session as it passes: the token is
/// gone or revoked, and carrying on with it produces four more 401s.
class _Api {
  _Api._();

  static Future<({int status, dynamic data})> call(
    String path, {
    String method = 'GET',
    Object? body,
  }) async {
    final uri = Uri.parse('$_kApiBaseUrl/api/app/seller$path');
    try {
      late http.Response response;
      final headers = _SellerSession.headers;
      final encoded = body == null ? null : jsonEncode(body);

      switch (method) {
        case 'POST':
          response = await http
              .post(uri, headers: headers, body: encoded)
              .timeout(const Duration(seconds: 25));
          break;
        case 'PUT':
          response = await http
              .put(uri, headers: headers, body: encoded)
              .timeout(const Duration(seconds: 25));
          break;
        default:
          response = await http
              .get(uri, headers: headers)
              .timeout(const Duration(seconds: 25));
      }

      if (response.statusCode == 401) await _SellerSession.clear();

      dynamic decoded;
      try {
        decoded = jsonDecode(response.body);
      } catch (_) {
        decoded = null;
      }
      return (status: response.statusCode, data: decoded);
    } catch (_) {
      // 0 is "never reached the server", which the callers distinguish from a
      // real status so they can say "check your connection" rather than
      // inventing an explanation the server never gave.
      return (status: 0, data: null);
    }
  }

  static String message(dynamic data, String fallback) {
    if (data is Map && data['message'] is String) {
      final text = (data['message'] as String).trim();
      if (text.isNotEmpty) return text;
    }
    return fallback;
  }
}

// ============================================================
//  ENTRY POINT
// ============================================================

/// The Seller Centre, as one screen that decides what to show.
///
/// One exported symbol, because that is all FlutterFlow takes from a custom
/// widget file. The account screen calls `KandiSellerCentre.open(context)` and
/// this decides between the sign-in form and the dashboard — rather than the
/// caller having to know which, and getting it wrong the first time a token
/// expires.
class KandiSellerCentre extends StatefulWidget {
  const KandiSellerCentre({super.key, this.width, this.height});

  final double? width;
  final double? height;

  static Future<void> open(BuildContext context) {
    return Navigator.of(context).push(
      MaterialPageRoute<void>(builder: (_) => const KandiSellerCentre()),
    );
  }

  /// Whether a seller is signed in on this device.
  ///
  /// The account screen uses this to label its row — "Seller Centre" for
  /// somebody already signed in, "Sell on Kandi" for somebody who is not — so
  /// the row says what tapping it will do.
  static Future<bool> isSignedIn() async {
    await _SellerSession.load();
    return _SellerSession.isActive;
  }

  @override
  State<KandiSellerCentre> createState() => _KandiSellerCentreState();
}

class _KandiSellerCentreState extends State<KandiSellerCentre> {
  bool _booting = true;

  @override
  void initState() {
    super.initState();
    _boot();
  }

  Future<void> _boot() async {
    await _SellerSession.load();

    if (!mounted) return;
    setState(() => _booting = false);
  }

  @override
  Widget build(BuildContext context) {
    if (_booting) {
      return const Scaffold(
        backgroundColor: Colors.white,
        body: Center(
          child: CircularProgressIndicator(color: _kOrange, strokeWidth: 2),
        ),
      );
    }

    return _SellerSession.isActive
        ? _Dashboard(onSignedOut: () => setState(() {}))
        : _SignIn(onSignedIn: () => setState(() {}));
  }
}

// ============================================================
//  SIGN IN
// ============================================================

class _SignIn extends StatefulWidget {
  const _SignIn({required this.onSignedIn});

  final VoidCallback onSignedIn;

  @override
  State<_SignIn> createState() => _SignInState();
}

class _SignInState extends State<_SignIn> {
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
    final password = _password.text;
    if (email.isEmpty || password.isEmpty) {
      setState(() => _error = 'Enter your email and your password.');
      return;
    }

    FocusScope.of(context).unfocus();
    setState(() {
      _busy = true;
      _error = null;
    });

    final result = await _Api.call(
      '/login',
      method: 'POST',
      body: {'email': email, 'password': password},
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
        _error = _Api.message(data, 'Could not sign you in.');
      });
      return;
    }

    await _SellerSession.save(
      token: data['token'] as String,
      expiresIn: (data['expires_in'] is num)
          ? (data['expires_in'] as num).toInt()
          : 60 * 60 * 24 * 14,
      seller: data['seller'] is Map
          ? Map<String, dynamic>.from(data['seller'] as Map)
          : null,
    );

    if (!mounted) return;
    HapticFeedback.mediumImpact();
    widget.onSignedIn();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      appBar: _bar(context, 'Seller Centre'),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(20, 8, 20, 28),
          children: [
            Container(
              width: 52,
              height: 52,
              decoration: BoxDecoration(
                color: _kOrange.withOpacity(0.10),
                borderRadius: BorderRadius.circular(15),
              ),
              child: const Icon(Icons.storefront, color: _kOrange, size: 26),
            ),
            const SizedBox(height: 16),
            Text('Sign in to your store',
                style: _type(size: 24, weight: FontWeight.w700)),
            const SizedBox(height: 6),
            Text(
              'Manage your listings, orders and payouts.',
              style: _type(size: 14.5, color: _kBody),
            ),
            const SizedBox(height: 26),

            _Field(
              label: 'Email address',
              controller: _email,
              keyboardType: TextInputType.emailAddress,
              autofillHints: const [AutofillHints.username],
            ),
            const SizedBox(height: 14),
            _Field(
              label: 'Password',
              controller: _password,
              obscure: _obscure,
              autofillHints: const [AutofillHints.password],
              onSubmitted: (_) => _submit(),
              trailing: GestureDetector(
                onTap: () => setState(() => _obscure = !_obscure),
                child: Icon(
                  _obscure ? Icons.visibility_outlined : Icons.visibility_off_outlined,
                  size: 19,
                  color: _kMuted,
                ),
              ),
            ),

            if (_error != null) ...[
              const SizedBox(height: 14),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                decoration: BoxDecoration(
                  color: _kRed.withOpacity(0.08),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Text(_error!,
                    style: _type(
                        size: 13.5, weight: FontWeight.w500, color: _kRed)),
              ),
            ],

            const SizedBox(height: 22),
            SizedBox(
              height: 52,
              child: ElevatedButton(
                onPressed: _busy ? null : _submit,
                style: ElevatedButton.styleFrom(
                  backgroundColor: _kOrange,
                  disabledBackgroundColor: _kOrange.withOpacity(0.45),
                  foregroundColor: Colors.white,
                  elevation: 0,
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(14)),
                ),
                child: _busy
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(
                            strokeWidth: 2, color: Colors.white),
                      )
                    : Text('Sign in',
                        style: _type(
                            size: 16,
                            weight: FontWeight.w700,
                            color: Colors.white)),
              ),
            ),

            const SizedBox(height: 22),
            const Divider(height: 1, color: _kLine),
            const SizedBox(height: 18),
            Text('New to Kandi?',
                style: _type(size: 14, weight: FontWeight.w600)),
            const SizedBox(height: 4),
            Text(
              // No sign-up form in the app on purpose. Opening a store needs
              // documents and a fee, and that flow lives on the website where
              // it is already built and already reviewed. Duplicating it here
              // would be a second onboarding to keep in step with the first.
              'Opening a store takes a few minutes on kandiug.com/seller/register — '
              'then sign in here.',
              style: _type(size: 13.5, color: _kMuted),
            ),
          ],
        ),
      ),
    );
  }
}

class _Field extends StatelessWidget {
  const _Field({
    required this.label,
    required this.controller,
    this.obscure = false,
    this.keyboardType,
    this.autofillHints,
    this.trailing,
    this.onSubmitted,
  });

  final String label;
  final TextEditingController controller;
  final bool obscure;
  final TextInputType? keyboardType;
  final Iterable<String>? autofillHints;
  final Widget? trailing;
  final ValueChanged<String>? onSubmitted;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: _type(size: 13, weight: FontWeight.w600)),
        const SizedBox(height: 6),
        Container(
          decoration: BoxDecoration(
            color: _kSurface,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: _kLine),
          ),
          padding: const EdgeInsets.symmetric(horizontal: 14),
          child: Row(
            children: [
              Expanded(
                child: TextField(
                  controller: controller,
                  obscureText: obscure,
                  keyboardType: keyboardType,
                  autofillHints: autofillHints,
                  onSubmitted: onSubmitted,
                  style: _type(size: 15),
                  decoration: const InputDecoration(
                    isDense: true,
                    border: InputBorder.none,
                    contentPadding: EdgeInsets.symmetric(vertical: 15),
                  ),
                ),
              ),
              if (trailing != null) trailing!,
            ],
          ),
        ),
      ],
    );
  }
}

// ============================================================
//  DASHBOARD
// ============================================================

class _Dashboard extends StatefulWidget {
  const _Dashboard({required this.onSignedOut});

  final VoidCallback onSignedOut;

  @override
  State<_Dashboard> createState() => _DashboardState();
}

class _DashboardState extends State<_Dashboard> {
  Map<String, dynamic>? _stats;
  List<Map<String, dynamic>> _orders = <Map<String, dynamic>>[];
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
    // call runs the best part of a second — sequentially this screen would take
    // twice as long to draw for no reason.
    final results = await Future.wait<({int status, dynamic data})>([
      _Api.call('/stats'),
      _Api.call('/orders?per_page=5'),
    ]);
    if (!mounted) return;

    final stats = results[0];
    final orders = results[1];

    // A 401 on either has already cleared the session inside `_Api`. Bounce
    // back to the sign-in form rather than showing an empty dashboard.
    if (stats.status == 401 || orders.status == 401) {
      widget.onSignedOut();
      return;
    }

    setState(() {
      _loading = false;
      if (stats.status == 200 && stats.data is Map) {
        _stats = Map<String, dynamic>.from(stats.data as Map);
      } else if (stats.status == 0) {
        _error = 'Could not reach Kandi. Check your connection.';
      } else {
        _error = _Api.message(stats.data, 'Could not load your dashboard.');
      }

      final payload = orders.data;
      final list = payload is Map ? payload['orders'] : payload;
      if (list is List) {
        _orders = list
            .whereType<Map>()
            .map((o) => Map<String, dynamic>.from(o))
            .toList();
      }
    });
  }

  Future<void> _signOut() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: Text('Sign out of your store?',
            style: _type(size: 17, weight: FontWeight.w700)),
        content: Text(
          'Your shopping account stays signed in.',
          style: _type(size: 14, color: _kBody),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(false),
            child: Text('Cancel', style: _type(size: 14.5, color: _kMuted)),
          ),
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(true),
            child: Text('Sign out',
                style: _type(
                    size: 14.5, weight: FontWeight.w700, color: _kRed)),
          ),
        ],
      ),
    );
    if (confirmed != true) return;
    await _SellerSession.clear();
    if (!mounted) return;
    widget.onSignedOut();
  }

  num _n(String key) {
    final value = _stats?[key];
    return value is num ? value : 0;
  }

  @override
  Widget build(BuildContext context) {
    final seller = _SellerSession.seller;
    final storeName = (seller?['store_name'] ?? 'Your store').toString();
    final status = (seller?['status'] ?? '').toString();

    return Scaffold(
      backgroundColor: _kSurface,
      appBar: _bar(
        context,
        'Seller Centre',
        actions: [
          IconButton(
            onPressed: _signOut,
            icon: const Icon(Icons.logout, size: 20, color: _kInk),
            tooltip: 'Sign out of your store',
          ),
        ],
      ),
      body: _loading
          ? const Center(
              child: CircularProgressIndicator(color: _kOrange, strokeWidth: 2))
          : RefreshIndicator(
              color: _kOrange,
              onRefresh: _load,
              child: ListView(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 28),
                children: [
                  _storeHeader(storeName, status),
                  if (_error != null) ...[
                    const SizedBox(height: 14),
                    _errorCard(),
                  ],
                  const SizedBox(height: 16),
                  _payoutCard(),
                  const SizedBox(height: 16),
                  _statsGrid(),
                  const SizedBox(height: 16),
                  _listingsCard(),
                  const SizedBox(height: 16),
                  _ordersCard(),
                ],
              ),
            ),
    );
  }

  Widget _storeHeader(String storeName, String status) {
    // Only the states a seller can act on get a badge. A green "approved" chip
    // on every screen is a sticker; the two that matter are the ones that stop
    // listings being visible, and those must be impossible to miss.
    final warn = status == 'pending' || status == 'suspended' || status == 'unpaid';

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Row(
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: _kOrange.withOpacity(0.10),
              borderRadius: BorderRadius.circular(13),
            ),
            child: const Icon(Icons.storefront, color: _kOrange, size: 22),
          ),
          const SizedBox(width: 13),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(storeName,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: _type(size: 16.5, weight: FontWeight.w700)),
                const SizedBox(height: 2),
                Text(
                  warn
                      ? (status == 'unpaid'
                          ? 'Your monthly fee is due — listings are hidden'
                          : status == 'pending'
                              ? 'Awaiting review — listings are not live yet'
                              : 'Suspended — contact support')
                      : 'Open for orders',
                  maxLines: 2,
                  style: _type(
                      size: 12.5, color: warn ? _kRed : _kGreen),
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
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: _kRed.withOpacity(0.07),
        borderRadius: BorderRadius.circular(14),
      ),
      child: Row(
        children: [
          const Icon(Icons.error_outline, size: 19, color: _kRed),
          const SizedBox(width: 10),
          Expanded(
            child: Text(_error!,
                style: _type(size: 13.5, color: _kRed, weight: FontWeight.w500)),
          ),
          GestureDetector(
            onTap: _load,
            child: Text('Retry',
                style: _type(
                    size: 13.5, weight: FontWeight.w700, color: _kRed)),
          ),
        ],
      ),
    );
  }

  /// The figure a seller opens this screen for.
  ///
  /// Given the whole card rather than a tile in the grid, because "what am I
  /// owed" is the question, and the rest of the dashboard is context for it.
  Widget _payoutCard() {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: _kInk,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('PAYOUT DUE',
              style: _type(
                  size: 11.5,
                  weight: FontWeight.w700,
                  color: Colors.white.withOpacity(0.55))),
          const SizedBox(height: 8),
          Text(_ugx(_n('payout_due')),
              style: _type(
                  size: 30, weight: FontWeight.w700, color: Colors.white)),
          const SizedBox(height: 14),
          Row(
            children: [
              Expanded(
                child: _darkStat('Commission owed', _ugx(_n('commission_owed'))),
              ),
              Container(width: 1, height: 30, color: Colors.white24),
              Expanded(
                child: _darkStat('Paid to date', _ugx(_n('commission_paid'))),
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
            style: _type(size: 11.5, color: Colors.white.withOpacity(0.55))),
        const SizedBox(height: 3),
        Text(value,
            style: _type(
                size: 14.5, weight: FontWeight.w600, color: Colors.white)),
      ],
    );
  }

  Widget _statsGrid() {
    return Row(
      children: [
        Expanded(
          child: _statTile(
            'Revenue',
            _ugx(_n('revenue')),
            _n('revenue_change').toDouble(),
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: _statTile(
            'Orders',
            _n('orders').toString(),
            _n('orders_change').toDouble(),
          ),
        ),
      ],
    );
  }

  Widget _statTile(String label, String value, double change) {
    final up = change > 0;
    final flat = change == 0;
    return Container(
      padding: const EdgeInsets.all(15),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(15),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: _type(size: 12.5, color: _kMuted)),
          const SizedBox(height: 6),
          Text(value,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: _type(size: 19, weight: FontWeight.w700)),
          const SizedBox(height: 6),
          // No arrow at all when nothing moved. A grey "0%" with a flat dash
          // beside it is three pieces of furniture saying nothing happened.
          if (!flat)
            Row(
              children: [
                Icon(up ? Icons.trending_up : Icons.trending_down,
                    size: 14, color: up ? _kGreen : _kRed),
                const SizedBox(width: 4),
                Text('${change.abs().toStringAsFixed(0)}%',
                    style: _type(
                        size: 12,
                        weight: FontWeight.w600,
                        color: up ? _kGreen : _kRed)),
              ],
            ),
        ],
      ),
    );
  }

  Widget _listingsCard() {
    final pending = _n('products_pending');
    final out = _n('products_out_of_stock');

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('LISTINGS',
              style: _type(size: 11.5, weight: FontWeight.w700, color: _kMuted)),
          const SizedBox(height: 12),
          Row(
            children: [
              _pill('${_n('products_live')} live', _kGreen),
              if (pending > 0) ...[
                const SizedBox(width: 8),
                _pill('$pending pending', _kOrange),
              ],
              if (out > 0) ...[
                const SizedBox(width: 8),
                _pill('$out out of stock', _kRed),
              ],
            ],
          ),
          const SizedBox(height: 14),
          Text(
            // Editing listings is not in the app yet and the screen says so
            // rather than showing a dead button. A tap that does nothing is a
            // bug report; a sentence naming where the feature lives is an
            // instruction.
            'Add and edit products on kandiug.com/seller/products.',
            style: _type(size: 12.5, color: _kMuted),
          ),
        ],
      ),
    );
  }

  Widget _pill(String text, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: color.withOpacity(0.10),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Text(text,
          style: _type(size: 12, weight: FontWeight.w600, color: color)),
    );
  }

  Widget _ordersCard() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('RECENT ORDERS',
              style: _type(size: 11.5, weight: FontWeight.w700, color: _kMuted)),
          const SizedBox(height: 12),
          if (_orders.isEmpty)
            Text('No orders yet.', style: _type(size: 13.5, color: _kMuted))
          else
            ...List<Widget>.generate(_orders.length, (index) {
              final order = _orders[index];
              return Padding(
                padding: EdgeInsets.only(
                    bottom: index == _orders.length - 1 ? 0 : 12),
                child: _orderRow(order),
              );
            }),
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
              Text('#$number',
                  style: _type(size: 14, weight: FontWeight.w600)),
              const SizedBox(height: 2),
              Text(
                [customer, city].where((s) => s.isNotEmpty).join(' · '),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: _type(size: 12.5, color: _kMuted),
              ),
            ],
          ),
        ),
        const SizedBox(width: 10),
        Column(
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            Text(_ugx(net is num ? net : 0),
                style: _type(size: 14, weight: FontWeight.w700)),
            const SizedBox(height: 2),
            Text(status,
                style: _type(size: 11.5, color: _kFaint)),
          ],
        ),
      ],
    );
  }
}

// ============================================================
//  SHARED CHROME
// ============================================================

PreferredSizeWidget _bar(
  BuildContext context,
  String title, {
  List<Widget>? actions,
}) {
  return AppBar(
    backgroundColor: Colors.white,
    surfaceTintColor: Colors.white,
    elevation: 0,
    scrolledUnderElevation: 0,
    leading: IconButton(
      onPressed: () => Navigator.of(context).maybePop(),
      icon: const Icon(Icons.arrow_back, color: _kInk, size: 22),
    ),
    title: Text(title, style: _type(size: 17, weight: FontWeight.w700)),
    actions: actions,
    bottom: const PreferredSize(
      preferredSize: Size.fromHeight(1),
      child: Divider(height: 1, color: _kLine),
    ),
  );
}
