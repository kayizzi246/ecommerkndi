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
import '/custom_code/widgets/kandi_categories_screen.dart';
import '/custom_code/widgets/kandi_deals_screen.dart';
import '/custom_code/widgets/kandi_stores_screen.dart';
import '/custom_code/widgets/kandi_track_order_screen.dart';

// ============================================================
//  KANDI — ACCOUNT PAGE
//
//  Sign in, and everything a signed-in shopper reaches from
//  here. Self-contained like every page; the architecture is at
//  the head of kandi_home_screen.dart.
//
//  ---- There is no password ----
//
//  This page used to take an email and a password. It does not
//  any more, and the reason is who shops here: most arrive on a
//  phone, a good number have no email they read, and a password
//  chosen at a checkout is one they will have forgotten by
//  their second order. Every one of those shoppers ended up in
//  the same place — a "Forgot password" link out to a browser —
//  which is a sign-in flow that mostly does not sign anybody in.
//
//  What replaces it is a code. The shopper gives a phone number
//  or an email address, `/api/otp/start` sends six digits, and
//  `/api/app/auth/otp` trades those digits for the same bearer
//  token the password route used to return. WordPress finds the
//  customer behind that contact, or creates one — see
//  `/customers/otp-session`.
//
//  Either channel works here. The CHECKOUT is stricter and
//  takes a phone only, because the number on an order is what a
//  rider calls; see the note at the head of that file.
//
//  ---- The token is the account ----
//
//  It is stored under `kandi-auth-v1` and every authenticated
//  request in the app sends it. Signing out deletes it, which
//  is the whole of signing out — there is no server session to
//  end.
//
//  Storing a token in SharedPreferences is the standard trade
//  for an app of this kind: it is private to the app's sandbox
//  on both platforms, and it survives a restart, which is what
//  stops a shopper signing in every time they open the shop. It
//  is NOT encrypted at rest, and now there is nothing else to
//  keep — a code is used once and a password no longer exists.
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

/// The phone number this device has proved, in +2567XXXXXXXX form.
///
/// Written here so that a shopper who signs in on this page walks onto the
/// checkout already verified. Only set when the channel was SMS — an email
/// sign-in leaves it alone, and the checkout will ask for a number.
const String _verifiedPhoneKey = 'kandi-verified-phone';

class KandiAccountScreen extends StatefulWidget {
  const KandiAccountScreen({super.key, this.width, this.height});

  final double? width;
  final double? height;

  @override
  State<KandiAccountScreen> createState() => _KandiAccountScreenState();
}

class _KandiAccountScreenState extends State<KandiAccountScreen> {
  bool _loading = true;
  bool _busy = false;
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

  /// Sends a code, and signs the shopper in if they read it back.
  ///
  /// All of the network work is in `_KOtpSheet` at the foot of this file. This
  /// only records what came back, which is the same three things the password
  /// flow recorded: a token, a name for the greeting, and — when the channel
  /// was SMS — the number, so the checkout does not ask for it again.
  Future<void> _signIn() async {
    setState(() {
      _busy = true;
      _error = null;
    });

    final result = await showModalBottomSheet<_KVerified>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      // A stray tap on the scrim should not throw away a code the shop has
      // already paid an SMS to send.
      isDismissible: false,
      builder: (_) => const _KOtpSheet(),
    );

    if (!mounted) return;

