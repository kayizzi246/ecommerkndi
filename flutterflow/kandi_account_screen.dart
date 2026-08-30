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

// Navigation only — the five top-level destinations plus this page's own detail
// screens. Circular between the tab pages, which Dart allows: they reference
// each other's widget classes and nothing at load time.
import '/custom_code/widgets/kandi_orders_screen.dart';
import '/custom_code/widgets/kandi_wishlist_screen.dart';
import '/custom_code/widgets/kandi_cart_screen.dart';
import '/custom_code/widgets/kandi_seller_screen.dart';
import '/custom_code/widgets/kandi_shop_screen.dart';

// ============================================================
//  KANDI — ACCOUNT PAGE
//
//  Sign in, and everything a signed-in shopper reaches from
//  here. Self-contained like every page; the architecture is at
//  the head of kandi_home_screen.dart.
//
//  ---- The token is the account ----
//
//  `/api/app/auth/login` returns a bearer token. It is stored
//  under `kandi-auth-v1` and every authenticated request in the
//  app sends it. Signing out deletes it, which is the whole of
//  signing out — there is no server session to end.
//
//  Storing a token in SharedPreferences is the standard trade
//  for an app of this kind: it is private to the app's sandbox
//  on both platforms, and it survives a restart, which is what
//  stops a shopper signing in every time they open the shop. It
//  is NOT encrypted at rest, so the token is the only credential
//  kept — the password is never written down anywhere.
//
//  ---- Signing in is optional ----
//
//  Browsing, the basket and the saved list all work signed out,
//  and this page says so rather than blocking the app behind a
//  form. The only thing an account buys is order history, which
//  is exactly what the page offers as the reason to sign in.
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
  static const Color warn = Color(0xFFB45309);
  static const Color warnSoft = Color(0xFFFDF3E6);

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

// Read only, to put the count on the tab bar.
const String _basketKey = 'kandi-cart-v1';

// The keys every page in this app agrees on.
const String _authKey = 'kandi-auth-v1';
const String _authNameKey = 'kandi-auth-name';

class KandiAccountScreen extends StatefulWidget {
  const KandiAccountScreen({super.key, this.width, this.height});

  final double? width;
  final double? height;

  @override
  State<KandiAccountScreen> createState() => _KandiAccountScreenState();
}

class _KandiAccountScreenState extends State<KandiAccountScreen> {
  final TextEditingController _email = TextEditingController();
  final TextEditingController _password = TextEditingController();

  bool _loading = true;
  bool _busy = false;
  bool _obscure = true;
  String? _token;
  String _name = '';
  String? _error;

  @override
  void initState() {
    super.initState();
    _restore();
    _countBasket();
  }

  /// How many items are in the basket, for the badge on the tab bar.
  ///
  /// Read from the shared basket rather than passed in — like everything else
  /// in this app, the page finds out by looking, not by being told.
  int _cartCount = 0;

