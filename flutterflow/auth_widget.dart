// Automatic FlutterFlow imports
import '/backend/backend.dart';
import '/backend/supabase/supabase.dart';
import '/flutter_flow/flutter_flow_theme.dart';
import '/flutter_flow/flutter_flow_util.dart';
import '/custom_code/widgets/index.dart'; // Imports other custom widgets
import '/flutter_flow/custom_functions.dart'; // Imports custom functions
import 'package:flutter/material.dart';
// Begin custom widget code
// DO NOT REMOVE OR MODIFY THE CODE ABOVE!

import 'package:google_fonts/google_fonts.dart';
import 'package:flutter/services.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'dart:async';
import 'dart:convert';

// ============================================================
//  KANDI — AUTH
//
//  Sibling of cart_widget.dart, checkout_widget.dart and
//  delivery_address_widget.dart.
//
//  SETUP  (FlutterFlow)
//  -----------------------------------------------------------
//  • Custom Widget name:  KandiAuthPage   (must match the class)
//  • Dependencies (Settings ▸ Pubspec):
//        google_fonts: ^6.1.0
//        supabase_flutter: ^2.0.0
//        shared_preferences: ^2.2.2
//  • Parameters — all optional:
//        width, height       double?
//        onLoginSuccess      Action
//        onSignUpSuccess     Action
//
//  WHY THE CHECKOUT NOW DEPENDS ON THIS
//  -----------------------------------------------------------
//  `KandiCheckout` refuses to render its form until there is a
//  Supabase session, and sends the shopper here when there is
//  not. That is a reversal of a decision written into the head
//  of that file — "a shopper does not need an account to buy" —
//  and it was made deliberately, so the reasoning on both sides
//  is recorded at `_authGate` over there rather than lost.
//
//  What this screen must keep doing for that to work:
//
//    • `Navigator.pop` on success. The checkout pushes this and
//      awaits the pop, then re-reads the session. If this screen
//      ever stops popping, the checkout waits forever.
//    • Leave `onLoginSuccess` / `onSignUpSuccess` optional. The
//      checkout does not pass them — it watches the session
//      itself, which is the only thing that cannot lie.
//
//  ---- The cart merge, and the key mismatch it has ----
//
//  `_CartMerge` moves an anonymous basket onto the account at
//  `kandi_cart_<userId>`, reading `kandi_cart_anonymous`.
//
//  NOTHING ELSE IN THIS APP USES THOSE KEYS. The basket every
//  other screen reads and writes is `kandi-cart-v2`, per device,
//  no account — see the long note at the head of `cart_widget.dart`.
//  So this merge currently runs against keys that are always
//  empty and is a no-op.
//
//  It is left in place rather than deleted because it is
//  harmless, it is wrapped in its own try/catch, and it is the
//  right shape for the day this shop does move the basket
//  server-side. It is recorded here so nobody later reads it as
//  evidence that the basket is per-account. It is not. Signing
//  in does not currently change which basket you are looking at.
//
//  Supabase hardening kept from the original:
//   • ONE auth-state listener (created in initState, cancelled
//     in dispose) — the older code attached a new listener on
//     every social-button tap, causing duplicate callbacks and
//     memory leaks.
//   • Success handled exactly once via a guard flag.
//   • Proper email regex validation, autofill hints, and
//     keyboard actions (next / done submits the form).
// ============================================================

// ---------- Shared palette ----------
const Color _gold = Color(0xFFFF6A00);
const Color _goldDeep = Color(0xFFE62E04);
const Color _goldTint = Color(0xFFFFF1E6);
const Color _ink = Color(0xFF191919);
const Color _inkSoft = Color(0xFF424242);
const Color _muted = Color(0xFF757575);
const Color _ivory = Color(0xFFF5F5F5);
const Color _sand = Color(0xFFEFEFEF);
const Color _hairline = Color(0xFFE8E8E8);
const Color _ember = Color(0xFFFF4747);
const Color _emberTint = Color(0xFFFFECEC);
const Color _leaf = Color(0xFF16A34A);
const Color _leafTint = Color(0xFFDCFCE7);
const Color _white = Colors.white;

TextStyle _displayStyle({double size = 20, Color color = _ink}) =>
    GoogleFonts.fraunces(
      fontSize: size,
      fontWeight: FontWeight.w700,
      color: color,
      height: 1.15,
      letterSpacing: -0.3,
    );

TextStyle _bodyStyle(
        {double size = 13,
        Color color = _inkSoft,
        FontWeight weight = FontWeight.w500}) =>
    GoogleFonts.dmSans(
        fontSize: size, fontWeight: weight, color: color, height: 1.4);

TextStyle _labelStyle(
        {double size = 11,
        Color color = _muted,
        FontWeight weight = FontWeight.w600,
        double spacing = 0.3}) =>
    GoogleFonts.dmSans(
        fontSize: size,
        fontWeight: weight,
        color: color,
        letterSpacing: spacing);

final RegExp _emailRegex = RegExp(r'^[\w\.\-\+]+@([\w\-]+\.)+[A-Za-z]{2,}$');

// ---------- Press feedback ----------
class _Press extends StatefulWidget {
  final Widget child;
  final VoidCallback? onTap;
  final double scale;
  const _Press({required this.child, this.onTap, this.scale = 0.97});

