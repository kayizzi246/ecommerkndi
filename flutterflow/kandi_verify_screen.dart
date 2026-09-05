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
import 'dart:async';
import 'dart:convert';

import 'package:flutter/services.dart';

import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

// Forward only. The gate replaces itself with the checkout, so it never
// imports the basket it came from.
import '/custom_code/widgets/kandi_checkout_screen.dart';

// ============================================================
//  KANDI — VERIFY PAGE
//
//  The step between the basket and the checkout, and the only
//  screen in the app a shopper is meant to see exactly once.
//
//  ---- What it is for ----
//
//  The checkout cannot take money for an order nobody can be
//  reached about. `/api/checkout` refuses a request with no
//  session, and the number on the order is what a rider rings
//  from the gate — so somewhere between a full basket and a
//  paid order, this shop has to have proved a phone number.
//
//  It used to prove it INSIDE the checkout, from `_placeOrder`:
//  the shopper filled in a name, a town and an address, chose
//  mobile money, pressed the button that says how much they are
//  about to pay — and got a sheet asking them to go and read an
//  SMS. That is the single worst moment in the flow to
//  interrupt someone, and it is the moment the old code picked,
//  because it was the last point at which the check could still
//  be skipped for a shopper who did not need it.
//
//  Moving it here costs an extra screen for a first-time
//  shopper and removes a surprise for every shopper. The basket
//  is where a person has decided to buy and has not yet
//  committed to a form, which is the cheapest place in the flow
//  to ask for something.
//
//  ---- It is shown once per device, not once per order ----
//
//  The basket checks two keys before it opens anything:
//
//      kandi-auth-v1        the bearer token
//      kandi-verified-phone the number this device proved
//
//  Both present means the shopper is registered and their
//  number is known, and the basket pushes the checkout
//  directly — this file is never built. Neither the basket nor
//  this page asks the server: the token is opaque to the app,
//  so a round trip could only tell it what the two keys already
//  say, and it would cost a spinner on the one button in the
//  app that must never hesitate.
//
//  A token the shop has STOPPED accepting is a different case,
//  and it is handled where it shows up: `/api/checkout` answers
//  401, the checkout clears both keys, and the next trip
//  through the basket lands here again. That is the whole of
//  the "asks again" behaviour, and it is driven by the server
//  rejecting a session rather than by anything this page
//  decides.
//
//  ---- Why the gate takes a PHONE and the account page takes
//  either ----
//
//  The account page will sign a shopper in with an email
//  address, and that is right for what it is for: reading order
//  history needs an account and nothing else. This page is not
//  a sign-in, it is the last thing between a basket and a
//  courier, and an email address is not something a rider can
//  ring from outside a gate.
//
//  So a shopper who signed in by email still comes through here
//  once, and the copy says so rather than pretending it is a
//  fresh registration. The code they get back lands on the SAME
//  WordPress customer either way — `/customers/otp-session`
//  matches an existing account on `billing_phone` and updates
//  it, so nobody ends up with two.
//
//  ---- Self-contained, like every page here ----
//
//  Its own palette, its own HTTP, its own copy of the phone
//  normaliser. The reasoning is at the head of
//  kandi_home_screen.dart: FlutterFlow keeps custom widgets in
//  one flat folder and a shared helper is the import that
//  reintroduces the paste-order problem.
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
  static const Color saveSoft = Color(0xFFE8F5EC);
  static const Color warn = Color(0xFFB45309);
  static const Color warnSoft = Color(0xFFFDF3E6);

  /// ---- The money colour ----
  ///
  /// #D62200 rather than a brighter red: white on it is 5.1:1, so the same
  /// value works as a ground under white button text AND as text on white.
  static const Color flame = Color(0xFFD62200);

  /// The 1px ring that makes a white panel visible on a white page.
  static const Color edge = Color(0xFFDEDEDE);
}

class _KSpace {
  const _KSpace._();
  static const double sm = 8;
  static const double md = 12;
  static const double lg = 16;
  static const double xl = 24;
}

