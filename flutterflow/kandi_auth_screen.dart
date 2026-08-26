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

import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

// ============================================================
//  KANDI — SIGN IN
//
//  One screen for signing in, joining and resetting a password.
//
//  WHY ONE SCREEN AND NOT THREE
//  -----------------------------------------------------------
//  They are the same form. Sign in is email and password; join
//  is email, password and a name; forgot is email alone. Three
//  screens meant three copies of the field styling, three
//  validators and three error banners — and in the app this
//  replaces they had already drifted, so the same bad password
//  produced a different sentence depending on which one you
//  were looking at.
//
//  Switching mode keeps what has already been typed. Somebody
//  who tries to sign in, is told there is no such account, and
//  taps "Create one" should not have to type their email again.
//
//  GOOGLE SIGN-IN IS ABSENT, AND THAT IS NOT A DESIGN CHOICE
//  -----------------------------------------------------------
//  `google_sign_in` is not in the FlutterFlow pubspec, and a
//  pasted custom widget cannot add a dependency — the whole web
//  build fails on the missing package, in every widget at once.
//  The same thing happened to the seller centre and to
//  `geolocator` before it.
//
//  The SERVER half already exists: `/api/app/auth/google` takes
//  a credential and returns a session. To restore the button:
//    1. FlutterFlow > Settings > App Settings > Pubspec, add
//       google_sign_in: ^6.2.2
//    2. A WEB OAuth client id, passed as
//       --dart-define=GOOGLE_SERVER_CLIENT_ID=...
//       Without a serverClientId the plugin returns a null
//       idToken on Android — sign-in appears to work and the
//       server gets nothing to verify.
//    3. Platform setup: an Android OAuth client with the SHA-1,
//       and the reversed client id in Info.plist for iOS.
//  Do not add the import without the pubspec entry.
// ============================================================

enum KandiAuthMode { signIn, join, forgot }

/// The shopper's session, written where the rest of the app already looks.
///
/// The keys are unchanged from the screen this replaces — `kandi_auth_token`,
/// `kandi_auth_expires`, `kandi_auth_customer`. Renaming them would sign out
/// every shopper who updates the app, and they would experience that as the
/// app losing their account rather than as a release note.
class KandiAuth {
  KandiAuth._();

  static const String tokenKey = 'kandi_auth_token';
  static const String expiresKey = 'kandi_auth_expires';
  static const String customerKey = 'kandi_auth_customer';

  /// Whether somebody is signed in, for any screen that needs to know.
  static final ValueNotifier<bool> signedIn = ValueNotifier<bool>(false);

  static Map<String, dynamic>? _customer;
  static bool _loaded = false;

  static Map<String, dynamic>? get customer => _customer;

  static String get displayName {
    final first = (_customer?['first_name'] ?? '').toString().trim();
    if (first.isNotEmpty) return first;
    final email = (_customer?['email'] ?? '').toString().trim();
    // The local part of the address, which is a person's name often enough to
    // be worth using and never wrong enough to be embarrassing.
    if (email.contains('@')) return email.split('@').first;
    return 'there';
  }

  static Future<void> load() async {
    if (_loaded) return;
    _loaded = true;

    try {
      final prefs = await SharedPreferences.getInstance();

      // An expired token is signed out, decided locally without asking the
      // server. A screen that draws an account and then throws it away when
      // the first request comes back 401 is worse than one that never drew it.
      final expires = prefs.getInt(expiresKey) ?? 0;
      if (expires > 0 && DateTime.now().millisecondsSinceEpoch > expires) {
        await signOut();
        return;
      }

      final token = prefs.getString(tokenKey) ?? '';
      final raw = prefs.getString(customerKey);
      if (raw != null && raw.isNotEmpty) {
        final decoded = jsonDecode(raw);
        if (decoded is Map) _customer = Map<String, dynamic>.from(decoded);
      }
      signedIn.value = token.isNotEmpty;
    } catch (_) {
      signedIn.value = false;
    }
  }

  static Future<void> save({
    required String token,
    required int expiresIn,
    Map<String, dynamic>? customer,
  }) async {
    _customer = customer;
    _loaded = true;

    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(tokenKey, token);
      await prefs.setInt(
        expiresKey,
        DateTime.now().millisecondsSinceEpoch + expiresIn * 1000,
      );
      if (customer != null) {
        await prefs.setString(customerKey, jsonEncode(customer));
      }
    } catch (_) {}

    signedIn.value = true;
    // Everything cached under the old identity is now somebody else's. Orders
    // are the obvious one; leaving them would show the previous account's
    // history to whoever just signed in on this handset.
    KandiCache.invalidate();
  }

  static Future<void> signOut() async {
    _customer = null;
    _loaded = true;
    signedIn.value = false;

    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.remove(tokenKey);
      await prefs.remove(expiresKey);
      await prefs.remove(customerKey);
    } catch (_) {}

    await KandiSession.clear();
    KandiCache.invalidate();
  }
}

