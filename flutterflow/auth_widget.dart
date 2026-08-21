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

import 'dart:convert';

import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

// ============================================================
//  KANDI — SIGN IN  (v3)
//
//  Sibling of product_detail_widget.dart, cart_widget.dart and
//  checkout_widget.dart. Same brand, same type, same API, same
//  conventions. Nothing is shared between the files because
//  FlutterFlow gives custom widgets no common library to import
//  from — each is a standalone paste.
//
//  WHAT CHANGED FROM v2, AND WHY
//  -----------------------------------------------------------
//  1. IT SIGNS INTO THE SHOP, NOT INTO SUPABASE. v2 called
//     `Supabase.instance.client.auth.signInWithPassword(...)`
//     against a Supabase project. The shop's accounts are
//     WordPress users — that is what the website signs into,
//     what the orders are attached to, and what wp-admin can
//     see.
//
//     Two account systems for one shop is not a slow migration,
//     it is a broken promise: a shopper who registered on
//     kandiug.com could not sign into the app with those
//     details, and one who registered in the app did not exist
//     on the website. Both were told "invalid email or
//     password", which is the message you get when the account
//     is fine and the app is asking the wrong building.
//
//     This version talks to the storefront:
//
//         POST {_kApiBaseUrl}/api/app/auth/login
//         POST {_kApiBaseUrl}/api/app/auth/register
//         POST {_kApiBaseUrl}/api/app/auth/forgot
//         GET  {_kApiBaseUrl}/api/app/auth/me
//
//     which are the same WordPress endpoints, the same rate
//     limits and the same shopper-facing error text the website
//     uses. One account, two doors.
//
//  2. NO CODE, NO INBOX, NO COMING BACK LATER. v2's sign-up went
//     through Supabase with email confirmation on, so creating
//     an account returned NO session — the shopper was sent to
//     their inbox to find a message and click a link, and the
//     app they were mid-purchase in was now two app switches
//     away. Most people do not come back, and the ones who do
//     have lost the basket they were carrying.
//
//     Registering now signs you in on the spot. The only mail
//     this screen can still send is a password reset, which is
//     the one case where the email IS the answer rather than an
//     obstacle in front of it — and it sends a LINK, so it is
//     one tap from the message to the page, not six digits
//     copied between two apps.
//
//  3. ONE SCREEN INSTEAD OF THREE. v2 was a landing page with
//     two social buttons, then a "Continue with email" button,
//     which opened a bottom sheet, which had its own tabs. Four
//     taps before a shopper could type their address, on the
//     screen standing between them and paying.
//
//     It is now one form. The fields are on the page, the button
//     underneath them is the action, and the only choice is
//     whether the account already exists — one row of two tabs,
//     because that genuinely is two different intentions.
//
//  4. BRAND AND TYPE. v2 used Fraunces headings, DM Sans body,
//     a red `_goldDeep` and an ivory page. Matched to the
//     storefront and to the product page: Inter, white page,
//     orange #ff6a00, red reserved strictly for errors.
//
//  ---- WHAT WENT, AND WHAT WOULD BRING IT BACK ----
//
//  THE APPLE AND GOOGLE BUTTONS ARE GONE. They were Supabase
//  OAuth (`signInWithOAuth(OAuthProvider.google)`), and with
//  Supabase out of this app they could not do anything but fail.
//  A one-tap button that never signs anybody in is worse on this
//  screen than no button at all, because it is the tap most
//  people reach for first.
//
//  The server side of Google sign-in already exists and is
//  waiting: `POST /api/auth/google` verifies a Google ID token
//  and returns the same WordPress session these routes do. To
//  turn it on here needs three things that cannot be done from
//  this file — the `google_sign_in` package in the FlutterFlow
//  pubspec, an OAuth client id per platform in the Firebase /
//  Google Cloud console, and an `/api/app/auth/google` route
//  that mirrors the website's. That is a configuration job, not
//  a code one, which is exactly why it is written down here
//  instead of half-built.
//
//  THE `_CartMerge` CLASS IS GONE. It moved a basket from
//  `kandi_cart_anonymous` to `kandi_cart_<userId>`. Nothing in
//  this app has ever used those keys — the basket every screen
//  reads is `kandi-cart-v2`, per device — so it was a no-op
//  running against keys that are always empty. Signing in does
//  not change which basket you are looking at, and now nothing
//  in this file implies that it does.
//
//  SETUP  (FlutterFlow)
//  -----------------------------------------------------------
//  • Custom Widget name:  KandiAuthPage   (must match the class)
//  • Dependencies (Settings ▸ Pubspec):
//        http: ^1.2.0
//        google_fonts: ^6.1.0
//        shared_preferences: ^2.2.2
//    `supabase_flutter` is no longer needed BY THIS FILE. Leave
//    it in the pubspec if any other screen still imports it.
//  • Parameters — all optional:
//        width, height     double?
//        onLoginSuccess    Action
//        onSignUpSuccess   Action
//
//  WHY THE CART AND THE CHECKOUT DEPEND ON THIS
//  -----------------------------------------------------------
//  `KandiCheckout` refuses to render its form without a session
//  and sends the shopper here; the basket does the same before
//  it opens the checkout. What this screen must keep doing:
//
//    • `Navigator.pop` on success. Both callers push this and
//      await the pop, then re-read the session. If this screen
//      stops popping, they wait forever.
//    • Keep `isSignedIn()` synchronous. It is called during a
//      build and during `_load`, where there is nowhere to put
//      an await.
//    • Keep `ensureSignedIn()` the thing a caller awaits on a
//      COLD START. The token lives on disk; a synchronous check
//      before it has been read answers "signed out" for a
//      shopper who is signed in, and shows them a gate they
//      have already passed.
// ============================================================