  @override
  State<_Press> createState() => _PressState();
}

class _PressState extends State<_Press> {
  bool _down = false;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTapDown: (_) => setState(() => _down = true),
      onTapUp: (_) => setState(() => _down = false),
      onTapCancel: () => setState(() => _down = false),
      onTap: widget.onTap,
      child: AnimatedScale(
        scale: _down ? widget.scale : 1.0,
        duration: const Duration(milliseconds: 110),
        curve: Curves.easeOut,
        child: AnimatedOpacity(
          opacity: _down ? 0.85 : 1.0,
          duration: const Duration(milliseconds: 110),
          child: widget.child,
        ),
      ),
    );
  }
}

/// ============================================================
/// CART MERGE — moves the anonymous cart onto the user account
///
/// Reads `kandi_cart_anonymous`, writes `kandi_cart_<userId>`.
/// NEITHER KEY IS THE APP'S BASKET — see the header. This is a
/// no-op today and kept for the day the basket moves per-account.
/// ============================================================
class _CartMerge {
  static const String _prefix = 'kandi_cart_';
  static const String _anonKey = 'kandi_cart_anonymous';

  static Future<void> mergeAnonToUser(String userId) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final anonJson = prefs.getString(_anonKey);

      if (anonJson == null || anonJson.isEmpty) {
        await _migrateOld(userId, prefs);
        return;
      }

      final List<dynamic> anonItems = jsonDecode(anonJson);
      if (anonItems.isEmpty) {
        await _migrateOld(userId, prefs);
        return;
      }

      final userKey = '$_prefix$userId';
      final userJson = prefs.getString(userKey);
      List<Map<String, dynamic>> userItems = [];

      if (userJson != null && userJson.isNotEmpty) {
        final List<dynamic> decoded = jsonDecode(userJson);
        userItems = decoded.map((e) => Map<String, dynamic>.from(e)).toList();
      }

      for (final anonItem in anonItems) {
        final item = Map<String, dynamic>.from(anonItem);
        final idx = userItems.indexWhere((i) =>
            i['product_id'] == item['product_id'] &&
            i['size'] == item['size'] &&
            i['color'] == item['color']);

        if (idx >= 0) {
          userItems[idx]['quantity'] =
              (userItems[idx]['quantity'] ?? 1) + (item['quantity'] ?? 1);
        } else {
          item['id'] = DateTime.now().millisecondsSinceEpoch + userItems.length;
          userItems.add(item);
        }
      }

      await prefs.setString(userKey, jsonEncode(userItems));
      await prefs.remove(_anonKey);
      await _migrateOld(userId, prefs);

      debugPrint('Cart merge complete: ${userItems.length} items');
    } catch (e) {
      debugPrint('Cart merge error: $e');
    }
  }

  static Future<void> _migrateOld(
      String userId, SharedPreferences prefs) async {
    try {
      final oldKey = 'local_cart_items_$userId';
      final oldJson = prefs.getString(oldKey);
      if (oldJson != null && oldJson.isNotEmpty) {
        final List<dynamic> oldItems = jsonDecode(oldJson);
        if (oldItems.isEmpty) return;

        final newKey = '$_prefix$userId';
        final existingJson = prefs.getString(newKey);
        List<Map<String, dynamic>> items = [];

        if (existingJson != null && existingJson.isNotEmpty) {
          final List<dynamic> decoded = jsonDecode(existingJson);
          items = decoded.map((e) => Map<String, dynamic>.from(e)).toList();
        }

        for (final old in oldItems) {
          items.add(Map<String, dynamic>.from(old));
        }

        await prefs.setString(newKey, jsonEncode(items));
        await prefs.remove(oldKey);
      }
    } catch (e) {
      debugPrint('Migration error: $e');
    }
  }
}

/// ============================================================
/// KANDI AUTH PAGE
/// ============================================================
class KandiAuthPage extends StatefulWidget {
  const KandiAuthPage({
    super.key,
    this.width,
    this.height,
    this.onLoginSuccess,
    this.onSignUpSuccess,
  });

  final double? width, height;
  final Future Function()? onLoginSuccess;
  final Future Function()? onSignUpSuccess;

  /// True when somebody is signed in on this device.
  ///
  /// A static on the widget class because that is the only symbol FlutterFlow
  /// exports from this file — the checkout calls this to decide whether to
  /// draw its form or its gate.
  ///
  /// Reads `currentSession` rather than `currentUser`: a user object can
  /// linger after a session has expired, and "there is a user object" is not
  /// the same claim as "this device can authenticate right now".
  static bool isSignedIn() {
    try {
      return Supabase.instance.client.auth.currentSession != null;
    } catch (_) {
      // Supabase not initialised in this project. Treated as signed out rather
      // than crashing the screen that asked — the gate then shows, the button
      // opens this page, and the failure is visible instead of silent.
      return false;
    }
  }

  /// Opens the auth screen and resolves when it closes.
  ///
  /// The caller re-checks `isSignedIn()` afterwards rather than trusting a
  /// result from here: the shopper may have signed in, backed out, or signed
  /// in through the OAuth redirect while this was open, and the session is the
  /// only thing that knows which.
  static Future<void> open(BuildContext context) {
    return Navigator.of(context).push(
      MaterialPageRoute<void>(builder: (_) => const KandiAuthPage()),
    );
  }