/// ---- Panel corners: 16, where this was 12 ----
///
/// This governs the CHROME only - sheets, the shelf grounds, the terms
/// strip, the panels on the account, checkout and seller pages. It does not
/// reach the product tile, which has square corners and a drawn ring copied
/// row by row off the website's `.tile-card` and must stay that way: the
/// site squares its tiles so they can touch in a flush grid, and a tile
/// rounded here and square there is the most obvious way the two clients
/// stop looking like one shop.
///
/// So the app now draws two corner radii on purpose - a square catalogue on
/// softened furniture - and that is the distinction rather than an
/// inconsistency. 12 sat between the two and read as neither.
const double _rPanel = 16;
const double _rChip = 8;

/// Fully rounded. The primary calls to action are pills, which is what tells
/// them apart from the square panels they sit on.
const double _rPill = 999;

/// ---- The brand gradient ----
///
/// It carries the chrome — app bars, the home band, the primary buttons — so
/// that every screen is recognisably one shop.
///
/// Three stops on a diagonal, where this was two across the horizontal. Both
/// changes are the same change: a two-stop horizontal ramp between two colours
/// half a hue apart is a flat wash with a slight lean, and on a 56px app bar
/// it reads as one muddy orange. Running it corner to corner gives the ramp
/// the bar's diagonal to travel rather than its width, and the middle stop is
/// what stops the two ends averaging into the middle.
///
/// The dark end went DOWN, from #D62200 to #A81100, and that is a legibility
/// change rather than a taste one. Every app bar in this app sets white type
/// on this gradient; white on #FF6A00 is 2.9:1, which is why the palette note
/// says orange is never a large ground under white text. It is one here
/// whatever the note says, so the fix is to make most of the ground darker:
/// white on #A81100 is 8.1:1, and the bright end is now a corner rather than
/// half the bar.
const LinearGradient _brandGradient = LinearGradient(
  begin: Alignment.topLeft,
  end: Alignment.bottomRight,
  colors: [Color(0xFFFF6A00), Color(0xFFE03400), Color(0xFFA81100)],
  stops: [0.0, 0.52, 1.0],
);

/// The brand gradient with a light bloom over it.
///
/// ---- Why the bloom is a separate layer ----
///
/// A `LinearGradient` can only ramp along a line, and what makes a coloured
/// surface look lit rather than filled is a highlight that falls off in a
/// circle. Painting a soft white radial over the top-left corner at 18% is the
/// whole of it: the bar stops being a coloured rectangle and starts having a
/// light source, which is the single cheapest thing that separates a designed
/// surface from a filled one.
///
/// It is white rather than a lighter orange on purpose. A lighter orange
/// changes the hue and puts the bar back in the 2.9:1 band the gradient above
/// just climbed out of; white at 18% lifts the value without moving the hue,
/// and the corner it lifts is the corner that was already the brightest.
class _BrandSurface extends StatelessWidget {
  const _BrandSurface({required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Stack(
      children: [
        const Positioned.fill(
          child: DecoratedBox(
            decoration: BoxDecoration(gradient: _brandGradient),
          ),
        ),
        const Positioned.fill(
          child: DecoratedBox(
            decoration: BoxDecoration(
              gradient: RadialGradient(
                center: Alignment(-0.75, -1.1),
                radius: 1.5,
                colors: [Color(0x2EFFFFFF), Color(0x00FFFFFF)],
              ),
            ),
          ),
        ),
        child,
      ],
    );
  }
}

const String _apiBase = 'https://kandiug.com';

// The keys every page in this app agrees on.
const String _authKey = 'kandi-auth-v1';
const String _authNameKey = 'kandi-auth-name';

/// The phone number this device has proved, in +2567XXXXXXXX form.
const String _verifiedPhoneKey = 'kandi-verified-phone';

/// What the checkout refills its form from. This page writes the number into
/// it so the checkout's phone field arrives already filled and already proved.
const String _checkoutKey = 'kandi-checkout-v1';

/// Takes the three shapes a Ugandan number is typed in and returns one.
///
/// A digit sweep rather than a regular expression: it has to accept
/// 0772 123 456, +256 772 123 456 and 256772123456, which is three patterns
/// and one loop. Copied verbatim from the checkout — if one changes, both do.
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

/// How long before a shopper may ask for a second code.
///
/// Every resend is an SMS the shop pays for, and the commonest reason a code
/// has not arrived after four seconds is that it is still in the network. A
/// countdown says "it is coming" in the one way a shopper believes.
const int _resendAfterSeconds = 30;

class KandiVerifyScreen extends StatefulWidget {
  const KandiVerifyScreen({super.key});