// ============================================================
// CONFIG — keep identical to the other widgets
// ============================================================

/// The live storefront origin. No trailing slash.
const String _kApiBaseUrl = 'https://kandiug.com';

// ============================================================
// BRAND — matched to app/globals.css
// ============================================================

const Color _kPrimary = Color(0xFFFF6A00);

/// Darkened orange that clears 4.6:1 with white text on it.
const Color _kPrimaryInk = Color(0xFFB34A00);

/// Errors only on this screen. There are no discounts here.
const Color _kSale = Color(0xFFE53935);
const Color _kSaleBg = Color(0xFFFEF2F2);

const Color _kInk = Color(0xFF171717);
const Color _kBody = Color(0xFF475569);
const Color _kMuted = Color(0xFF64748B);
const Color _kFaint = Color(0xFF94A3B8);
const Color _kLine = Color(0xFFE5E7EB);
const Color _kHairline = Color(0xFFF3F4F6);
const Color _kSurface = Color(0xFFFAFAFA);
const Color _kSuccess = Color(0xFF16A34A);
const Color _kSuccessBg = Color(0xFFF0FDF4);
const Color _kWhite = Colors.white;
const Color _kPage = Colors.white;

// ============================================================
// TYPE — Inter, matching the website
// ============================================================

TextStyle _heading({
  double size = 20,
  Color color = _kInk,
  FontWeight weight = FontWeight.w800,
  double? height,
}) =>
    GoogleFonts.inter(
      fontSize: size,
      fontWeight: weight,
      color: color,
      height: height ?? 1.2,
      letterSpacing: size * -0.018,
    );

TextStyle _text({
  double size = 14,
  Color color = _kBody,
  FontWeight weight = FontWeight.w500,
  double? height,
}) =>
    GoogleFonts.inter(
      fontSize: size,
      fontWeight: weight,
      color: color,
      height: height ?? 1.45,
      letterSpacing: size * 0.004,
    );

TextStyle _label({
  double size = 11.5,
  Color color = _kMuted,
  FontWeight weight = FontWeight.w600,
}) =>
    GoogleFonts.inter(
      fontSize: size,
      fontWeight: weight,
      color: color,
      height: 1.25,
      letterSpacing: 0.2,
    );

/// Deliberately permissive.
///
/// It rejects the typo everybody actually makes — a missing `@`, a missing
/// dot, a trailing space — and nothing else. A stricter pattern on a sign-in
/// form is a way of refusing service to somebody with a perfectly valid
/// address that the regex has not heard of, and the server checks it properly
/// anyway.
final RegExp _kEmailPattern = RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]{2,}$');

/// The shortest password the shop accepts, matching WordPress and the website.
///
/// The app used to ask for six. One account system cannot have two minimums:
/// a password accepted on the phone was then rejected by the same shop's
/// website, and the shopper had no way to know which of the two was lying.
const int _kMinPassword = 8;

// ============================================================
// SESSION
// ============================================================

/// The signed-in shopper, on this device.
///
/// ---- Why a bearer token and not a cookie ----
///
/// The website keeps this exact token in an httpOnly cookie, so no script on
/// the page can read it. That defence has no counterpart in an installed app,
/// and the mechanism does not survive the trip: Dart's `http` client keeps no
/// cookie jar, so a cookie-based sign-in would succeed and then be forgotten
/// before the next request. `/api/app/auth/*` therefore hands the token over
/// in the body, and it lives here.
///
/// ---- On SharedPreferences ----
///
/// Not the Keychain or the Android Keystore, which is what a banking app would
/// use. This token is worth a shopper's order history and saved addresses, on
/// a device that is already unlocked, and `flutter_secure_storage` is a fourth
/// dependency and a platform configuration step for each. It is a deliberate
/// trade rather than an oversight, and it is the same one the website makes by
/// keeping the session in a cookie the device also stores in the clear.
class _KandiSession {
  static const String _kToken = 'kandi_auth_token';
  static const String _kExpires = 'kandi_auth_expires';
  static const String _kCustomer = 'kandi_auth_customer';