  @override
  State<KandiAuthPage> createState() => _KandiAuthPageState();
}

class _KandiAuthPageState extends State<KandiAuthPage>
    with SingleTickerProviderStateMixin {
  bool _loading = false;
  bool _authHandled = false;
  String? _errorMsg;
  String? _successMsg;

  StreamSubscription<AuthState>? _authSub;
  late AnimationController _introCtrl;

  SupabaseClient get _db => Supabase.instance.client;

  @override
  void initState() {
    super.initState();
    _introCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 650),
    )..forward();

    // ONE listener for the whole page — handles OAuth redirects
    // (Google / Apple) coming back into the app.
    _authSub = _db.auth.onAuthStateChange.listen((data) {
      if (data.event == AuthChangeEvent.signedIn &&
          data.session != null &&
          mounted &&
          !_authHandled) {
        _handleAuthSuccess(data.session!.user.id);
      }
    });
  }

  @override
  void dispose() {
    _authSub?.cancel();
    _introCtrl.dispose();
    super.dispose();
  }

  void _showError(String msg) {
    HapticFeedback.heavyImpact();
    if (!mounted) return;
    setState(() {
      _errorMsg = msg;
      _successMsg = null;
    });
    Future.delayed(const Duration(seconds: 4), () {
      if (mounted) setState(() => _errorMsg = null);
    });
  }

  void _showSuccess(String msg) {
    if (!mounted) return;
    setState(() {
      _successMsg = msg;
      _errorMsg = null;
    });
  }

  Future<void> _handleAuthSuccess(String userId,
      {bool isSignUp = false}) async {
    if (_authHandled) return;
    _authHandled = true;

    HapticFeedback.mediumImpact();
    await _CartMerge.mergeAnonToUser(userId);
    _showSuccess(isSignUp ? 'Account created — welcome!' : 'Welcome back!');
    await Future.delayed(const Duration(milliseconds: 400));

    if (isSignUp) {
      await widget.onSignUpSuccess?.call();
    } else {
      await widget.onLoginSuccess?.call();
    }

    // ---- The pop that the checkout gate is waiting on ----
    //
    // This screen is pushed by `KandiCheckout` when there is no session, and
    // that push is awaited: the checkout re-reads the session the moment this
    // route closes. Without this, a shopper who signed in successfully would
    // sit on a "Welcome back!" screen with no way forward but the back button,
    // which is the one gesture that reads as "cancel".
    //
    // `maybePop` rather than `pop` because this is also a page in its own
    // right — reached from the account tab, where it is the FIRST route and
    // has nothing to pop to. `maybePop` returns false there and leaves the
    // screen up, which is correct.
    //
    // After the FlutterFlow actions, not before: `onLoginSuccess` may navigate
    // somewhere itself, and popping first would tear this route down
    // underneath it.
    if (mounted) Navigator.of(context).maybePop();
  }

  Future<void> _signInWithOAuth(OAuthProvider provider) async {
    HapticFeedback.mediumImpact();
    if (!mounted) return;
    setState(() => _loading = true);
    try {
      await _db.auth.signInWithOAuth(
        provider,
        redirectTo: 'io.supabase.kandiapp://login-callback',
      );
      // Success is handled by the single listener in initState.
    } catch (e) {
      _showError(provider == OAuthProvider.google
          ? 'Google sign in failed — please try again'
          : 'Apple sign in failed — please try again');
    }
    if (mounted) setState(() => _loading = false);
  }

  @override
  Widget build(BuildContext context) {
    // ---- `Material` + `DefaultTextStyle`, not a bare `Container` ----
    //
    // Without a `Material` ancestor every `Text` on this screen inherits
    // Flutter's debug fallback and wears a double yellow underline — the same
    // fault that was on the product, cart, wishlist, home and category
    // screens. The full argument is at `_screen` in
    // `product_detail_widget.dart`.
    //
    // It bites harder here than anywhere else, because this screen is the
    // first thing a new shopper sees after being told they must sign in to
    // buy. Underlined text on a form asking for a password does not read as a
    // rendering quirk; it reads as a page that is not what it claims to be.
    return Material(
      color: _ivory,
      child: DefaultTextStyle(
        style: _bodyStyle(size: 13, color: _inkSoft)
            .copyWith(decoration: TextDecoration.none),
        child: SizedBox(
          width: widget.width ?? double.infinity,
          height: widget.height ?? double.infinity,
          child: SafeArea(
            child: Column(
              children: [
                _buildHeader(),
                Expanded(
                  child: SingleChildScrollView(
                    physics: const BouncingScrollPhysics(),
                    padding: const EdgeInsets.symmetric(horizontal: 20),
                    child: FadeTransition(
                      opacity: CurvedAnimation(
                          parent: _introCtrl, curve: Curves.easeOut),
                      child: SlideTransition(
                        position: Tween<Offset>(
                          begin: const Offset(0, 0.04),
                          end: Offset.zero,
                        ).animate(CurvedAnimation(
                            parent: _introCtrl, curve: Curves.easeOutCubic)),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            const SizedBox(height: 22),
                            Container(width: 26, height: 2.5, color: _gold),
                            const SizedBox(height: 12),
                            Text('Log in or sign up',
                                style: _displayStyle(size: 26)),
                            const SizedBox(height: 6),
                            Text(
                              'Save your wishlist, track orders and check out faster.',
                              style: _bodyStyle(size: 13, color: _muted),
                            ),
                            const SizedBox(height: 24),
                            if (_errorMsg != null)
                              _buildMessage(_errorMsg!, isError: true),
                            if (_successMsg != null)
                              _buildMessage(_successMsg!, isError: false),
                            _socialBtn(
                              onTap: _loading
                                  ? null
                                  : () => _signInWithOAuth(OAuthProvider.apple),
                              icon:
                                  const Icon(Icons.apple, size: 24, color: _ink),
                              label: 'Continue with Apple',
                            ),
                            const SizedBox(height: 10),
                            _socialBtn(
                              onTap: _loading
                                  ? null
                                  : () =>
                                      _signInWithOAuth(OAuthProvider.google),
                              icon: SizedBox(
                                width: 20,
                                height: 20,
                                child: CustomPaint(painter: _GooglePainter()),
                              ),
                              label: 'Continue with Google',
                            ),
                            const SizedBox(height: 22),
                            _buildDivider(),
                            const SizedBox(height: 22),
                            _buildEmailButton(),
                            const SizedBox(height: 18),
                            _buildTrustRow(),
                          ],
                        ),
                      ),
                    ),
                  ),
                ),
                _buildFooter(),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildHeader() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 12, 16, 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Row(
            children: [
              Text('kandi', style: _displayStyle(size: 26)),
              const SizedBox(width: 6),
              Container(
                width: 7,
                height: 7,
                decoration:
                    const BoxDecoration(color: _gold, shape: BoxShape.circle),
              ),
            ],
          ),
          _Press(
            onTap: () => Navigator.of(context).maybePop(),
            child: Container(
              width: 38,
              height: 38,
              decoration: BoxDecoration(
                color: _white,
                shape: BoxShape.circle,
                border: Border.all(color: _hairline, width: 1),
              ),
              child: const Icon(Icons.close_rounded, size: 18, color: _ink),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildMessage(String msg, {required bool isError}) {
    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      padding: const EdgeInsets.all(13),
      decoration: BoxDecoration(
        color: isError ? _emberTint : _leafTint,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(
            color: (isError ? _ember : _leaf).withOpacity(0.4), width: 1),
      ),
      child: Row(
        children: [
          Icon(
            isError
                ? Icons.error_outline_rounded
                : Icons.check_circle_outline_rounded,
            color: isError ? _ember : _leaf,
            size: 19,
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Text(msg,
                style: _bodyStyle(size: 12.5, color: isError ? _ember : _leaf)),
          ),
          GestureDetector(
            onTap: () => setState(() {
              _errorMsg = null;
              _successMsg = null;
            }),
            child: Icon(Icons.close_rounded,
                size: 17, color: isError ? _ember : _leaf),
          ),
        ],
      ),
    );
  }

  Widget _socialBtn({
    required VoidCallback? onTap,
    required Widget icon,
    required String label,
  }) {
    return _Press(
      onTap: onTap,
      child: Container(
        height: 52,
        decoration: BoxDecoration(
          color: _white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: _hairline, width: 1.2),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            icon,
            const SizedBox(width: 12),
            Text(label,
                style: GoogleFonts.dmSans(
                    fontSize: 14.5, fontWeight: FontWeight.w600, color: _ink)),
          ],
        ),
      ),
    );
  }

  Widget _buildDivider() {
    return Row(
      children: [
        const Expanded(child: Divider(color: _hairline, thickness: 1)),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 14),
          child: Text('or', style: _labelStyle(size: 12, color: _muted)),
        ),
        const Expanded(child: Divider(color: _hairline, thickness: 1)),
      ],
    );
  }

  /// Primary CTA — ink block with gold frame, same as the
  /// flash-sale ticket / Apply buttons across the app.
  Widget _buildEmailButton() {
    return _Press(
      onTap: _loading ? null : _showEmailBottomSheet,
      child: Container(
        height: 54,
        decoration: BoxDecoration(
          color: _ink,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: _gold, width: 1.3),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.email_outlined, size: 20, color: _gold),
            const SizedBox(width: 10),
            Text('Continue with Email',
                style: GoogleFonts.dmSans(
                    fontSize: 15,
                    fontWeight: FontWeight.w700,
                    color: _gold,
                    letterSpacing: 0.2)),
          ],
        ),
      ),
    );
  }

  Widget _buildTrustRow() {
    Widget item(IconData i, String t) => Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(i, size: 13, color: _goldDeep),
            const SizedBox(width: 5),
            Text(t, style: _labelStyle(size: 10, color: _inkSoft)),
          ],
        );

    return Container(
      padding: const EdgeInsets.symmetric(vertical: 10),
      decoration: const BoxDecoration(
        border: Border(
          top: BorderSide(color: _hairline, width: 1),
          bottom: BorderSide(color: _hairline, width: 1),
        ),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceEvenly,
        children: [
          item(Icons.lock_outline_rounded, 'Secure sign in'),
          Container(width: 1, height: 12, color: _hairline),
          item(Icons.shopping_bag_outlined, 'Cart is saved'),
          Container(width: 1, height: 12, color: _hairline),
          item(Icons.bolt_rounded, 'Faster checkout'),
        ],
      ),
    );
  }

  Widget _buildFooter() {
    return Padding(
      padding: const EdgeInsets.all(20),
      child: RichText(
        textAlign: TextAlign.center,
        text: TextSpan(
          style: _bodyStyle(size: 11.5, color: _muted),
          children: [
            const TextSpan(
                text:
                    'By signing up or logging into your account, you accept the '),
            TextSpan(
              text: 'Terms & Conditions',
              style: GoogleFonts.dmSans(
                  fontSize: 11.5,
                  fontWeight: FontWeight.w700,
                  color: _goldDeep),
            ),
            const TextSpan(text: ' and '),
            TextSpan(
              text: 'Privacy & Cookie Policy',
              style: GoogleFonts.dmSans(
                  fontSize: 11.5,
                  fontWeight: FontWeight.w700,
                  color: _goldDeep),
            ),
            const TextSpan(text: '.'),
          ],
        ),
      ),
    );
  }

  void _showEmailBottomSheet() {
    HapticFeedback.lightImpact();
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => _EmailAuthSheet(
        onLoginSuccess: (userId) async {
          Navigator.pop(ctx);
          await _handleAuthSuccess(userId);
        },
        onSignUpSuccess: (userId) async {
          Navigator.pop(ctx);
          await _handleAuthSuccess(userId, isSignUp: true);
        },
        onShowMessage: (msg, isError) {
          if (isError) {
            _showError(msg);
          } else {
            _showSuccess(msg);
          }
        },
      ),
    );
  }
}