  @override
  State<KandiVerifyScreen> createState() => _KandiVerifyScreenState();
}

class _KandiVerifyScreenState extends State<KandiVerifyScreen> {
  final TextEditingController _phone = TextEditingController();
  final TextEditingController _code = TextEditingController();
  final FocusNode _codeFocus = FocusNode();

  /// The sealed code, as `/api/otp/start` handed it back. Non-empty means a
  /// message has been sent and the page is on its second step.
  String _challenge = '';

  /// What the server says it sent to, which is not always what was typed —
  /// it normalises too, and showing its answer rather than the input is how a
  /// shopper spots a wrong digit before spending a code on it.
  String _sentTo = '';

  bool _busy = false;
  String? _error;

  /// Seconds left before "Send it again" becomes live.
  int _resendIn = 0;
  Timer? _ticker;

  /// Set once the token is stored, so the screen can draw its done state for
  /// the moment between success and the checkout appearing.
  bool _done = false;

  @override
  void initState() {
    super.initState();
    _prefill();
  }

  @override
  void dispose() {
    _ticker?.cancel();
    _phone.dispose();
    _code.dispose();
    _codeFocus.dispose();
    super.dispose();
  }

  /// Fills the field with anything the device already knows.
  ///
  /// Three sources, best first: a number already proved (which should mean the
  /// basket never sent us here, but a stale push or a FlutterFlow action can),
  /// then the checkout's saved details, then nothing.
  ///
  /// A proved number does NOT skip the page on its own. The basket is where
  /// that decision belongs, and duplicating it here would mean two places
  /// deciding who has to verify — which is exactly how one of them ends up
  /// wrong. What it does is fill the field and say so.
  Future<void> _prefill() async {
    String? known;
    try {
      final prefs = await SharedPreferences.getInstance();
      known = prefs.getString(_verifiedPhoneKey);
      if (known == null || known.isEmpty) {
        final raw = prefs.getString(_checkoutKey);
        if (raw != null && raw.isNotEmpty) {
          final saved = jsonDecode(raw);
          if (saved is Map && saved['phone'] != null) {
            known = saved['phone'].toString();
          }
        }
      }
    } catch (_) {
      // A blank field costs a shopper eleven digits. Not worth an error.
    }

    if (!mounted || known == null || known.isEmpty) return;
    setState(() => _phone.text = known!);
  }