  static String? _token;
  static DateTime? _expires;
  static Map<String, dynamic>? _customer;

  /// Whether the disk has been read yet in this process.
  static bool _restored = false;

  /// Whether the token has been checked against the server in this process.
  static bool _verified = false;

  static bool get isActive {
    final token = _token;
    if (token == null || token.isEmpty) return false;

    // An expiry in the past is a session that is already over. Checked here
    // rather than only at the server so a shopper who has been away for two
    // months meets the sign-in screen rather than a checkout that fails at the
    // last step for reasons it cannot explain.
    final expires = _expires;
    if (expires != null && expires.isBefore(DateTime.now())) return false;

    return true;
  }

  static String? get token => isActive ? _token : null;
  static Map<String, dynamic>? get customer => isActive ? _customer : null;

  /// Reads the saved session off disk. Cheap to call repeatedly.
  static Future<void> restore() async {
    if (_restored) return;
    _restored = true;

    try {
      final prefs = await SharedPreferences.getInstance();
      _token = prefs.getString(_kToken);

      final expires = prefs.getString(_kExpires);
      _expires = expires == null ? null : DateTime.tryParse(expires);

      final customer = prefs.getString(_kCustomer);
      if (customer != null && customer.isNotEmpty) {
        final decoded = jsonDecode(customer);
        if (decoded is Map) _customer = Map<String, dynamic>.from(decoded);
      }
    } catch (e) {
      debugPrint('Kandi session restore failed: $e');
    }
  }

  static Future<void> save({
    required String token,
    DateTime? expires,
    Map<String, dynamic>? customer,
  }) async {
    _token = token;
    _expires = expires;
    _customer = customer;
    _restored = true;
    // A token that has just come from the server does not need checking
    // against the server.
    _verified = true;

    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_kToken, token);
      if (expires != null) {
        await prefs.setString(_kExpires, expires.toIso8601String());
      } else {
        await prefs.remove(_kExpires);
      }
      if (customer != null) {
        await prefs.setString(_kCustomer, jsonEncode(customer));
      } else {
        await prefs.remove(_kCustomer);
      }
    } catch (e) {
      debugPrint('Kandi session save failed: $e');
    }
  }

  static Future<void> clear() async {
    _token = null;
    _expires = null;
    _customer = null;
    _restored = true;
    _verified = false;

    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.remove(_kToken);
      await prefs.remove(_kExpires);
      await prefs.remove(_kCustomer);
    } catch (e) {
      debugPrint('Kandi session clear failed: $e');
    }
  }

  /// Asks the shop whether this token is still anybody.
  ///
  /// Runs once per app launch, because a token is good for thirty days and a
  /// lot can happen in thirty days that the saved string knows nothing about:
  /// the password changed on the website, the account closed, the token
  /// expired while the phone was off. It also brings back a name edited on the
  /// website, which is how that reaches the app at all.
  ///
  /// ---- Only a 401 signs anybody out ----
  ///
  /// A timeout, a 500, a Ugandan mobile connection dropping mid-request: none
  /// of those are evidence that the session is invalid, and treating them as
  /// such would sign shoppers out every time the network hiccuped. The stored
  /// session is kept and the question is asked again next launch.
  static Future<void> verify() async {
    await restore();
    if (_verified || _token == null) return;
    _verified = true;

    try {
      final response = await http.get(
        Uri.parse('${_base()}/api/app/auth/me'),
        headers: {
          'Accept': 'application/json',
          'Authorization': 'Bearer $_token',
        },
      ).timeout(const Duration(seconds: 12));

      if (response.statusCode == 401) {
        await clear();
        return;
      }

      if (response.statusCode == 200) {
        final decoded = jsonDecode(utf8.decode(response.bodyBytes));
        if (decoded is Map) {
          final map = Map<String, dynamic>.from(decoded);
          // `/me` answers with the customer either at the top level or under a
          // `customer` key depending on the WordPress build. Both are read so
          // a plugin update cannot quietly blank the shopper's name.
          final customer = map['customer'] is Map
              ? Map<String, dynamic>.from(map['customer'] as Map)
              : map;
          _customer = customer;
          try {
            final prefs = await SharedPreferences.getInstance();
            await prefs.setString(_kCustomer, jsonEncode(customer));
          } catch (_) {}
        }
      }
    } catch (e) {
      // Offline, or the shop is having a moment. The session stands.
      debugPrint('Kandi session verify skipped: $e');
    }
  }

  static String _base() => _kApiBaseUrl.replaceAll(RegExp(r'/+$'), '');
}

// ============================================================
// PRESS
// ============================================================

class _Press extends StatefulWidget {
  final Widget child;
  final VoidCallback? onTap;
  const _Press({required this.child, this.onTap});

  static const double _scale = 0.97;