/// ============================================================
/// EMAIL AUTH BOTTOM SHEET — login & sign-up flow
/// ============================================================
class _EmailAuthSheet extends StatefulWidget {
  const _EmailAuthSheet({
    required this.onLoginSuccess,
    required this.onSignUpSuccess,
    required this.onShowMessage,
  });

  final Future<void> Function(String userId) onLoginSuccess;
  final Future<void> Function(String userId) onSignUpSuccess;
  final void Function(String message, bool isError) onShowMessage;

  @override
  State<_EmailAuthSheet> createState() => _EmailAuthSheetState();
}

class _EmailAuthSheetState extends State<_EmailAuthSheet> {
  final _emailCtrl = TextEditingController();
  final _passwordCtrl = TextEditingController();
  final _nameCtrl = TextEditingController();
  final _confirmPassCtrl = TextEditingController();

  bool _isSignUpMode = false;
  bool _loading = false;
  bool _showPassword = false;
  bool _showConfirmPassword = false;
  String? _sheetError;
  int _passStrength = 0; // 0–3

  SupabaseClient get _db => Supabase.instance.client;

  @override
  void initState() {
    super.initState();
    _passwordCtrl.addListener(_updateStrength);
  }

  @override
  void dispose() {
    _passwordCtrl.removeListener(_updateStrength);
    _emailCtrl.dispose();
    _passwordCtrl.dispose();
    _nameCtrl.dispose();
    _confirmPassCtrl.dispose();
    super.dispose();
  }