  void _startResendCountdown() {
    _ticker?.cancel();
    setState(() => _resendIn = _resendAfterSeconds);
    _ticker = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (!mounted) {
        timer.cancel();
        return;
      }
      setState(() => _resendIn -= 1);
      if (_resendIn <= 0) timer.cancel();
    });
  }

  /// Step one: ask the server to send six digits.
  ///
  /// The number is checked here as well as on the server, because a round trip
  /// to be told that 070 is not a phone number is three seconds a shopper
  /// spends watching a spinner for an answer the app already had.
  Future<void> _send({bool resend = false}) async {
    final destination = _normalisePhone(_phone.text);
    if (destination == null) {
      setState(() =>
          _error = 'Enter a Ugandan mobile number, like 0772 123 456.');
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
            body: jsonEncode({'channel': 'sms', 'to': destination}),
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
        // this page does not.
        _error = (data is Map && data['message'] != null)
            ? data['message'].toString()
            : 'Could not send the code. Check your connection and try again.';
      });
      return;
    }

    final challenge = (data['challenge'] ?? '').toString();

    setState(() {
      _busy = false;
      _challenge = challenge;
      _sentTo = (data['sentTo'] ?? destination).toString();
      // A page asking for a code nobody sent is worse than an error.
      if (challenge.isEmpty) {
        _error =
            'Verification is not available right now. Please try again shortly.';
      } else {
        // A resend invalidates whatever was typed against the old code.
        if (resend) _code.clear();
      }
    });

    if (challenge.isNotEmpty) {
      _startResendCountdown();
      _codeFocus.requestFocus();
    }
  }

  /// Step two: trade the code for a session, and go to the checkout.
  ///
  /// The code is never compared on the phone. It would be easy and it would be
  /// wrong: for the app to check it, the challenge would have to carry the code
  /// in a form the app can read, which is a form an attacker can read too.
  /// Everything about the check happens on the server; this only learns whether
  /// it passed.
  Future<void> _confirm() async {
    final typed = _code.text.trim();
    if (typed.length < 6) {
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
            body: jsonEncode({'challenge': _challenge, 'code': typed}),
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
    final proved = _normalisePhone(_phone.text) ?? _phone.text.trim();

    // ---- Written before we navigate, not after ----
    //
    // This is the write that makes the whole gate a one-time screen, so it
    // happens while the page is still on screen and can still say if it
    // failed. Handing over first and saving afterwards would mean a shopper
    // who backgrounds the app during the checkout comes back to a device that
    // never recorded the number it just proved.
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_authKey, token);
      await prefs.setString(_verifiedPhoneKey, proved);
      if (name.isNotEmpty) await prefs.setString(_authNameKey, name);

      // Seed the checkout's own saved details with the proved number, so its
      // phone field arrives filled and its own gate is satisfied on sight.
      // Merged rather than replaced — a shopper who has ordered before has a
      // town and an address in here worth keeping.
      final raw = prefs.getString(_checkoutKey);
      final Map<String, dynamic> details = <String, dynamic>{};
      if (raw != null && raw.isNotEmpty) {
        final saved = jsonDecode(raw);
        if (saved is Map) {
          saved.forEach((key, value) => details[key.toString()] = value);
        }
      }
      details['phone'] = proved;
      if (name.isNotEmpty && (details['name'] == null ||
          details['name'].toString().trim().isEmpty)) {
        details['name'] = name;
      }
      await prefs.setString(_checkoutKey, jsonEncode(details));
    } catch (_) {
      // The session still works for this run, and the checkout's own gate
      // will catch it next time. Not worth stopping an order the shopper has
      // just proved they are entitled to place.
    }

    if (!mounted) return;
    setState(() {
      _busy = false;
      _done = true;
    });

    // ---- pushReplacement, not push ----
    //
    // The gate is spent. Leaving it on the stack would put it between the
    // checkout and the basket, so Back from the checkout would land on a
    // verify page for a number already verified — which then has nothing to
    // do and no honest thing to say.
    await Navigator.of(context).pushReplacement(
      MaterialPageRoute(builder: (_) => const KandiCheckoutScreen()),
    );
  }

  @override
  Widget build(BuildContext context) {
    final sent = _challenge.isNotEmpty;

    return Scaffold(
      backgroundColor: _KColors.canvas,
      appBar: AppBar(
        elevation: 0,
        backgroundColor: Colors.transparent,
        // The gradient has to go in `flexibleSpace` — `backgroundColor` only
        // takes a flat colour — and it needs a `SizedBox.expand` child. A
        // childless DecoratedBox has no size, and AppBar lays flexibleSpace
        // out under loose constraints, so it paints nothing at all.
        flexibleSpace: const _BrandSurface(child: SizedBox.expand()),
        foregroundColor: Colors.white,
        title: const Text('Confirm your number',
            style: TextStyle(fontSize: 16.5, fontWeight: FontWeight.w800)),
      ),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(
              _KSpace.lg, _KSpace.lg, _KSpace.lg, _KSpace.xl),
          children: [
            // Three steps, and this is the middle one. A shopper pulled out of
            // a purchase by a screen they did not ask for needs to see that
            // the purchase is still happening; a progress strip is the
            // cheapest way to say it.
            const _Steps(),
            const SizedBox(height: _KSpace.xl),

            _Halo(
              icon: _done
                  ? Icons.check_rounded
                  : (sent ? Icons.sms_outlined : Icons.phone_iphone_rounded),
              tone: _done ? _KColors.save : _KColors.primary,
              soft: _done ? _KColors.saveSoft : _KColors.primarySoft,
            ),
            const SizedBox(height: _KSpace.lg),

            Text(
              _done
                  ? 'Number confirmed'
                  : (sent ? 'Enter your code' : 'One quick check'),
              textAlign: TextAlign.center,
              style: const TextStyle(
                  fontSize: 22,
                  height: 1.2,
                  letterSpacing: -0.4,
                  fontWeight: FontWeight.w800,
                  color: _KColors.ink),
            ),
            const SizedBox(height: _KSpace.sm),
            Text(
              _done
                  ? 'Taking you to the checkout.'
                  : (sent
                      ? 'We sent six digits to $_sentTo. It expires in 10 '
                          'minutes.'
                      : 'The rider calls this number to deliver your order, so '
                          'we check it once before you pay. You will not be '
                          'asked again on this phone.'),
              textAlign: TextAlign.center,
              style: const TextStyle(
                  fontSize: 13.5, height: 1.5, color: _KColors.body),
            ),
            const SizedBox(height: _KSpace.xl),

            if (!sent) ...[
              _Field(
                controller: _phone,
                label: 'Mobile number',
                hint: '0772 123 456',
                icon: Icons.phone_rounded,
                keyboardType: TextInputType.phone,
                enabled: !_busy,
                onChanged: (_) {
                  if (_error != null) setState(() => _error = null);
                },
                onSubmitted: (_) => _busy ? null : _send(),
              ),
            ] else ...[
              _Field(
                controller: _code,
                focusNode: _codeFocus,
                label: 'Six-digit code',
                hint: '- - - - - -',
                icon: Icons.lock_outline_rounded,
                keyboardType: TextInputType.number,
                enabled: !_busy && !_done,
                // The field is a code, not prose: digits only, six of them,
                // and tracked wide so a shopper can count them at a glance
                // against the message they are reading off.
                inputFormatters: [
                  FilteringTextInputFormatter.digitsOnly,
                  LengthLimitingTextInputFormatter(6),
                ],
                letterSpacing: 6,
                onChanged: (value) {
                  if (_error != null) setState(() => _error = null);
                  // Six digits is the whole of the input, so there is nothing
                  // left for a button press to add.
                  if (value.trim().length == 6 && !_busy) _confirm();
                },
                onSubmitted: (_) => _busy ? null : _confirm(),
              ),
            ],

            if (_error != null) ...[
              const SizedBox(height: _KSpace.md),
              _Notice(
                icon: Icons.error_outline_rounded,
                tone: _KColors.warn,
                soft: _KColors.warnSoft,
                text: _error!,
              ),
            ],

            const SizedBox(height: _KSpace.lg),
            _GradientButton(
              label: _done
                  ? 'Verified'
                  : (sent ? 'Confirm and continue' : 'Send my code'),
              busy: _busy,
              enabled: !_busy && !_done,
              onTap: sent ? _confirm : _send,
            ),

            if (sent && !_done) ...[
              const SizedBox(height: _KSpace.md),
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  _TextAction(
                    label: 'Change number',
                    onTap: _busy
                        ? null
                        : () => setState(() {
                              _challenge = '';
                              _code.clear();
                              _error = null;
                              _ticker?.cancel();
                              _resendIn = 0;
                            }),
                  ),
                  const Text(' · ',
                      style: TextStyle(fontSize: 13, color: _KColors.line)),
                  _TextAction(
                    label: _resendIn > 0
                        ? 'Send it again in ${_resendIn}s'
                        : 'Send it again',
                    onTap: (_busy || _resendIn > 0)
                        ? null
                        : () => _send(resend: true),
                  ),
                ],
              ),
            ],

            const SizedBox(height: _KSpace.xl),
            // The reassurance that answers the question the screen provokes.
            // A shopper stopped for a phone number mid-purchase wants to know
            // what it is for and what it is not for, and answering it here
            // costs one panel and saves a support message.
            const _Reassurance(),
          ],
        ),
      ),
    );
  }
}