class KandiAuthScreen extends StatefulWidget {
  const KandiAuthScreen({
    super.key,
    this.width,
    this.height,
    this.mode = KandiAuthMode.signIn,
    this.onSignedIn,
  });

  final double? width;
  final double? height;
  final KandiAuthMode mode;
  final VoidCallback? onSignedIn;

  @override
  State<KandiAuthScreen> createState() => _KandiAuthScreenState();
}

class _KandiAuthScreenState extends State<KandiAuthScreen> {
  late KandiAuthMode _mode = widget.mode;

  final _email = TextEditingController();
  final _password = TextEditingController();
  final _firstName = TextEditingController();
  final _phone = TextEditingController();

  bool _busy = false;
  bool _obscure = true;
  String? _error;
  String? _sent;

  @override
  void dispose() {
    for (final c in [_email, _password, _firstName, _phone]) {
      c.dispose();
    }
    super.dispose();
  }

  String get _title => switch (_mode) {
        KandiAuthMode.signIn => 'Welcome back',
        KandiAuthMode.join => 'Create your account',
        KandiAuthMode.forgot => 'Reset your password',
      };

  String get _blurb => switch (_mode) {
        KandiAuthMode.signIn => 'Sign in to track orders and check out faster.',
        KandiAuthMode.join => 'It takes a minute, and checkout gets quicker.',
        KandiAuthMode.forgot =>
          'We will email you a link to set a new password.',
      };