  void _updateStrength() {
    final p = _passwordCtrl.text;
    int s = 0;
    if (p.length >= 6) s++;
    if (p.length >= 10) s++;
    if (RegExp(r'[0-9]').hasMatch(p) &&
        RegExp(r'[A-Za-z]').hasMatch(p) &&
        (RegExp(r'[^A-Za-z0-9]').hasMatch(p) || RegExp(r'[A-Z]').hasMatch(p))) {
      s++;
    }
    if (s != _passStrength && mounted) setState(() => _passStrength = s);
  }

  void _setSheetError(String? msg) {
    HapticFeedback.heavyImpact();
    if (!mounted) return;
    setState(() => _sheetError = msg);
    if (msg != null) {
      Future.delayed(const Duration(seconds: 4), () {
        if (mounted) setState(() => _sheetError = null);
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final bottomInset = MediaQuery.of(context).viewInsets.bottom;

    return Container(
      decoration: const BoxDecoration(
        color: _ivory,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      child: Padding(
        padding: EdgeInsets.only(
          left: 20,
          right: 20,
          top: 12,
          bottom: bottomInset + 20,
        ),
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Center(
                child: Container(
                  width: 40,
                  height: 4,
                  decoration: BoxDecoration(
                    color: _hairline,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
              const SizedBox(height: 20),

              // Segmented Login / Sign up toggle
              Container(
                height: 46,
                padding: const EdgeInsets.all(4),
                decoration: BoxDecoration(
                  color: _sand,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: _hairline),
                ),
                child: Row(
                  children: [
                    _segTab('Log In', !_isSignUpMode, () {
                      if (_isSignUpMode) _switchMode(false);
                    }),
                    _segTab('Sign Up', _isSignUpMode, () {
                      if (!_isSignUpMode) _switchMode(true);
                    }),
                  ],
                ),
              ),
              const SizedBox(height: 18),

              Text(
                _isSignUpMode ? 'Create your account' : 'Welcome back',
                style: _displayStyle(size: 21),
              ),
              const SizedBox(height: 5),
              Text(
                _isSignUpMode
                    ? 'A minute now, faster checkout forever.'
                    : 'Enter your email and password to continue.',
                style: _bodyStyle(size: 13, color: _muted),
              ),
              const SizedBox(height: 18),

              if (_sheetError != null) ...[
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: _emberTint,
                    borderRadius: BorderRadius.circular(10),
                    border:
                        Border.all(color: _ember.withOpacity(0.4), width: 1),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.error_outline_rounded,
                          color: _ember, size: 18),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Text(_sheetError!,
                            style: _bodyStyle(size: 12.5, color: _ember)),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 14),
              ],

              if (_isSignUpMode) ...[
                _fieldLabel('Full name'),
                _buildTextField(
                  controller: _nameCtrl,
                  hint: 'Enter your full name',
                  icon: Icons.person_outline_rounded,
                  keyboardType: TextInputType.name,
                  textInputAction: TextInputAction.next,
                  autofill: const [AutofillHints.name],
                ),
                const SizedBox(height: 14),
              ],

              _fieldLabel('Email'),
              _buildTextField(
                controller: _emailCtrl,
                hint: 'you@example.com',
                icon: Icons.email_outlined,
                keyboardType: TextInputType.emailAddress,
                textInputAction: TextInputAction.next,
                autofill: const [AutofillHints.email],
              ),
              const SizedBox(height: 14),

              _fieldLabel(_isSignUpMode ? 'Create password' : 'Password'),
              _buildTextField(
                controller: _passwordCtrl,
                hint: _isSignUpMode
                    ? 'At least 6 characters'
                    : 'Enter your password',
                icon: Icons.lock_outline_rounded,
                obscure: !_showPassword,
                textInputAction:
                    _isSignUpMode ? TextInputAction.next : TextInputAction.done,
                onSubmitted: _isSignUpMode ? null : (_) => _handleLogin(),
                autofill: const [AutofillHints.password],
                suffix: GestureDetector(
                  onTap: () => setState(() => _showPassword = !_showPassword),
                  child: Icon(
                    _showPassword
                        ? Icons.visibility_off_outlined
                        : Icons.visibility_outlined,
                    color: _muted,
                    size: 20,
                  ),
                ),
              ),

              // Password strength (sign-up only)
              if (_isSignUpMode && _passwordCtrl.text.isNotEmpty) ...[
                const SizedBox(height: 8),
                Row(
                  children: [
                    for (int i = 0; i < 3; i++) ...[
                      Expanded(
                        child: AnimatedContainer(
                          duration: const Duration(milliseconds: 200),
                          height: 3.5,
                          decoration: BoxDecoration(
                            color: i < _passStrength
                                ? (_passStrength == 1
                                    ? _ember
                                    : _passStrength == 2
                                        ? _gold
                                        : _leaf)
                                : _hairline,
                            borderRadius: BorderRadius.circular(2),
                          ),
                        ),
                      ),
                      if (i < 2) const SizedBox(width: 5),
                    ],
                    const SizedBox(width: 10),
                    Text(
                      _passStrength <= 1
                          ? 'Weak'
                          : _passStrength == 2
                              ? 'Good'
                              : 'Strong',
                      style: _labelStyle(
                          size: 10.5,
                          color: _passStrength <= 1
                              ? _ember
                              : _passStrength == 2
                                  ? _goldDeep
                                  : _leaf,
                          weight: FontWeight.w700),
                    ),
                  ],
                ),
              ],

              if (_isSignUpMode) ...[
                const SizedBox(height: 14),
                _fieldLabel('Confirm password'),
                _buildTextField(
                  controller: _confirmPassCtrl,
                  hint: 'Re-enter your password',
                  icon: Icons.lock_outline_rounded,
                  obscure: !_showConfirmPassword,
                  textInputAction: TextInputAction.done,
                  onSubmitted: (_) => _handleSignUp(),
                  suffix: GestureDetector(
                    onTap: () => setState(
                        () => _showConfirmPassword = !_showConfirmPassword),
                    child: Icon(
                      _showConfirmPassword
                          ? Icons.visibility_off_outlined
                          : Icons.visibility_outlined,
                      color: _muted,
                      size: 20,
                    ),
                  ),
                ),
              ],

              if (!_isSignUpMode) ...[
                const SizedBox(height: 12),
                Align(
                  alignment: Alignment.centerRight,
                  child: GestureDetector(
                    onTap: _handleForgotPassword,
                    child: Text(
                      'Forgot password?',
                      style: GoogleFonts.dmSans(
                          fontSize: 12.5,
                          fontWeight: FontWeight.w700,
                          color: _goldDeep),
                    ),
                  ),
                ),
              ],

              const SizedBox(height: 22),

              // Main CTA — ink block with gold frame
              _Press(
                onTap: _loading
                    ? null
                    : (_isSignUpMode ? _handleSignUp : _handleLogin),
                child: Container(
                  height: 54,
                  decoration: BoxDecoration(
                    color: _loading ? _ink.withOpacity(0.75) : _ink,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: _gold, width: 1.3),
                  ),
                  child: Center(
                    child: _loading
                        ? const SizedBox(
                            width: 22,
                            height: 22,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              color: _gold,
                            ),
                          )
                        : Text(
                            _isSignUpMode ? 'Create Account' : 'Log In',
                            style: GoogleFonts.dmSans(
                              fontSize: 15,
                              fontWeight: FontWeight.w700,
                              color: _gold,
                              letterSpacing: 0.2,
                            ),
                          ),
                  ),
                ),
              ),

              const SizedBox(height: 18),

              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Text(
                    _isSignUpMode
                        ? 'Already have an account? '
                        : "Don't have an account? ",
                    style: _bodyStyle(size: 13, color: _muted),
                  ),
                  GestureDetector(
                    onTap: () => _switchMode(!_isSignUpMode),
                    child: Text(
                      _isSignUpMode ? 'Log In' : 'Sign Up',
                      style: GoogleFonts.dmSans(
                          fontSize: 13,
                          fontWeight: FontWeight.w700,
                          color: _goldDeep),
                    ),
                  ),
                ],
              ),

              const SizedBox(height: 8),
            ],
          ),
        ),
      ),
    );
  }

  void _switchMode(bool signUp) {
    HapticFeedback.lightImpact();
    setState(() {
      _isSignUpMode = signUp;
      _sheetError = null;
      _passwordCtrl.clear();
      _confirmPassCtrl.clear();
      _passStrength = 0;
    });
  }

  Widget _segTab(String label, bool active, VoidCallback onTap) {
    return Expanded(
      child: GestureDetector(
        onTap: onTap,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 180),
          curve: Curves.easeOut,
          decoration: BoxDecoration(
            color: active ? _ink : Colors.transparent,
            borderRadius: BorderRadius.circular(9),
          ),
          alignment: Alignment.center,
          child: Text(
            label,
            style: GoogleFonts.dmSans(
              fontSize: 13.5,
              fontWeight: active ? FontWeight.w700 : FontWeight.w500,
              color: active ? _gold : _inkSoft,
            ),
          ),
        ),
      ),
    );
  }

  Widget _fieldLabel(String text) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 7),
      child: Text(text,
          style: _labelStyle(
              size: 12, color: _ink, weight: FontWeight.w600, spacing: 0.1)),
    );
  }

  Widget _buildTextField({
    required TextEditingController controller,
    required String hint,
    required IconData icon,
    bool obscure = false,
    Widget? suffix,
    TextInputType? keyboardType,
    TextInputAction? textInputAction,
    void Function(String)? onSubmitted,
    List<String>? autofill,
  }) {
    return TextField(
      controller: controller,
      obscureText: obscure,
      keyboardType: keyboardType,
      textInputAction: textInputAction,
      onSubmitted: onSubmitted,
      autofillHints: autofill,
      style: _bodyStyle(size: 14.5, color: _ink, weight: FontWeight.w500),
      cursorColor: _goldDeep,
      decoration: InputDecoration(
        hintText: hint,
        hintStyle: _bodyStyle(size: 14, color: _muted),
        filled: true,
        fillColor: _white,
        contentPadding:
            const EdgeInsets.symmetric(horizontal: 14, vertical: 15),
        prefixIcon: Icon(icon, color: _muted, size: 20),
        suffixIcon: suffix != null
            ? Padding(padding: const EdgeInsets.only(right: 12), child: suffix)
            : null,
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: _hairline, width: 1.2),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: _gold, width: 1.5),
        ),
      ),
    );
  }

  Future<void> _handleLogin() async {
    final email = _emailCtrl.text.trim();
    final password = _passwordCtrl.text;

    if (!_emailRegex.hasMatch(email)) {
      _setSheetError('Please enter a valid email address');
      return;
    }
    if (password.length < 6) {
      _setSheetError('Password must be at least 6 characters');
      return;
    }

    HapticFeedback.mediumImpact();
    setState(() => _loading = true);

    try {
      final response = await _db.auth.signInWithPassword(
        email: email,
        password: password,
      );
      if (response.session != null && response.user != null) {
        await widget.onLoginSuccess(response.user!.id);
        return;
      } else {
        _setSheetError('Invalid email or password');
      }
    } on AuthException catch (e) {
      final m = e.message.toLowerCase();
      if (m.contains('invalid')) {
        _setSheetError('Invalid email or password');
      } else if (m.contains('confirm') || m.contains('verify')) {
        _setSheetError('Please verify your email first — check your inbox');
      } else if (m.contains('rate') || m.contains('too many')) {
        _setSheetError('Too many attempts — try again in a minute');
      } else {
        _setSheetError(e.message);
      }
    } catch (e) {
      _setSheetError('Connection problem — check your internet');
    }

    if (mounted) setState(() => _loading = false);
  }

  Future<void> _handleSignUp() async {
    final name = _nameCtrl.text.trim();
    final email = _emailCtrl.text.trim();
    final password = _passwordCtrl.text;
    final confirmPass = _confirmPassCtrl.text;

    if (name.length < 2) {
      _setSheetError('Please enter your full name');
      return;
    }
    if (!_emailRegex.hasMatch(email)) {
      _setSheetError('Please enter a valid email address');
      return;
    }
    if (password.length < 6) {
      _setSheetError('Password must be at least 6 characters');
      return;
    }
    if (password != confirmPass) {
      _setSheetError('Passwords do not match');
      return;
    }

    HapticFeedback.mediumImpact();
    setState(() => _loading = true);

    try {
      final response = await _db.auth.signUp(
        email: email,
        password: password,
        data: {'full_name': name, 'display_name': name},
      );

      if (response.user != null) {
        // Best-effort profile row; ignore if the table/policy differs.
        try {
          await _db.from('profiles').upsert({
            'id': response.user!.id,
            'email': email,
            'full_name': name,
            'display_name': name,
            'created_at': DateTime.now().toIso8601String(),
          });
        } catch (_) {}

        if (response.session != null) {
          await widget.onSignUpSuccess(response.user!.id);
          return;
        } else {
          // Email confirmation is ON in Supabase — no session yet.
          //
          // This is the one path that does NOT satisfy the checkout gate, and
          // it must not pretend otherwise: there is no session, so
          // `isSignedIn()` is still false and the gate will still be there
          // when they get back. The message says to check their inbox, which
          // is the only thing that moves them forward.
          if (mounted) Navigator.pop(context);
          widget.onShowMessage(
              'Almost there! Check $email to verify your account', false);
          return;
        }
      } else {
        _setSheetError('Failed to create account — please try again');
      }
    } on AuthException catch (e) {
      final m = e.message.toLowerCase();
      if (m.contains('already') || m.contains('registered')) {
        _setSheetError('This email is already registered — try logging in');
      } else if (m.contains('rate') || m.contains('too many')) {
        _setSheetError('Too many attempts — try again in a minute');
      } else {
        _setSheetError(e.message);
      }
    } catch (e) {
      _setSheetError('Connection problem — check your internet');
    }

    if (mounted) setState(() => _loading = false);
  }

  void _handleForgotPassword() {
    HapticFeedback.lightImpact();
    _showForgotPasswordSheet();
  }

  void _showForgotPasswordSheet() {
    final resetCtrl = TextEditingController(text: _emailCtrl.text);

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: _ivory,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => Padding(
        padding: EdgeInsets.only(
          left: 20,
          right: 20,
          top: 16,
          bottom: MediaQuery.of(ctx).viewInsets.bottom + 20,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Center(
              child: Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: _hairline,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            const SizedBox(height: 20),
            Text('Reset password', style: _displayStyle(size: 19)),
            const SizedBox(height: 6),
            Text(
              "We'll email you a link to set a new password.",
              style: _bodyStyle(size: 13, color: _muted),
            ),
            const SizedBox(height: 18),
            TextField(
              controller: resetCtrl,
              keyboardType: TextInputType.emailAddress,
              autofillHints: const [AutofillHints.email],
              style:
                  _bodyStyle(size: 14.5, color: _ink, weight: FontWeight.w500),
              cursorColor: _goldDeep,
              decoration: InputDecoration(
                hintText: 'you@example.com',
                hintStyle: _bodyStyle(size: 14, color: _muted),
                filled: true,
                fillColor: _white,
                contentPadding:
                    const EdgeInsets.symmetric(horizontal: 14, vertical: 15),
                prefixIcon:
                    const Icon(Icons.email_outlined, color: _muted, size: 20),
                enabledBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: const BorderSide(color: _hairline, width: 1.2),
                ),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: const BorderSide(color: _gold, width: 1.5),
                ),
              ),
            ),
            const SizedBox(height: 18),
            _Press(
              onTap: () async {
                final email = resetCtrl.text.trim();
                if (!_emailRegex.hasMatch(email)) {
                  widget.onShowMessage('Enter a valid email address', true);
                  Navigator.pop(ctx);
                  return;
                }
                Navigator.pop(ctx);
                try {
                  await _db.auth.resetPasswordForEmail(email);
                  widget.onShowMessage('Reset link sent to $email', false);
                } catch (e) {
                  widget.onShowMessage('Failed to send reset email', true);
                }
              },
              child: Container(
                height: 52,
                decoration: BoxDecoration(
                  color: _ink,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: _gold, width: 1.3),
                ),
                child: Center(
                  child: Text(
                    'Send Reset Link',
                    style: GoogleFonts.dmSans(
                      fontSize: 14.5,
                      fontWeight: FontWeight.w700,
                      color: _gold,
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Google "G" — drawn locally so no network fetch is needed.
class _GooglePainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()..style = PaintingStyle.fill;

    paint.color = const Color(0xFF4285F4);
    canvas.drawArc(
        Rect.fromLTWH(0, 0, size.width, size.height), -0.5, 1.5, true, paint);

    paint.color = const Color(0xFF34A853);
    canvas.drawArc(
        Rect.fromLTWH(0, 0, size.width, size.height), 1.0, 1.0, true, paint);

    paint.color = const Color(0xFFFBBC05);
    canvas.drawArc(
        Rect.fromLTWH(0, 0, size.width, size.height), 2.0, 0.8, true, paint);

    paint.color = const Color(0xFFEA4335);
    canvas.drawArc(
        Rect.fromLTWH(0, 0, size.width, size.height), 2.8, 0.8, true, paint);

    paint.color = Colors.white;
    canvas.drawCircle(
        Offset(size.width / 2, size.height / 2), size.width * 0.35, paint);

    paint.color = const Color(0xFF4285F4);
    canvas.drawRect(
        Rect.fromLTWH(size.width * 0.5, size.height * 0.38, size.width * 0.45,
            size.height * 0.24),
        paint);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