// ------------------------------------------------------------
//  The furniture
// ------------------------------------------------------------

/// Basket → Confirm → Pay, with the middle one lit.
class _Steps extends StatelessWidget {
  const _Steps();

  @override
  Widget build(BuildContext context) {
    return Row(
      children: const [
        _Step(label: 'Basket', state: _StepState.done),
        _Bar(filled: true),
        _Step(label: 'Confirm', state: _StepState.current),
        _Bar(filled: false),
        _Step(label: 'Pay', state: _StepState.todo),
      ],
    );
  }
}

enum _StepState { done, current, todo }

class _Step extends StatelessWidget {
  const _Step({required this.label, required this.state});

  final String label;
  final _StepState state;

  @override
  Widget build(BuildContext context) {
    final done = state == _StepState.done;
    final current = state == _StepState.current;

    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 26,
          height: 26,
          decoration: BoxDecoration(
            gradient: current ? _brandGradient : null,
            color: done ? _KColors.saveSoft : (current ? null : _KColors.hairline),
            shape: BoxShape.circle,
            border: Border.all(
                color: done
                    ? _KColors.save
                    : (current ? Colors.transparent : _KColors.line)),
          ),
          child: Icon(
            done ? Icons.check_rounded : Icons.circle,
            size: done ? 15 : 7,
            color: done
                ? _KColors.save
                : (current ? Colors.white : _KColors.line),
          ),
        ),
        const SizedBox(height: 5),
        Text(label,
            style: TextStyle(
                fontSize: 11,
                height: 1.2,
                fontWeight: current ? FontWeight.w800 : FontWeight.w600,
                color: current ? _KColors.ink : _KColors.muted)),
      ],
    );
  }
}