    if (result == null) {
      setState(() => _busy = false);
      return;
    }

    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_authKey, result.token);
      await prefs.setString(
          _authNameKey, result.name.isNotEmpty ? result.name : result.contact);
      if (result.channel == 'sms') {
        await prefs.setString(_verifiedPhoneKey, result.contact);
      }
    } catch (_) {
      // The session still works for this run; it just will not survive a
      // restart. Not worth failing a sign-in that actually succeeded.
    }

    if (!mounted) return;
    setState(() {
      _busy = false;
      _token = result.token;
      _name = result.name.isNotEmpty ? result.name : result.contact;
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
      // The proved number goes with the session. Leaving it behind would let
      // the next person to pick up the phone check out against a number they
      // never proved — which is the one thing the checkout gate exists to
      // stop.
      await prefs.remove(_verifiedPhoneKey);
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

  /// Opens a page of the website in the browser.
  ///
  /// This used to carry registration and password resets as well. Neither
  /// exists any more — a code IS the registration — so what is left is the
  /// help centre and the other read-only pages, which are long, change often,
  /// and would be a second copy to keep in step if the app drew them itself.
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
                style:
                    TextStyle(fontSize: 13, height: 1.45, color: _KColors.body),
              ),
              const SizedBox(height: _KSpace.lg),

              // ---- No fields on the page itself ----
              //
              // The number or the address is asked for inside the sheet, not
              // here. Two forms for one job — a field on the page and a field
              // in a dialog on top of it — is how a shopper ends up typing
              // their number twice, and the sheet has to own the field anyway
              // because it is what knows whether a code has been sent yet.
              //
              // What is left on the page is the promise: what will happen when
              // the button is pressed, in the two lines below. A shopper who
              // knows a code is coming does not read the SMS as a phishing
              // attempt, which is a real cost of not saying so.
              Container(
                padding: const EdgeInsets.all(_KSpace.md),
                decoration: BoxDecoration(
                  color: _KColors.primarySoft,
                  borderRadius: BorderRadius.circular(_rChip),
                ),
                child: const Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Icon(Icons.password_rounded,
                        size: 18, color: _KColors.primary),
                    SizedBox(width: _KSpace.sm),
                    Expanded(
                      child: Text(
                        'No password. Give us your phone number or your email, '
                        'and we send you a 6-digit code to type back.',
                        style: TextStyle(
                            fontSize: 12.5, height: 1.45, color: _KColors.ink),
                      ),
                    ),
                  ],
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
                  child: Text(_busy ? 'Please wait…' : 'Send me a code',
                      style: const TextStyle(
                          fontSize: 15, fontWeight: FontWeight.w700)),
                ),
              ),

              // ---- The two links that used to live here are gone ----
              //
              // "Forgot password" has nothing left to forget, and "Create
              // account" has nothing left to create: the first sign-in with a
              // new number IS the account, made by /customers/otp-session
              // without asking the shopper to fill anything in. Leaving either
              // link would send somebody to a web page to solve a problem this
              // page no longer has.
              const SizedBox(height: _KSpace.md),
              const Text(
                'First time? Signing in makes your account. Nothing to fill in.',
                style: TextStyle(fontSize: 12, color: _KColors.muted),
              ),
            ],
          ),
        ),
        const SizedBox(height: _KSpace.md),
        _browse(),
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
        _browse(),
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

  /// ---- The ways into the rest of the shop ----
  ///
  /// Categories, deals, the store directory and order tracking are all real
  /// screens in this app and none of them is a tab. This panel is how they are
  /// reached, and it sits ABOVE the account rows on purpose: three of the four
  /// are things a shopper does before they have bought anything, and one of
  /// them — tracking — is the answer for the majority of this shop's customers,
  /// who ordered without an account and cannot use My orders at all.
  ///
  /// The bottom bar was the obvious home for browse destinations and it is
  /// full: five tabs is the most a phone bar carries legibly, and every one of
  /// the five earns its place. A panel of rows costs one tap more and no
  /// ambiguity.
  Widget _browse() {
    return Container(
      decoration: BoxDecoration(
        color: _KColors.panel,
        borderRadius: BorderRadius.circular(_rPanel),
      ),
      child: Column(
        children: [
          _Row(
            icon: Icons.category_outlined,
            label: 'All categories',
            detail: 'Every department, shelf by shelf',
            onTap: () => Navigator.of(context).push(MaterialPageRoute(
                builder: (_) => const KandiCategoriesScreen())),
          ),
          const Divider(height: 1, color: _KColors.hairline),
          _Row(
            icon: Icons.local_offer_outlined,
            label: "Today's deals",
            detail: 'Everything reduced, deepest first',
            onTap: () => Navigator.of(context)
                .push(MaterialPageRoute(builder: (_) => const KandiDealsScreen())),
          ),
          const Divider(height: 1, color: _KColors.hairline),
          _Row(
            icon: Icons.storefront_outlined,
            label: 'Shop by store',
            detail: 'The traders selling on Kandi',
            onTap: () => Navigator.of(context).push(
                MaterialPageRoute(builder: (_) => const KandiStoresScreen())),
          ),
          const Divider(height: 1, color: _KColors.hairline),
          _Row(
            icon: Icons.local_shipping_outlined,
            label: 'Track an order',
            // Said out loud, because this is the row that rescues the shopper
            // who is about to tap My orders, find a sign-in form, and conclude
            // the shop has lost their parcel.
            detail: 'No account needed',
            onTap: () => Navigator.of(context).push(MaterialPageRoute(
                builder: (_) => const KandiTrackOrderScreen())),
          ),
        ],
      ),
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
    this.onChanged,
  });

  final TextEditingController controller;
  final String label;
  final String hint;
  final IconData icon;
  final TextInputType? keyboardType;

  /// Optional because most fields on this page are read once, on submit. The
  /// code field is not: it submits itself on the sixth digit, which needs a
  /// keystroke callback.
  final ValueChanged<String>? onChanged;

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
          onChanged: onChanged,
          style: const TextStyle(fontSize: 14.5, color: _KColors.ink),
          decoration: InputDecoration(
            isDense: true,
            filled: true,
            fillColor: _KColors.hairline,
            hintText: hint,
            hintStyle: const TextStyle(fontSize: 14, color: _KColors.muted),
            prefixIcon: Icon(icon, size: 19, color: _KColors.muted),
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

// ------------------------------------------------------------
//  Signing in with a code
// ------------------------------------------------------------

/// A Ugandan mobile number in the one shape the shop stores, or null.
///
/// +2567XXXXXXXX, which is what the storefront normalises to and what
/// WordPress matches `billing_phone` against. Getting this wrong does not fail
/// loudly — it fails as a second account for the same shopper — so the app
/// normalises before it sends rather than hoping the server will.
///
/// Written as a digit sweep rather than a regular expression on purpose: it
/// has to accept 0772 123 456, +256 772 123 456 and 256772123456, which is
/// three patterns and one loop.
String? _normalisePhone(String raw) {
  final digits = StringBuffer();
  for (final unit in raw.codeUnits) {
    if (unit >= 48 && unit <= 57) digits.writeCharCode(unit);
  }

  var value = digits.toString();
  if (value.startsWith('256')) value = value.substring(3);
  if (value.startsWith('0')) value = value.substring(1);

  // Every Ugandan mobile prefix is 7X. Nine digits starting with anything else
  // is a landline or a typo, and both mean the rider cannot call.
  if (value.length != 9 || !value.startsWith('7')) return null;
  return '+256' + value;
}

/// Loose on purpose. The only test of an address that means anything is
/// whether a message sent to it arrives, and that is exactly what the next
/// step does.
bool _looksLikeEmail(String raw) {
  final at = raw.indexOf('@');
  if (at < 1) return false;
  final dot = raw.indexOf('.', at + 2);
  return dot > at + 1 && dot < raw.length - 1;
}

/// A proved contact and the session it bought.
class _KVerified {
  const _KVerified({
    required this.token,
    required this.contact,
    required this.channel,
    required this.name,
  });

  /// The bearer token, as `/api/app/auth/otp` returned it.
  final String token;

  /// The contact in the shape the shop stores — +2567XXXXXXXX for a phone,
  /// lower-cased for an email. Kept rather than what was typed, because the
  /// difference is what makes a stored number fail to match itself later.
  final String contact;

  /// 'sms' or 'email'. The checkout only accepts a number, so this is what
  /// tells the caller whether it has one worth writing down.
  final String channel;

  /// For the greeting. Empty is not an error.
  final String name;
}

/// One of the two channels, drawn as a card rather than a Radio.
///
/// Material's own radio is 20px of tap target in a 48px row and the label is
/// not part of it, which on a phone means a shopper aiming at the word misses.
/// The whole card is the target here.
class _ChannelTile extends StatelessWidget {
  const _ChannelTile({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.selected,
    required this.onTap,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: Container(
        padding: const EdgeInsets.symmetric(
            horizontal: _KSpace.md, vertical: _KSpace.md),
        decoration: BoxDecoration(
          color: selected ? _KColors.primarySoft : _KColors.panel,
          borderRadius: BorderRadius.circular(_rChip),
          // Selection is carried by the border AND the tint, not by one of
          // them. A tint alone is invisible to a shopper with a colour
          // deficiency; a border alone is easy to miss on a bright screen
          // outdoors, which is where a lot of this shop is used.
          border: Border.all(
            color: selected ? _KColors.primary : _KColors.line,
            width: selected ? 1.5 : 1,
          ),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(icon,
                size: 20, color: selected ? _KColors.primary : _KColors.muted),
            const SizedBox(height: 6),
            Text(title,
                style: TextStyle(
                    fontSize: 13.5,
                    fontWeight: FontWeight.w700,
                    color: selected ? _KColors.ink : _KColors.body)),
            Text(subtitle,
                style: const TextStyle(fontSize: 11.5, color: _KColors.muted)),
          ],
        ),
      ),
    );
  }
}