  @override
  State<_Press> createState() => _PressState();
}

class _PressState extends State<_Press> {
  bool _down = false;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      // The press tick, on the way down and only for a live control — the same
      // one every other screen in this app uses, so a press feels identical
      // throughout. Silent for a disabled button: a greyed-out "Sign in" that
      // buzzes has told the finger it worked.
      onTapDown: (_) {
        if (widget.onTap != null) HapticFeedback.selectionClick();
        setState(() => _down = true);
      },
      onTapUp: (_) => setState(() => _down = false),
      onTapCancel: () => setState(() => _down = false),
      onTap: widget.onTap,
      child: AnimatedScale(
        scale: _down ? _Press._scale : 1.0,
        duration: const Duration(milliseconds: 110),
        curve: Curves.easeOut,
        child: widget.child,
      ),
    );
  }
}

// ============================================================
// WIDGET
// ============================================================

/// The class name is `KandiAuthPage`, and it must stay that.
///
/// FlutterFlow generates the call site from the Custom Widget's NAME, and the
/// basket and the checkout both reach this file through statics on this class
/// — which is the only symbol that crosses a FlutterFlow file boundary.
class KandiAuthPage extends StatefulWidget {
  const KandiAuthPage({
    super.key,
    this.width,
    this.height,
    this.onLoginSuccess,
    this.onSignUpSuccess,
  });

  final double? width;
  final double? height;

  /// Fired after a successful sign-in, alongside the pop rather than instead
  /// of it. Optional: the callers watch the session, which is the only thing
  /// that cannot lie.
  final Future Function()? onLoginSuccess;

  /// Fired after a successful registration. Same contract.
  final Future Function()? onSignUpSuccess;

  /// Whether somebody is signed in on this device, right now.
  ///
  /// Synchronous, because it is called from `build` and from `_load` where
  /// there is nowhere to put an await — and it answers from memory only. On a
  /// COLD START, before anything has read the disk, that memory is empty and
  /// this returns false for a shopper who is perfectly well signed in.
  ///
  /// So a caller that might be the first thing to ask should await
  /// `ensureSignedIn()` instead. This one is for the re-checks afterwards.
  static bool isSignedIn() => _KandiSession.isActive;

  /// Whether somebody is signed in, having first read the saved session off
  /// disk and — once per launch — checked it against the shop.
  ///
  /// This is what a cold start should call. The disk read is what makes the
  /// answer true; the server check is what stops a shopper walking into a
  /// checkout on a token the shop stopped honouring a week ago.
  static Future<bool> ensureSignedIn() async {
    await _KandiSession.restore();
    if (!_KandiSession.isActive) return false;
    await _KandiSession.verify();
    return _KandiSession.isActive;
  }

  /// The shopper's WordPress bearer token, or null.
  ///
  /// Exposed for the screens that will eventually send it — an order attached
  /// to the account, an address book that follows the shopper between their
  /// phone and the website. Nothing sends it today.
  static String? token() => _KandiSession.token;

  /// The shopper's display name, or null. Used to greet them, and available to
  /// the checkout so it can prefill the name and email it currently asks every
  /// signed-in shopper to type again.
  static String? customerName() {
    final value = _KandiSession.customer?['name'];
    final name = value?.toString().trim() ?? '';
    return name.isEmpty ? null : name;
  }

  /// The shopper's email address, or null.
  static String? customerEmail() {
    final value = _KandiSession.customer?['email'];
    final email = value?.toString().trim() ?? '';
    return email.isEmpty ? null : email;
  }

  /// Signs out on this device.
  ///
  /// Local only, and deliberately: there is no app endpoint that revokes a
  /// WordPress token, and a sign-out that fails because the network is down is
  /// a sign-out that did not happen — which is the wrong way for this
  /// particular action to fail, especially on a shared phone.
  static Future<void> signOut() => _KandiSession.clear();

  /// Opens the sign-in screen and resolves when it closes.
  ///
  /// The caller re-checks `isSignedIn()` afterwards rather than trusting a
  /// result from here: the shopper may have signed in, or backed out, and the
  /// session is the only thing that knows which.
  static Future<void> open(BuildContext context) {
    return Navigator.of(context).push(
      MaterialPageRoute<void>(builder: (_) => const KandiAuthPage()),
    );
  }

  @override
  State<KandiAuthPage> createState() => _KandiAuthPageState();
}

/// Which of the two things the shopper is here to do.
enum _Mode { signIn, register }

class _KandiAuthPageState extends State<KandiAuthPage> {
  static const double _pad = 20.0;
  static const double _radius = 10.0;

  final TextEditingController _name = TextEditingController();
  final TextEditingController _email = TextEditingController();
  final TextEditingController _password = TextEditingController();

  final FocusNode _nameFocus = FocusNode();
  final FocusNode _emailFocus = FocusNode();
  final FocusNode _passwordFocus = FocusNode();