/// The rule between two steps. Padded to the top so it meets the discs rather
/// than the labels underneath them.
class _Bar extends StatelessWidget {
  const _Bar({required this.filled});

  final bool filled;

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Padding(
        padding: const EdgeInsets.only(bottom: 22, left: 6, right: 6),
        child: Container(
          height: 2,
          decoration: BoxDecoration(
            color: filled ? _KColors.save : _KColors.line,
            borderRadius: BorderRadius.circular(_rPill),
          ),
        ),
      ),
    );
  }
}

/// A big soft ring around the screen's one icon.
class _Halo extends StatelessWidget {
  const _Halo({required this.icon, required this.tone, required this.soft});

  final IconData icon;
  final Color tone;
  final Color soft;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Container(
        width: 76,
        height: 76,
        decoration: BoxDecoration(color: soft, shape: BoxShape.circle),
        child: Center(
          child: Container(
            width: 52,
            height: 52,
            decoration: BoxDecoration(
              color: _KColors.panel,
              shape: BoxShape.circle,
              boxShadow: [
                BoxShadow(
                  color: tone.withValues(alpha: 0.22),
                  blurRadius: 16,
                  offset: const Offset(0, 6),
                ),
              ],
            ),
            child: Icon(icon, size: 26, color: tone),
          ),
        ),
      ),
    );
  }
}

/// A labelled text field. The checkout's, plus the four things a code field
/// needs that an address field does not.
class _Field extends StatelessWidget {
  const _Field({
    required this.controller,
    required this.label,
    required this.hint,
    required this.icon,
    required this.onChanged,
    this.onSubmitted,
    this.keyboardType,
    this.inputFormatters,
    this.focusNode,
    this.letterSpacing,
    this.enabled = true,
  });

  final TextEditingController controller;
  final String label;
  final String hint;
  final IconData icon;
  final ValueChanged<String> onChanged;
  final ValueChanged<String>? onSubmitted;
  final TextInputType? keyboardType;
  final List<TextInputFormatter>? inputFormatters;
  final FocusNode? focusNode;
  final double? letterSpacing;
  final bool enabled;

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
          focusNode: focusNode,
          enabled: enabled,
          autofocus: false,
          onChanged: onChanged,
          onSubmitted: onSubmitted,
          keyboardType: keyboardType,
          inputFormatters: inputFormatters,
          style: TextStyle(
              fontSize: letterSpacing == null ? 14.5 : 18,
              letterSpacing: letterSpacing,
              fontWeight:
                  letterSpacing == null ? FontWeight.w400 : FontWeight.w700,
              color: _KColors.ink),
          decoration: InputDecoration(
            isDense: true,
            filled: true,
            fillColor: _KColors.hairline,
            hintText: hint,
            hintStyle: TextStyle(
                fontSize: letterSpacing == null ? 14 : 17,
                letterSpacing: letterSpacing,
                color: _KColors.muted),
            prefixIcon: Icon(icon, size: 19, color: _KColors.muted),
            contentPadding: const EdgeInsets.symmetric(
                horizontal: _KSpace.md, vertical: _KSpace.md),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(_rChip),
              borderSide: BorderSide.none,
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(_rChip),
              borderSide: BorderSide.none,
            ),
            disabledBorder: OutlineInputBorder(
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

/// A tinted panel carrying one line of explanation or one error.
class _Notice extends StatelessWidget {
  const _Notice({
    required this.icon,
    required this.tone,
    required this.soft,
    required this.text,
  });

  final IconData icon;
  final Color tone;
  final Color soft;
  final String text;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(_KSpace.md),
      decoration: BoxDecoration(
        color: soft,
        borderRadius: BorderRadius.circular(_rChip),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 18, color: tone),
          const SizedBox(width: _KSpace.sm),
          Expanded(
            child: Text(text,
                style: TextStyle(fontSize: 12.5, height: 1.45, color: tone)),
          ),
        ],
      ),
    );
  }
}