  Future<void> _countBasket() async {
    int count = 0;
    try {
      final prefs = await SharedPreferences.getInstance();
      final raw = prefs.getString(_basketKey);
      if (raw != null) {
        final decoded = jsonDecode(raw);
        if (decoded is List) {
          for (final entry in decoded) {
            if (entry is! Map) continue;
            final quantity = entry['quantity'];
            count += quantity is int ? quantity : 1;
          }
        }
      }
    } catch (_) {
      count = 0;
    }
    if (mounted) setState(() => _cartCount = count);
  }


  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    super.dispose();
  }

  Future<void> _restore() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final token = prefs.getString(_authKey);
      final name = prefs.getString(_authNameKey) ?? '';
      if (!mounted) return;
      setState(() {
        _token = (token != null && token.isNotEmpty) ? token : null;
        _name = name;
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() => _loading = false);
    }
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
            Uri.parse('$_apiBase/api/app/auth/login'),
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
        // The server's own wording where there is one — it knows whether this
        // was a wrong password or a locked account, and this screen does not.
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

    // The name is for the greeting only. A missing one is not an error — the
    // page falls back to the email, which is always present.
    final customer = data['customer'];
    final name = (customer is Map)
        ? (customer['firstName'] ?? customer['name'] ?? '').toString()
        : '';

    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_authKey, token);
      await prefs.setString(_authNameKey, name.isNotEmpty ? name : email);
    } catch (_) {
      // The session still works for this run; it just will not survive a
      // restart. Not worth blocking a successful sign-in over.
    }

    if (!mounted) return;
    setState(() {
      _busy = false;
      _token = token;
      _name = name.isNotEmpty ? name : email;
      _password.clear();
    });
  }


  /// Switches to a top-level tab without growing the stack.
  ///
  /// `popUntil(isFirst)` returns to the app's root — Home — and the target is
  /// pushed on top of it. Without this, Home → Shop → Account → Basket leaves
  /// four screens stacked and four back taps to escape. With it the stack is
  /// never deeper than Home plus one tab, and Back always means Home.
  ///
  /// A null target is Home itself: pop and push nothing.
  Future<void> _tab(Widget? target) async {
    Navigator.of(context).popUntil((route) => route.isFirst);
    if (target == null || !mounted) return;
    await Navigator.of(context)
        .push(MaterialPageRoute(builder: (_) => target));
    // The basket can come back changed — the shopper may have added to it or
    // emptied it on the screen they just left. Re-counting is cheaper than
    // showing a stale number on the tab bar.
    if (mounted) await _countBasket();
  }

  Widget _buildBottomNav() {
    return Container(
      decoration: const BoxDecoration(
        color: _KColors.panel,
        border: Border(top: BorderSide(color: _KColors.line)),
        boxShadow: [
          BoxShadow(
              color: Color(0x0F000000), blurRadius: 12, offset: Offset(0, -2)),
        ],
      ),
      child: SafeArea(
        top: false,
        child: SizedBox(
          height: 58,
          child: Row(
            children: [
              _NavItem(
                icon: Icons.home_rounded,
                label: 'Home',
                active: 4 == 0,
                onTap: () => _tab(null),
              ),
              _NavItem(
                icon: Icons.grid_view_rounded,
                label: 'Shop',
                active: 4 == 1,
                onTap: 4 == 1 ? null : () => _tab(const KandiShopScreen()),
              ),
              _NavItem(
                icon: Icons.favorite_border_rounded,
                label: 'Saved',
                active: 4 == 2,
                onTap: 4 == 2 ? null : () => _tab(const KandiWishlistScreen()),
              ),
              _NavItem(
                icon: Icons.shopping_cart_outlined,
                label: 'Basket',
                active: 4 == 3,
                badge: _cartCount,
                onTap: 4 == 3 ? null : () => _tab(const KandiCartScreen()),
              ),
              _NavItem(
                icon: Icons.person_outline_rounded,
                label: 'Account',
                active: 4 == 4,
                onTap: 4 == 4 ? null : () => _tab(const KandiAccountScreen()),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _signOut() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.remove(_authKey);
      await prefs.remove(_authNameKey);
    } catch (_) {}
    if (!mounted) return;
    setState(() {
      _token = null;
      _name = '';
    });
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('Signed out. Your basket is still here.'),
        behavior: SnackBarBehavior.floating,
      ),
    );
  }

  /// Registration and password resets happen on the website.
  ///
  /// Both need email delivery and both are places where a second, drifting
  /// implementation is a liability rather than a convenience. The app links
  /// out; the site is already correct.
  Future<void> _openWeb(String path) async {
    try {
      await launchUrl(Uri.parse('$_apiBase$path'),
          mode: LaunchMode.externalApplication);
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Could not open the browser.'),
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
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
          title: const Text('Account',
              style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w700,
                  color: Colors.white)),
        ),
        body: _loading
            ? const Center(
                child: CircularProgressIndicator(color: _KColors.primary))
            : (_token == null ? _buildSignIn() : _buildAccount()),
        bottomNavigationBar: _buildBottomNav(),
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
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('Sign in',
                  style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w800,
                      color: _KColors.ink)),
              const SizedBox(height: 4),
              const Text(
                'To see your orders. Browsing, your basket and your saved items all work without an account.',
                style: TextStyle(fontSize: 13, height: 1.45, color: _KColors.body),
              ),
              const SizedBox(height: _KSpace.lg),
              _Field(
                controller: _email,
                label: 'Email',
                hint: 'you@example.com',
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
              const SizedBox(height: _KSpace.md),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  GestureDetector(
                    onTap: () => _openWeb('/reset-password'),
                    child: const Text('Forgot password',
                        style: TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                            // The money colour, not the brand orange: #FF6A00
                            // on white is 2.9:1 and fails AA at every size.
                            color: _KColors.flame)),
                  ),
                  GestureDetector(
                    onTap: () => _openWeb('/account'),
                    child: const Text('Create account',
                        style: TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                            // The money colour, not the brand orange: #FF6A00
                            // on white is 2.9:1 and fails AA at every size.
                            color: _KColors.flame)),
                  ),
                ],
              ),
            ],
          ),
        ),
        const SizedBox(height: _KSpace.md),
        _links(),
      ],
    );
  }

  Widget _buildAccount() {
    return ListView(
      padding: const EdgeInsets.all(_KSpace.md),
      children: [
        Container(
          padding: const EdgeInsets.all(_KSpace.lg),
          decoration: BoxDecoration(
            color: _KColors.panel,
            borderRadius: BorderRadius.circular(_rPanel),
          ),
          child: Row(
            children: [
              Container(
                width: 52,
                height: 52,
                decoration: const BoxDecoration(
                    color: _KColors.primarySoft, shape: BoxShape.circle),
                child: const Icon(Icons.person_rounded,
                    size: 26, color: _KColors.primary),
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
                    Text(_name,
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
        _links(signedIn: true),
        const SizedBox(height: _KSpace.md),
        SizedBox(
          width: double.infinity,
          height: 48,
          child: OutlinedButton(
            onPressed: _signOut,
            style: OutlinedButton.styleFrom(
              foregroundColor: _KColors.ink,
              side: const BorderSide(color: _KColors.line),
              shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(_rPill)),
            ),
            child: const Text('Sign out',
                style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700)),
          ),
        ),
        const SizedBox(height: _KSpace.xl),
      ],
    );
  }

  Widget _links({bool signedIn = false}) {
    return Container(
      decoration: BoxDecoration(
        color: _KColors.panel,
        borderRadius: BorderRadius.circular(_rPanel),
      ),
      child: Column(
        children: [
          _Row(
            icon: Icons.receipt_long_rounded,
            label: 'My orders',
            // Offered signed out too: tapping it is how a shopper discovers
            // that orders are the reason to sign in, and the orders page says
            // so itself rather than this one guessing.
            detail: signedIn ? null : 'Sign in to see them',
            onTap: () => Navigator.of(context)
                .push(MaterialPageRoute(builder: (_) => const KandiOrdersScreen())),
          ),
          const Divider(height: 1, color: _KColors.hairline),
          _Row(
            icon: Icons.favorite_border_rounded,
            label: 'Saved items',
            onTap: () => Navigator.of(context).push(
                MaterialPageRoute(builder: (_) => const KandiWishlistScreen())),
          ),
          const Divider(height: 1, color: _KColors.hairline),
          _Row(
            icon: Icons.shopping_bag_outlined,
            label: 'Basket',
            onTap: () => Navigator.of(context)
                .push(MaterialPageRoute(builder: (_) => const KandiCartScreen())),
          ),
          const Divider(height: 1, color: _KColors.hairline),
          _Row(
            icon: Icons.help_outline_rounded,
            label: 'Help and delivery',
            trailing: Icons.open_in_new_rounded,
            onTap: () => _openWeb('/help'),
          ),
          const Divider(height: 1, color: _KColors.hairline),
          // ---- The way into the other half of the marketplace ----
          //
          // This used to open /sell in a browser, which is the right
          // destination for somebody who does not sell yet and the wrong one
          // for somebody who does — a trader wanting today's takings was sent
          // to a recruitment page.
          //
          // The Seller Centre handles both: signed in it shows the figures,
          // signed out it shows the sign-in with "become a seller" underneath.
          // One row, and it is correct for whoever taps it.
          _Row(
            icon: Icons.storefront_outlined,
            label: 'Seller Centre',
            detail: 'Your sales, stock and payouts',
            onTap: () => Navigator.of(context)
                .push(MaterialPageRoute(builder: (_) => const KandiSellerScreen())),
          ),
        ],
      ),
    );
  }
}

class _Row extends StatelessWidget {
  const _Row({
    required this.icon,
    required this.label,
    required this.onTap,
    this.detail,
    this.trailing = Icons.chevron_right_rounded,
  });

  final IconData icon;
  final String label;
  final VoidCallback onTap;
  final String? detail;
  final IconData trailing;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(
            horizontal: _KSpace.lg, vertical: _KSpace.md + 2),
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
            Icon(trailing, size: 19, color: _KColors.muted),
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

// ------------------------------------------------------------
//  The bottom bar
// ------------------------------------------------------------

/// One of the five top-level destinations.
///
/// Duplicated in each tab page rather than imported: every page in this app is
/// self-contained, and a shared widget would be the one import that reintroduces
/// the paste-order problem the whole architecture exists to avoid.
class _NavItem extends StatelessWidget {
  const _NavItem({
    required this.icon,
    required this.label,
    this.onTap,
    this.active = false,
    this.badge = 0,
  });

  final IconData icon;
  final String label;
  /// Null on the tab you are already on: InkWell then draws no ripple, which
  /// is the honest signal for "nothing will happen". An empty closure would
  /// ripple and promise otherwise.
  final VoidCallback? onTap;
  final bool active;
  final int badge;

  @override
  Widget build(BuildContext context) {
    final colour = active ? _KColors.flame : _KColors.muted;
    return Expanded(
      child: InkWell(
        onTap: onTap,
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Stack(
              clipBehavior: Clip.none,
              children: [
                Icon(icon, size: 22, color: colour),
                if (badge > 0)
                  Positioned(
                    right: -7,
                    top: -5,
                    child: Container(
                      padding:
                          const EdgeInsets.symmetric(horizontal: 4, vertical: 1),
                      constraints: const BoxConstraints(minWidth: 16),
                      decoration: BoxDecoration(
                        color: _KColors.flame,
                        borderRadius: BorderRadius.circular(8),
                        // A white ring keeps the badge legible over the icon.
                        border: Border.all(color: Colors.white, width: 1.4),
                      ),
                      child: Text(
                        badge > 99 ? '99+' : '$badge',
                        textAlign: TextAlign.center,
                        style: const TextStyle(
                            fontSize: 9,
                            height: 1.3,
                            fontWeight: FontWeight.w800,
                            color: Colors.white),
                      ),
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 3),
            Text(label,
                style: TextStyle(
                    fontSize: 10.5, fontWeight: FontWeight.w600, color: colour)),
          ],
        ),
      ),
    );
  }
}