  _Mode _mode = _Mode.signIn;
  bool _busy = false;
  bool _showPassword = false;

  String? _error;
  String? _notice;

  bool get _isRegister => _mode == _Mode.register;

  @override
  void dispose() {
    _name.dispose();
    _email.dispose();
    _password.dispose();
    _nameFocus.dispose();
    _emailFocus.dispose();
    _passwordFocus.dispose();
    super.dispose();
  }

  String get _base => _kApiBaseUrl.replaceAll(RegExp(r'/+$'), '');

  // ==========================================================
  // THE TWO REQUESTS
  // ==========================================================

  /// Posts to one of the auth routes and returns the decoded body.
  ///
  /// One helper for all three because they answer in one shape: a `message` on
  /// anything that went wrong, a `token` on anything that went right. Writing
  /// that out three times is three chances to handle a 429 in two different
  /// ways.
  Future<({int status, Map<String, dynamic> body})> _post(
    String path,
    Map<String, dynamic> payload,
  ) async {
    final response = await http
        .post(
          Uri.parse('$_base$path'),
          headers: const {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          body: jsonEncode(payload),
        )
        .timeout(const Duration(seconds: 20));

    Map<String, dynamic> body = <String, dynamic>{};
    try {
      final decoded = jsonDecode(utf8.decode(response.bodyBytes));
      if (decoded is Map) body = Map<String, dynamic>.from(decoded);
    } catch (_) {
      // A gateway error page rather than JSON. `body` stays empty and the
      // caller falls back to its own wording.
    }

    return (status: response.statusCode, body: body);
  }

  /// Sign in, or create the account and sign in. One path, because from the
  /// shopper's side they are the same act with a different starting point.
  Future<void> _submit() async {
    if (_busy) return;

    final name = _name.text.trim();
    final email = _email.text.trim();
    final password = _password.text;

    // Validated here as well as on the server, so the answer is instant
    // instead of a round trip to a shared host in Uganda. The server still
    // refuses anything that arrives another way.
    if (_isRegister && name.isEmpty) {
      _fail('Enter your name so we know who to address the delivery to.');
      _nameFocus.requestFocus();
      return;
    }
    if (!_kEmailPattern.hasMatch(email)) {
      _fail('That email address does not look right.');
      _emailFocus.requestFocus();
      return;
    }
    if (password.isEmpty) {
      _fail('Enter your password.');
      _passwordFocus.requestFocus();
      return;
    }
    // Only on the way IN. An existing account with a shorter password must
    // still be able to sign in — telling somebody their real password is "too
    // short" at the sign-in screen is a dead end with no action behind it.
    if (_isRegister && password.length < _kMinPassword) {
      _fail('Use at least $_kMinPassword characters for your password.');
      _passwordFocus.requestFocus();
      return;
    }

    // The keyboard comes down before the request goes out, so the button the
    // shopper just pressed and the message that answers it are both visible.
    FocusScope.of(context).unfocus();
    HapticFeedback.mediumImpact();

    setState(() {
      _busy = true;
      _error = null;
      _notice = null;
    });

    try {
      final result = await _post(
        _isRegister ? '/api/app/auth/register' : '/api/app/auth/login',
        _isRegister
            ? {'name': name, 'email': email, 'password': password}
            : {'email': email, 'password': password},
      );

      final token = result.body['token']?.toString() ?? '';

      if (result.status == 200 && token.isNotEmpty) {
        final expires = result.body['expiresAt']?.toString();
        final customer = result.body['customer'] is Map
            ? Map<String, dynamic>.from(result.body['customer'] as Map)
            : null;

        await _KandiSession.save(
          token: token,
          expires: expires == null ? null : DateTime.tryParse(expires),
          customer: customer,
        );

        if (!mounted) return;
        HapticFeedback.mediumImpact();

        // Both fire, and the pop is what the basket and the checkout are
        // awaiting — see the header note. The Action runs first so a project
        // that wired one has done its work before this screen goes away.
        if (_isRegister) {
          await widget.onSignUpSuccess?.call();
        } else {
          await widget.onLoginSuccess?.call();
        }

        if (!mounted) return;

        // Cleared before the pop, not after it. `maybePop` does nothing when
        // this screen is the root of its navigator — which is how FlutterFlow
        // renders a custom widget dropped straight onto a page — and a button
        // left spinning on a shopper who is now signed in is the one outcome
        // here that looks like a failure and is not.
        setState(() => _busy = false);
        Navigator.of(context).maybePop();
        return;
      }

      // ---- The account already exists ----
      //
      // WordPress answers 409 to a registration for an address it already
      // knows. Rather than printing that and leaving the shopper to work out
      // what to do, the form flips itself to Sign in with the address still in
      // the box: the next thing they need is the one thing now in front of
      // them.
      if (_isRegister && result.status == 409) {
        setState(() {
          _mode = _Mode.signIn;
          _busy = false;
          _notice =
              'You already have an account with that email. Enter your password to sign in.';
        });
        _passwordFocus.requestFocus();
        return;
      }

      _fail(
        result.body['message']?.toString() ??
            'Could not sign you in. Please try again.',
      );
    } catch (e) {
      debugPrint('Kandi auth failed: $e');
      // Deliberately not the raw exception: a shopper cannot act on
      // "SocketException: Failed host lookup".
      _fail('Could not reach the shop. Check your connection and try again.');
    }
  }

  /// The reset email.
  ///
  /// A link, not a code — one tap from the message to the page that sets the
  /// password, rather than six digits copied between two apps. And the reply
  /// is the same whether or not the address has an account, which is why the
  /// confirmation is worded the way it is: anything more specific would let
  /// anybody test addresses against this shop.
  Future<void> _resetPassword() async {
    if (_busy) return;

    final email = _email.text.trim();
    if (!_kEmailPattern.hasMatch(email)) {
      _fail('Enter your email address first, and we will send you a link.');
      _emailFocus.requestFocus();
      return;
    }

    FocusScope.of(context).unfocus();
    HapticFeedback.lightImpact();

    setState(() {
      _busy = true;
      _error = null;
      _notice = null;
    });

    try {
      final result = await _post('/api/app/auth/forgot', {'email': email});
      if (!mounted) return;

      if (result.status == 429) {
        _fail(result.body['message']?.toString() ??
            'Too many attempts. Please wait a few minutes.');
        return;
      }

      setState(() {
        _busy = false;
        _notice =
            'If that address has an account, a reset link is on its way. Open it, '
            'set a new password, then come back and sign in.';
      });
    } catch (e) {
      debugPrint('Kandi reset failed: $e');
      _fail('Could not reach the shop. Check your connection and try again.');
    }
  }

  void _fail(String message) {
    HapticFeedback.heavyImpact();
    if (!mounted) return;
    setState(() {
      _busy = false;
      _notice = null;
      _error = message;
    });
  }

  void _switchMode(_Mode mode) {
    if (_mode == mode) return;
    HapticFeedback.selectionClick();
    SystemSound.play(SystemSoundType.click);
    setState(() {
      _mode = mode;
      // The messages belonged to the other mode. An error about a password
      // that is too short, still sitting there after switching to Sign in,
      // reads as a complaint about the password they are about to type.
      _error = null;
      _notice = null;
    });
  }

  // ==========================================================
  // BUILD
  // ==========================================================

  @override
  Widget build(BuildContext context) {
    // ---- `Material` + `DefaultTextStyle`, not a bare `Container` ----
    //
    // Without a `Material` ancestor every `Text` inherits Flutter's debug
    // fallback and wears a double yellow underline. The full argument is at
    // `_screen` in `product_detail_widget.dart`.
    //
    // It bites hardest here, on the screen standing between a new shopper and
    // paying: underlined text on a form asking for a password does not read as
    // a rendering quirk, it reads as a page that is not what it claims to be.
    return Material(
      color: _kPage,
      child: DefaultTextStyle(
        style: _text(size: 14, color: _kInk)
            .copyWith(decoration: TextDecoration.none),
        child: SizedBox(
          width: widget.width ?? double.infinity,
          height: widget.height ?? double.infinity,
          child: SafeArea(
            child: Column(
              children: [
                _topBar(),
                Expanded(
                  child: SingleChildScrollView(
                    // `always` rather than the default: the form is short
                    // enough to fit without scrolling, and when the keyboard is
                    // up the shopper still needs to be able to push the fields
                    // clear of it.
                    physics: const AlwaysScrollableScrollPhysics(
                      parent: BouncingScrollPhysics(),
                    ),
                    padding: const EdgeInsets.fromLTRB(_pad, 4, _pad, 28),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        _intro(),
                        const SizedBox(height: 18),
                        _modeTabs(),
                        const SizedBox(height: 20),
                        if (_error != null) ...[
                          _banner(_error!, isError: true),
                          const SizedBox(height: 14),
                        ],
                        if (_notice != null) ...[
                          _banner(_notice!, isError: false),
                          const SizedBox(height: 14),
                        ],
                        _form(),
                        const SizedBox(height: 18),
                        _submitButton(),
                        const SizedBox(height: 14),
                        _footNote(),
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

  Widget _topBar() => Padding(
        padding: const EdgeInsets.fromLTRB(8, 6, _pad, 2),
        child: Row(
          children: [
            _Press(
              onTap: () {
                HapticFeedback.lightImpact();
                Navigator.of(context).maybePop();
              },
              child: const SizedBox(
                width: 44,
                height: 44,
                child: Icon(Icons.arrow_back_rounded, size: 22, color: _kInk),
              ),
            ),
            const Spacer(),
            // The shop's name, set as the wordmark rather than as a heading:
            // this screen is reached from inside the app, so it is a reminder
            // of where you are, not a title.
            Text(
              'kandi',
              style: _heading(size: 19, color: _kPrimary, weight: FontWeight.w800),
            ),
          ],
        ),
      );

  Widget _intro() => Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            _isRegister ? 'Create your account' : 'Welcome back',
            style: _heading(size: 26),
          ),
          const SizedBox(height: 6),
          Text(
            // Says what the account is FOR. "Sign in to continue" tells a
            // shopper only that something is in their way; this tells them
            // what they get for the thirty seconds it costs.
            _isRegister
                ? 'One step. Track your orders, save your delivery address, and '
                    'check out faster next time.'
                : 'Sign in to track your orders and check out with the details '
                    'you saved.',
            style: _text(size: 13.5, color: _kMuted, height: 1.5),
          ),
        ],
      );

  /// The only choice on the screen: do you have an account already.
  ///
  /// A two-tab segment rather than the "Don't have an account? Sign up" link
  /// at the bottom of most forms. The link is smaller than a thumb, it is at
  /// the far end of the screen from where the eye starts, and it changes the
  /// meaning of everything above it without being anywhere near it. Two tabs
  /// at the top say what the form is before it is read.
  Widget _modeTabs() {
    Widget tab(String label, _Mode mode) {
      final active = _mode == mode;
      return Expanded(
        child: _Press(
          onTap: () => _switchMode(mode),
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 160),
            curve: Curves.easeOut,
            height: 42,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: active ? _kWhite : Colors.transparent,
              borderRadius: BorderRadius.circular(8),
              border: Border.all(
                color: active ? _kLine : Colors.transparent,
              ),
            ),
            child: Text(
              label,
              style: _text(
                size: 14,
                color: active ? _kInk : _kMuted,
                weight: active ? FontWeight.w700 : FontWeight.w500,
              ),
            ),
          ),
        ),
      );
    }

    return Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: _kSurface,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: _kHairline),
      ),
      child: Row(
        children: [
          tab('Sign in', _Mode.signIn),
          const SizedBox(width: 4),
          tab('Create account', _Mode.register),
        ],
      ),
    );
  }

  Widget _form() => Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Only asked for when creating an account, and asked for FIRST,
          // because it is the one field that is not a credential — it is the
          // friendly question, and it is what the delivery note gets addressed
          // to.
          if (_isRegister) ...[
            _field(
              label: 'Your name',
              controller: _name,
              focus: _nameFocus,
              hint: 'e.g. Sarah Namuli',
              keyboard: TextInputType.name,
              textCapitalization: TextCapitalization.words,
              autofill: const [AutofillHints.name],
              action: TextInputAction.next,
              onSubmitted: (_) => _emailFocus.requestFocus(),
              icon: Icons.person_outline_rounded,
            ),
            const SizedBox(height: 14),
          ],
          _field(
            label: 'Email',
            controller: _email,
            focus: _emailFocus,
            hint: 'you@example.com',
            keyboard: TextInputType.emailAddress,
            autofill: const [AutofillHints.email],
            action: TextInputAction.next,
            onSubmitted: (_) => _passwordFocus.requestFocus(),
            icon: Icons.mail_outline_rounded,
          ),
          const SizedBox(height: 14),
          _field(
            label: 'Password',
            controller: _password,
            focus: _passwordFocus,
            hint: _isRegister ? 'At least $_kMinPassword characters' : '••••••••',
            obscure: !_showPassword,
            keyboard: TextInputType.visiblePassword,
            autofill: [
              _isRegister ? AutofillHints.newPassword : AutofillHints.password
            ],
            // `done` submits. On a two-field form the keyboard's own button is
            // the fastest way to finish, and a shopper who has just typed a
            // password should not have to dismiss the keyboard to find the
            // button it is covering.
            action: TextInputAction.done,
            onSubmitted: (_) => _submit(),
            icon: Icons.lock_outline_rounded,
            // Shown rather than hidden, on request. Typing a password blind on
            // a phone keyboard is where most sign-in failures are actually
            // made — and this is a shopping account, not a bank.
            trailing: _Press(
              onTap: () {
                HapticFeedback.selectionClick();
                setState(() => _showPassword = !_showPassword);
              },
              child: SizedBox(
                width: 46,
                height: 46,
                child: Icon(
                  _showPassword
                      ? Icons.visibility_off_outlined
                      : Icons.visibility_outlined,
                  size: 19,
                  color: _kMuted,
                ),
              ),
            ),
          ),
          if (!_isRegister) ...[
            const SizedBox(height: 10),
            Align(
              alignment: Alignment.centerRight,
              child: _Press(
                onTap: _busy ? null : _resetPassword,
                child: Padding(
                  padding: const EdgeInsets.symmetric(vertical: 4),
                  child: Text(
                    'Forgot your password?',
                    style: _text(
                      size: 13,
                      color: _kPrimaryInk,
                      weight: FontWeight.w600,
                    ),
                  ),
                ),
              ),
            ),
          ],
        ],
      );

  Widget _field({
    required String label,
    required TextEditingController controller,
    required FocusNode focus,
    required IconData icon,
    String? hint,
    bool obscure = false,
    TextInputType? keyboard,
    TextCapitalization textCapitalization = TextCapitalization.none,
    List<String>? autofill,
    TextInputAction action = TextInputAction.next,
    void Function(String)? onSubmitted,
    Widget? trailing,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: _label(size: 12.5, color: _kBody)),
        const SizedBox(height: 6),
        // `AnimatedBuilder` on the focus node so the border can answer the
        // finger. A field that looks identical whether or not it has the
        // keyboard is a field a shopper taps twice.
        AnimatedBuilder(
          animation: focus,
          builder: (_, __) => Container(
            decoration: BoxDecoration(
              color: _kWhite,
              borderRadius: BorderRadius.circular(_radius),
              border: Border.all(
                color: focus.hasFocus ? _kPrimary : _kLine,
                width: focus.hasFocus ? 1.5 : 1,
              ),
            ),
            child: Row(
              children: [
                Padding(
                  padding: const EdgeInsets.only(left: 12, right: 8),
                  child: Icon(
                    icon,
                    size: 18,
                    color: focus.hasFocus ? _kPrimary : _kFaint,
                  ),
                ),
                Expanded(
                  child: TextField(
                    controller: controller,
                    focusNode: focus,
                    obscureText: obscure,
                    keyboardType: keyboard,
                    textCapitalization: textCapitalization,
                    autofillHints: autofill,
                    textInputAction: action,
                    onSubmitted: onSubmitted,
                    enabled: !_busy,
                    style: _text(size: 15, color: _kInk),
                    cursorColor: _kPrimary,
                    decoration: InputDecoration(
                      hintText: hint,
                      hintStyle: _text(size: 14.5, color: _kFaint),
                      isDense: true,
                      border: InputBorder.none,
                      enabledBorder: InputBorder.none,
                      focusedBorder: InputBorder.none,
                      disabledBorder: InputBorder.none,
                      contentPadding:
                          const EdgeInsets.symmetric(vertical: 15),
                    ),
                  ),
                ),
                if (trailing != null) trailing else const SizedBox(width: 12),
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget _submitButton() {
    final label = _isRegister ? 'Create account' : 'Sign in';

    return _Press(
      onTap: _busy ? null : _submit,
      child: Container(
        height: 52,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: _busy ? _kHairline : _kPrimary,
          borderRadius: BorderRadius.circular(_radius),
        ),
        child: _busy
            ? const SizedBox(
                width: 20,
                height: 20,
                child: CircularProgressIndicator(
                  strokeWidth: 2.2,
                  valueColor: AlwaysStoppedAnimation<Color>(_kMuted),
                ),
              )
            : Text(
                label,
                style: _text(
                  size: 15.5,
                  color: _kWhite,
                  weight: FontWeight.w700,
                ),
              ),
      ),
    );
  }

  /// What the shopper is agreeing to, and what they are not.
  ///
  /// The line about no verification email is deliberate and it is not
  /// boilerplate: the previous version of this screen sent people to their
  /// inbox, so anybody who tried the app before is braced for it. Saying that
  /// it does not happen removes the hesitation before the button rather than
  /// after it.
  Widget _footNote() => Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: _kSurface,
          borderRadius: BorderRadius.circular(_radius),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Icon(Icons.lock_outline_rounded, size: 15, color: _kSuccess),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                _isRegister
                    ? 'No verification email, no code to type — you are signed '
                        'in as soon as you tap the button. Your details are '
                        'used only for your orders.'
                    : 'The same account as kandiug.com. Your details are used '
                        'only for your orders.',
                style: _text(size: 12.5, color: _kMuted, height: 1.45),
              ),
            ),
          ],
        ),
      );

  Widget _banner(String message, {required bool isError}) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 11),
        decoration: BoxDecoration(
          color: isError ? _kSaleBg : _kSuccessBg,
          borderRadius: BorderRadius.circular(_radius),
          border: Border.all(
            color: isError ? _kSale.withOpacity(0.25) : _kSuccess.withOpacity(0.25),
          ),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(
              isError
                  ? Icons.error_outline_rounded
                  : Icons.check_circle_outline_rounded,
              size: 17,
              color: isError ? _kSale : _kSuccess,
            ),
            const SizedBox(width: 9),
            Expanded(
              child: Text(
                message,
                style: _text(
                  size: 13,
                  color: isError ? _kSale : _kSuccess,
                  weight: FontWeight.w600,
                  height: 1.4,
                ),
              ),
            ),
          ],
        ),
      );
}