/// What the number is used for, and what it is not.
class _Reassurance extends StatelessWidget {
  const _Reassurance();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(_KSpace.lg),
      decoration: BoxDecoration(
        color: _KColors.panel,
        borderRadius: BorderRadius.circular(_rPanel),
        border: Border.all(color: _KColors.edge),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: const [
          _Point(
            icon: Icons.local_shipping_outlined,
            text: 'The rider rings this number when they reach you.',
          ),
          SizedBox(height: _KSpace.md),
          _Point(
            icon: Icons.receipt_long_outlined,
            text: 'It becomes your account, so your orders are all in one '
                'place. There is no password to remember.',
          ),
          SizedBox(height: _KSpace.md),
          _Point(
            icon: Icons.done_all_rounded,
            text: 'Once only. Next time you check out this step is skipped.',
          ),
        ],
      ),
    );
  }
}

class _Point extends StatelessWidget {
  const _Point({required this.icon, required this.text});

  final IconData icon;
  final String text;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(icon, size: 17, color: _KColors.primary),
        const SizedBox(width: _KSpace.md),
        Expanded(
          child: Text(text,
              style: const TextStyle(
                  fontSize: 12.5, height: 1.5, color: _KColors.body)),
        ),
      ],
    );
  }
}

/// A quiet inline link. Null `onTap` greys it, which is the whole of the
/// disabled state — a countdown that still looks pressable is a countdown a
/// shopper taps at repeatedly.
class _TextAction extends StatelessWidget {
  const _TextAction({required this.label, required this.onTap});

  final String label;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 6, horizontal: 2),
        child: Text(label,
            style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w700,
                color: onTap == null ? _KColors.muted : _KColors.flame)),
      ),
    );
  }
}

/// The primary call to action: a gradient pill, full width.
///
/// Duplicated from the basket and the checkout rather than shared, for the
/// reason at the head of this file.
class _GradientButton extends StatelessWidget {
  const _GradientButton({
    required this.label,
    required this.enabled,
    required this.busy,
    required this.onTap,
  });

  final String label;
  final bool enabled;
  final bool busy;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      height: 52,
      decoration: BoxDecoration(
        gradient: enabled ? _brandGradient : null,
        color: enabled ? null : _KColors.line,
        borderRadius: BorderRadius.circular(_rPill),
        // ---- A coloured shadow, not a grey one ----
        //
        // A wash of the button's own dark end at 20%, rather than black at
        // 20%. Black under a saturated colour greys the pixels it falls on
        // and reads as dirt; the same hue reads as the colour bleeding onto
        // the paper, which is what a lit object actually does. Only drawn
        // when the button is live - a disabled control that floats is a
        // disabled control that gets tapped.
        boxShadow: enabled
            ? const [
                BoxShadow(
                  color: Color(0x33A81100),
                  blurRadius: 18,
                  offset: Offset(0, 8),
                ),
              ]
            : null,
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: enabled ? onTap : null,
          borderRadius: BorderRadius.circular(_rPill),
          child: Center(
            child: busy
                ? const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(
                        strokeWidth: 2.2, color: Colors.white),
                  )
                : Text(
                    label,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                        fontSize: 15.5,
                        fontWeight: FontWeight.w800,
                        color: enabled ? Colors.white : _KColors.muted),
                  ),
          ),
        ),
      ),
    );
  }
}