/// Sends a one-time code and trades it for a session.
///
/// ---- Two requests, and what each one is for ----
///
/// `POST /api/otp/start` takes a channel and a contact and sends six digits by
/// SMS or by email. It answers with a `challenge`: the code, sealed and
/// encrypted, that the app cannot read and cannot forge.
///
/// `POST /api/app/auth/otp` takes that challenge back with the digits the
/// shopper typed. If they match, it finds or creates the WordPress customer
/// for that contact and returns a bearer token. That token is the account.
///
/// ---- The code is never checked here ----
///
/// Worth stating because it would be easy, and wrong, to compare the two on
/// the phone: the challenge would have to contain the code in a form the app
/// could read, which is a code an attacker can read too. Everything about the
/// check happens on the server, and this sheet only learns whether it passed.
///
/// ---- Why this is duplicated in the checkout ----
///
/// The checkout screen has its own copy, fixed to SMS. Every page in this app
/// is self-contained — see the architecture note at the head of
/// kandi_home_screen.dart — and a shared sheet would be the one import that
/// reintroduces the paste-order problem the whole arrangement exists to avoid.
class _KOtpSheet extends StatefulWidget {
  const _KOtpSheet();

  @override
  State<_KOtpSheet> createState() => _KOtpSheetState();
}

class _KOtpSheetState extends State<_KOtpSheet> {
  final TextEditingController _contact = TextEditingController();
  final TextEditingController _code = TextEditingController();