  Future<void> _submit() async {
    final email = _email.text.trim();
    final password = _password.text;

    if (!email.contains('@') || !email.contains('.')) {
      setState(() => _error = 'Enter a valid email address.');
      return;
    }
    if (_mode != KandiAuthMode.forgot && password.length < 6) {
      setState(() => _error = 'Your password needs at least 6 characters.');
      return;
    }
    if (_mode == KandiAuthMode.join && _firstName.text.trim().length < 2) {
      setState(() => _error = 'Tell us your first name.');
      return;
    }

    FocusScope.of(context).unfocus();
    setState(() {
      _busy = true;
      _error = null;
      _sent = null;
    });

    final path = switch (_mode) {
      KandiAuthMode.signIn => '/api/app/auth/login',
      KandiAuthMode.join => '/api/app/auth/register',
      KandiAuthMode.forgot => '/api/app/auth/forgot',
    };

    final result = await KandiApi.post(path, body: {
      'email': email,
      if (_mode != KandiAuthMode.forgot) 'password': password,
      if (_mode == KandiAuthMode.join) ...{
        'first_name': _firstName.text.trim(),
        if (_phone.text.trim().isNotEmpty) 'phone': _phone.text.trim(),
      },
    });

    if (!mounted) return;

    if (result.status == 0) {
      setState(() {
        _busy = false;
        _error = 'Could not reach Kandi. Check your connection.';
      });
      return;
    }

    // Reset never confirms whether the address exists. Saying "no account with
    // that email" turns the form into a way to test whether somebody shops
    // here, which is an account-enumeration hole — so it answers the same way
    // either way.
    if (_mode == KandiAuthMode.forgot) {
      setState(() {
        _busy = false;
        _sent = 'If that address has an account, a reset link is on its way.';
      });
      return;
    }

    final data = result.data;
    if (result.status != 200 && result.status != 201) {
      setState(() {
        _busy = false;
        _error = KandiApi.message(
          data,
          _mode == KandiAuthMode.signIn
              ? 'That email and password did not match.'
              : 'We could not create your account.',
        );
      });
      return;
    }

    if (data is! Map || data['token'] is! String) {
      // A 200 with no token is a server that answered the wrong shape. Saying
      // so plainly beats a spinner that never stops.
      setState(() {
        _busy = false;
        _error = 'Something went wrong signing you in. Please try again.';
      });
      return;
    }

    await KandiAuth.save(
      token: data['token'] as String,
      expiresIn: data['expires_in'] is num
          ? (data['expires_in'] as num).toInt()
          : 60 * 60 * 24 * 14,
      customer: data['customer'] is Map
          ? Map<String, dynamic>.from(data['customer'] as Map)
          : null,
    );

    if (!mounted) return;
    setState(() => _busy = false);
    widget.onSignedIn?.call();
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      width: widget.width,
      height: widget.height,
      color: KandiColors.page,
      child: Scaffold(
        backgroundColor: KandiColors.page,
        appBar: kandiAppBar(context, ''),
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
              child: const Icon(Icons.shopping_bag_rounded,
                  size: 26, color: KandiColors.primary),
            ),
            const SizedBox(height: KandiSpace.lg),
            Text(_title, style: KandiType.display()),
            const SizedBox(height: KandiSpace.sm),
            Text(_blurb, style: KandiType.bodyText()),
            const SizedBox(height: KandiSpace.xl),

            KandiCard(
              child: Column(
                children: [
                  if (_mode == KandiAuthMode.join) ...[
                    _field(_firstName, 'First name',
                        capitalise: true, icon: Icons.person_outline_rounded),
                    const SizedBox(height: KandiSpace.md),
                  ],
                  _field(
                    _email,
                    'Email address',
                    keyboard: TextInputType.emailAddress,
                    icon: Icons.mail_outline_rounded,
                  ),
                  if (_mode != KandiAuthMode.forgot) ...[
                    const SizedBox(height: KandiSpace.md),
                    _field(
                      _password,
                      'Password',
                      obscure: _obscure,
                      icon: Icons.lock_outline_rounded,
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
                  if (_mode == KandiAuthMode.join) ...[
                    const SizedBox(height: KandiSpace.md),
                    _field(
                      _phone,
                      'Phone (optional)',
                      keyboard: TextInputType.phone,
                      icon: Icons.phone_outlined,
                    ),
                  ],
                ],
              ),
            ),

            if (_error != null) ...[
              const SizedBox(height: KandiSpace.md),
              _banner(_error!, KandiColors.sale, KandiColors.saleSoft,
                  Icons.error_outline_rounded),
            ],
            if (_sent != null) ...[
              const SizedBox(height: KandiSpace.md),
              _banner(_sent!, KandiColors.success, KandiColors.successSoft,
                  Icons.mark_email_read_outlined),
            ],

            const SizedBox(height: KandiSpace.lg),
            KandiButton(
              label: switch (_mode) {
                KandiAuthMode.signIn => 'Sign in',
                KandiAuthMode.join => 'Create account',
                KandiAuthMode.forgot => 'Send reset link',
              },
              busy: _busy,
              onPressed: _busy ? null : _submit,
            ),

            const SizedBox(height: KandiSpace.lg),
            _switcher(),
          ],
        ),
      ),
    );
  }

  /// Moving between the three modes, keeping what has been typed.
  ///
  /// Nothing is cleared on the way. Somebody told "that email and password did
  /// not match" who taps "Create one" has already typed their email, and
  /// making them do it again is the app punishing them for its own message.
  Widget _switcher() {
    final rows = <(String, String, KandiAuthMode)>[
      if (_mode != KandiAuthMode.signIn)
        ('Already have an account?', 'Sign in', KandiAuthMode.signIn),
      if (_mode != KandiAuthMode.join)
        ('New to Kandi?', 'Create one', KandiAuthMode.join),
      if (_mode == KandiAuthMode.signIn)
        ('Forgotten your password?', 'Reset it', KandiAuthMode.forgot),
    ];

    return Column(
      children: [
        for (final row in rows)
          Padding(
            padding: const EdgeInsets.only(bottom: KandiSpace.sm),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Text(row.$1, style: KandiType.label(color: KandiColors.body)),
                const SizedBox(width: KandiSpace.xs),
                GestureDetector(
                  onTap: () => setState(() {
                    _mode = row.$3;
                    _error = null;
                    _sent = null;
                  }),
                  child: Text(
                    row.$2,
                    style: KandiType.label(color: KandiColors.primaryInk)
                        .copyWith(fontWeight: FontWeight.w700),
                  ),
                ),
              ],
            ),
          ),
      ],
    );
  }

  Widget _banner(String message, Color colour, Color tint, IconData icon) {
    return Container(
      padding: const EdgeInsets.all(KandiSpace.md),
      decoration: BoxDecoration(color: tint, borderRadius: KandiRadius.md),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 18, color: colour),
          const SizedBox(width: KandiSpace.sm),
          Expanded(
            child: Text(message, style: KandiType.label(color: colour)),
          ),
        ],
      ),
    );
  }

  Widget _field(
    TextEditingController controller,
    String label, {
    bool obscure = false,
    bool capitalise = false,
    TextInputType? keyboard,
    IconData? icon,
    Widget? trailing,
  }) {
    return TextField(
      controller: controller,
      obscureText: obscure,
      keyboardType: keyboard,
      textCapitalization:
          capitalise ? TextCapitalization.words : TextCapitalization.none,
      style: KandiType.bodyText(color: KandiColors.ink),
      onSubmitted: (_) => _submit(),
      decoration: InputDecoration(
        labelText: label,
        labelStyle: KandiType.label(color: KandiColors.muted),
        prefixIcon:
            icon == null ? null : Icon(icon, size: 19, color: KandiColors.muted),
        suffixIcon: trailing,
        filled: true,
        fillColor: KandiColors.hairline,
        contentPadding: const EdgeInsets.symmetric(
          horizontal: KandiSpace.md,
          vertical: KandiSpace.md,
        ),
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