  /// SMS by default, because that is how most of this shop's customers reach
  /// it. Email is the second option rather than the first for the same reason.
  String _channel = 'sms';

  String _challenge = '';
  String _sentTo = '';
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _contact.dispose();
    _code.dispose();
    super.dispose();
  }

  /// Step one: ask the server to send a code.
  Future<void> _send() async {
    final typed = _contact.text.trim();

    // Checked here as well as on the server, because a round trip to find out
    // that 070 is not a phone number is three seconds a shopper spends
    // watching a spinner for an answer the app already had.
    final destination =
        _channel == 'sms' ? _normalisePhone(typed) : typed.toLowerCase();

    if (_channel == 'sms' && destination == null) {
      setState(
          () => _error = 'Enter a Ugandan mobile number, like 0772 123 456.');
      return;
    }
    if (_channel == 'email' && !_looksLikeEmail(typed)) {
      setState(() => _error = 'Enter an email address we can send the code to.');
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
            Uri.parse('$_apiBase/api/otp/start'),
            headers: const {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
            },
            body: jsonEncode({'channel': _channel, 'to': destination}),
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
        // The server's own wording where there is one: it knows whether the
        // gateway rejected the number or the shop has been rate limited, and
        // this sheet does not.
        _error = (data is Map && data['message'] != null)
            ? data['message'].toString()
            : 'Could not send the code. Check your connection and try again.';
      });
      return;
    }

    setState(() {
      _busy = false;
      _challenge = (data['challenge'] ?? '').toString();
      _sentTo = (data['sentTo'] ?? destination).toString();
      // A sheet asking for a code nobody sent is worse than an error.
      if (_challenge.isEmpty) {
        _error =
            'Verification is not available right now. Please try again shortly.';
      }
    });
  }

  /// Step two: trade the code for a session.
  Future<void> _confirm() async {
    if (_code.text.trim().length < 6) {
      setState(() => _error = 'The code is six digits.');
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
            Uri.parse('$_apiBase/api/app/auth/otp'),
            headers: const {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
            },
            body: jsonEncode({
              'challenge': _challenge,
              'code': _code.text.trim(),
            }),
          )
          .timeout(const Duration(seconds: 25));
      status = response.statusCode;
      data = jsonDecode(response.body);
    } catch (_) {
      status = 0;
    }

    if (!mounted) return;

    final token = (data is Map) ? (data['token'] ?? '').toString() : '';
    if (status != 200 || token.isEmpty) {
      setState(() {
        _busy = false;
        _error = (data is Map && data['message'] != null)
            ? data['message'].toString()
            : 'That code is not right. Check it, or ask for a new one.';
      });
      return;
    }

    final customer = (data as Map)['customer'];
    final name = (customer is Map)
        ? (customer['firstName'] ?? customer['name'] ?? '').toString()
        : '';

    final proved = _channel == 'sms'
        ? (_normalisePhone(_contact.text) ?? _contact.text.trim())
        : _contact.text.trim().toLowerCase();

    Navigator.of(context).pop(_KVerified(
      token: token,
      contact: proved,
      channel: _channel,
      name: name,
    ));
  }

  @override
  Widget build(BuildContext context) {
    final sent = _challenge.isNotEmpty;

    return Padding(
      // The sheet has to sit above the keyboard, and `viewInsets` is the only
      // measurement that knows how tall it is. Without this the code field is
      // under the keys on every phone with a short screen.
      padding:
          EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
      child: Container(
        padding: const EdgeInsets.all(_KSpace.lg),
        decoration: const BoxDecoration(
          color: _KColors.panel,
          borderRadius:
              BorderRadius.vertical(top: Radius.circular(_rPanel + 6)),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  width: 38,
                  height: 38,
                  decoration: const BoxDecoration(
                      color: _KColors.primarySoft, shape: BoxShape.circle),
                  child: Icon(
                      _channel == 'sms'
                          ? Icons.sms_outlined
                          : Icons.mail_outline_rounded,
                      size: 20,
                      color: _KColors.primary),
                ),
                const SizedBox(width: _KSpace.md),
                Expanded(
                  child: Text(sent ? 'Enter the code' : 'Sign in',
                      style: const TextStyle(
                          fontSize: 17,
                          fontWeight: FontWeight.w800,
                          color: _KColors.ink)),
                ),
                IconButton(
                  onPressed: _busy ? null : () => Navigator.of(context).pop(),
                  icon: const Icon(Icons.close_rounded,
                      size: 22, color: _KColors.muted),
                ),
              ],
            ),
            const SizedBox(height: 4),
            Text(
              sent
                  ? 'We sent six digits to $_sentTo. It expires in 10 minutes.'
                  : 'Choose where we should send your code. Either one signs you '
                      'into the same account.',
              style: const TextStyle(
                  fontSize: 13, height: 1.45, color: _KColors.body),
            ),
            const SizedBox(height: _KSpace.lg),

            if (!sent) ...[
              // IntrinsicHeight so the two cards match whichever is taller.
              // Without it a one-line subtitle beside a two-line one leaves a
              // step in the row, which reads as a rendering fault rather than
              // as a choice.
              IntrinsicHeight(
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Expanded(
                      child: _ChannelTile(
                        icon: Icons.smartphone_rounded,
                        title: 'Phone',
                        subtitle: 'By SMS',
                        selected: _channel == 'sms',
                        onTap: _busy
                            ? () {}
                            : () => setState(() {
                                  _channel = 'sms';
                                  _error = null;
                                }),
                      ),
                    ),
                    const SizedBox(width: _KSpace.sm),
                    Expanded(
                      child: _ChannelTile(
                        icon: Icons.mail_outline_rounded,
                        title: 'Email',
                        subtitle: 'By email',
                        selected: _channel == 'email',
                        onTap: _busy
                            ? () {}
                            : () => setState(() {
                                  _channel = 'email';
                                  _error = null;
                                }),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: _KSpace.md),
              _Field(
                controller: _contact,
                label: _channel == 'sms' ? 'Phone number' : 'Email',
                hint: _channel == 'sms' ? '07XX XXX XXX' : 'you@example.com',
                icon: _channel == 'sms'
                    ? Icons.phone_outlined
                    : Icons.mail_outline_rounded,
                keyboardType: _channel == 'sms'
                    ? TextInputType.phone
                    : TextInputType.emailAddress,
                onChanged: (_) => setState(() {}),
              ),
              const SizedBox(height: _KSpace.sm),
              const Text(
                'Verifying a phone number here also clears the check at '
                'checkout, so you are not asked twice.',
                style: TextStyle(fontSize: 11.5, color: _KColors.muted),
              ),
            ] else
              _Field(
                controller: _code,
                label: '6-digit code',
                hint: '000000',
                icon: Icons.password_rounded,
                keyboardType: TextInputType.number,
                onChanged: (value) {
                  // Submits itself on the sixth digit. Six digits and then a
                  // reach for a button is one interaction too many on a screen
                  // whose only possible next step is "check this".
                  setState(() {});
                  if (value.trim().length == 6 && !_busy) _confirm();
                },
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
                onPressed: _busy ? null : (sent ? _confirm : _send),
                style: FilledButton.styleFrom(
                  backgroundColor: _KColors.flame,
                  disabledBackgroundColor: _KColors.line,
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(_rPill)),
                ),
                child: Text(
                    _busy
                        ? 'Please wait…'
                        : (sent ? 'Confirm' : 'Send me a code'),
                    style: const TextStyle(
                        fontSize: 15, fontWeight: FontWeight.w700)),
              ),
            ),

            if (sent) ...[
              const SizedBox(height: _KSpace.sm),
              Center(
                child: TextButton(
                  onPressed: _busy
                      ? null
                      : () => setState(() {
                            // Back to the first step rather than straight to a
                            // resend. A shopper asking for a new code has
                            // usually mistyped the contact, and sending a
                            // second one to the same wrong place is the shop
                            // paying twice to fail twice.
                            _challenge = '';
                            _code.clear();
                            _error = null;
                          }),
                  child: const Text('Wrong number? Start again',
                      style: TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                          color: _KColors.flame)),
                ),
              ),
            ],
            SizedBox(
                height: MediaQuery.of(context).padding.bottom + _KSpace.sm),
          ],
        ),
      ),
    );
  }
}
