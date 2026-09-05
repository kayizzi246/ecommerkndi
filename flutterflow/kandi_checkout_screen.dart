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

import 'package:cached_network_image/cached_network_image.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:webview_flutter/webview_flutter.dart';

// ============================================================
//  KANDI — CHECKOUT PAGE
//
//  Where the order is placed. Self-contained like every page
//  here; the architecture is at the head of
//  kandi_home_screen.dart.
//
//  ---- Payment happens here now, not in a browser ----
//
//  This screen used to collect the delivery details and then
//  hand the shopper to kandiug.com to pay. The argument for
//  that was real: the website is where Pesapal is wired and
//  where the order is written, and a second implementation of
//  the one thing in this business that must never be subtly
//  wrong would drift from the first.
//
//  What it cost was the order. Being thrown into a browser at
//  the moment of payment is where app checkouts are abandoned:
//  the shopper leaves the app, lands on a page that does not
//  look like the app, and has to be trusted enough to come
//  back. Measured against every marketplace this shop competes
//  with, none of them do it.
//
//  The drift is avoided a different way instead: NOTHING about
//  the payment is reimplemented here. The order is placed by
//  POSTing to the same /api/checkout the website posts to, the
//  payment is opened by the same /api/payments/pesapal/start,
//  and Pesapal's own page — the real one, on Pesapal's domain —
//  is what the shopper types into. This screen contributes a
//  WebView and a poll, and nothing that handles money.
//
//  ---- The gate in front of it ----
//
//  A shopper cannot reach the payment button without a verified
//  phone number. The code is sent over SMS by /api/otp/start and
//  proved to /api/app/auth/otp, which hands back the session
//  token that /api/checkout then requires. So the verification
//  is not a decoration this screen draws: the server will not
//  accept the order without it.
//
//  A verified number is also the number the rider calls, which
//  is why the checkout requires a PHONE specifically. The
//  account page will take an email instead — see that file.
//
//  ---- Details are saved, not just sent ----
//
//  A shopper who abandons at payment and comes back should not
//  retype their name and their village. The four fields persist
//  under `kandi-checkout-v1` and refill on the next visit.
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
  static const Color save = Color(0xFF15803D);
  /// The tint behind a success mark. Light enough that the green sits on it
  /// at full contrast, which a 10% wash of the same green would not be.
  static const Color saveSoft = Color(0xFFE8F5EC);
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
const double _rPhoto = 8;

/// The `Accept` header every photograph in this app is fetched with. See the
/// note in kandi_search_screen.dart — Dart's HTTP client sends none of its own,
/// so without this the storefront's optimiser has to guess and sends JPEG.
const Map<String, String> _kImageHeaders = <String, String>{
  'Accept': 'image/webp,image/*;q=0.8',
};
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

// The keys every page in this app agrees on.
const String _basketKey = 'kandi-cart-v1';
const String _checkoutKey = 'kandi-checkout-v1';

/// The session the app signs in with. Shared with the account and orders
/// pages, which is the point: verifying at checkout signs a shopper in, and
/// signing in on the account page means checkout asks for nothing.
const String _authKey = 'kandi-auth-v1';
const String _authNameKey = 'kandi-auth-name';

/// The phone number this device has proved, in +2567XXXXXXXX form.
///
/// Kept beside the token rather than derived from it because the token is
/// opaque to the app — it is WordPress's, and the app cannot read a number out
/// of it. This is what lets the screen say WHICH number is verified without
/// asking the server on every build.
const String _verifiedPhoneKey = 'kandi-verified-phone';

String _money(num amount) {
  final whole = amount.round().toString();
  final out = StringBuffer();
  for (int i = 0; i < whole.length; i++) {
    if (i > 0 && (whole.length - i) % 3 == 0) out.write(',');
    out.write(whole[i]);
  }
  return 'UGX $out';
}

/// A Ugandan mobile number in the one shape the shop stores, or null.
///
/// +2567XXXXXXXX, which is what lib/phone.ts on the storefront normalises to
/// and what WordPress matches `billing_phone` against. Getting this wrong does
/// not fail loudly — it fails as a second account for the same shopper — so the
/// app normalises before it sends rather than hoping the server will.
///
/// Written as a digit sweep rather than a regular expression on purpose: it has
/// to accept 0772 123 456, +256 772 123 456 and 256772123456, which is three
/// patterns and one loop.
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

/// Loose on purpose. The only test of an address that means anything is whether
/// a message sent to it arrives, and that is exactly what the next step does.
bool _looksLikeEmail(String raw) {
  final at = raw.indexOf('@');
  if (at < 1) return false;
  final dot = raw.indexOf('.', at + 2);
  return dot > at + 1 && dot < raw.length - 1;
}

class _KLine {
  const _KLine({
    required this.productId,
    required this.name,
    required this.price,
    required this.quantity,
    this.image = '',
    this.variantLabel,
  });

  final int productId;
  final String name;
  final num price;
  final int quantity;

  /// The photograph, as the basket stored it.
  ///
  /// Every page that writes a line writes an image with it, so this costs no
  /// request. It was being thrown away here, and a checkout summary set purely
  /// in text is the one screen in the app where a shopper cannot see what they
  /// are about to pay for — which is exactly the moment they want to check.
  final String image;
  final String? variantLabel;

  num get lineTotal => price * quantity;

  static _KLine? from(dynamic json) {
    if (json is! Map) return null;
    final id = json['productId'];
    final quantity = json['quantity'];
    if (id is! int || quantity is! int || quantity < 1) return null;
    return _KLine(
      productId: id,
      name: (json['name'] ?? '').toString(),
      price: json['price'] is num ? json['price'] as num : 0,
      quantity: quantity,
      image: (json['image'] ?? '').toString(),
      variantLabel: json['variantLabel']?.toString(),
    );
  }
}

class KandiCheckoutScreen extends StatefulWidget {
  const KandiCheckoutScreen({super.key, this.width, this.height});

  final double? width;
  final double? height;

  @override
  State<KandiCheckoutScreen> createState() => _KandiCheckoutScreenState();
}

class _KandiCheckoutScreenState extends State<KandiCheckoutScreen> {
  final TextEditingController _name = TextEditingController();
  final TextEditingController _phone = TextEditingController();
  final TextEditingController _town = TextEditingController();
  final TextEditingController _address = TextEditingController();

  List<_KLine> _lines = const [];
  bool _loading = true;
  bool _sending = false;
  num _freeDeliveryFrom = 0;
  int _returnsDays = 0;

  /// The app session, and the number it was proved with.
  ///
  /// Both or neither. A token with no number is a shopper who signed in with an
  /// email on the account page, and that is NOT enough to check out — the rider
  /// calls a phone. The screen asks such a shopper for a number, which signs
  /// them in again against the same account.
  String? _token;
  String? _verifiedPhone;

  /// What the shopper is paying with. Both go to Pesapal; the difference is
  /// which tab Pesapal opens on, and saying it here rather than making the
  /// shopper find it in a web page is most of what the in-app flow buys.
  String _method = 'mobile';


  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _name.dispose();
    _phone.dispose();
    _town.dispose();
    _address.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    final lines = <_KLine>[];
    try {
      final prefs = await SharedPreferences.getInstance();

      final raw = prefs.getString(_basketKey);
      if (raw != null) {
        final decoded = jsonDecode(raw);
        if (decoded is List) {
          for (final entry in decoded) {
            final line = _KLine.from(entry);
            if (line != null) lines.add(line);
          }
        }
      }

      // Refill the details from last time, so an abandoned checkout does not
      // cost the shopper their name and their village a second time.
      final saved = prefs.getString(_checkoutKey);
      if (saved != null) {
        final decoded = jsonDecode(saved);
        if (decoded is Map) {
          _name.text = (decoded['name'] ?? '').toString();
          _phone.text = (decoded['phone'] ?? '').toString();
          _town.text = (decoded['town'] ?? '').toString();
          _address.text = (decoded['address'] ?? '').toString();
        }
      }
    } catch (_) {
      // Both are recoverable: an unreadable basket shows the empty state, and
      // unreadable details just mean typing them again.
    }

    String? token;
    String? verified;
    try {
      final prefs = await SharedPreferences.getInstance();
      token = prefs.getString(_authKey);
      verified = prefs.getString(_verifiedPhoneKey);
    } catch (_) {
      // Signed out is the safe reading of an unreadable store: the worst it
      // costs is one verification the shopper has already done.
    }

    if (!mounted) return;
    setState(() {
      _lines = lines;
      _token = (token != null && token.isNotEmpty) ? token : null;
      _verifiedPhone = (verified != null && verified.isNotEmpty) ? verified : null;
      // A proved number is the one the rider should call, so it wins over
      // whatever was typed here last time.
      if (_verifiedPhone != null) _phone.text = _verifiedPhone!;
      _loading = false;
    });

    _loadTerms();
  }

  /// The delivery threshold and returns window, for the summary.
  ///
  /// Read from the home feed rather than hard-coded, so this screen cannot
  /// promise a threshold the checkout does not apply.
  Future<void> _loadTerms() async {
    try {
      final response = await http
          .get(Uri.parse('$_apiBase/api/app/home'))
          .timeout(const Duration(seconds: 12));
      if (response.statusCode != 200) return;
      final data = jsonDecode(response.body);
      if (data is! Map) return;
      final commerce = data['commerce'];
      if (commerce is! Map) return;
      if (!mounted) return;
      setState(() {
        _freeDeliveryFrom = commerce['freeDeliveryFrom'] is num
            ? commerce['freeDeliveryFrom'] as num
            : 0;
        _returnsDays =
            commerce['returnsDays'] is int ? commerce['returnsDays'] as int : 0;
      });
    } catch (_) {
      // The summary simply omits the line. Not worth an error a shopper at
      // checkout cannot act on.
    }
  }

  num get _subtotal =>
      _lines.fold<num>(0, (total, line) => total + line.lineTotal);

  int get _count => _lines.fold<int>(0, (total, line) => total + line.quantity);

  /// Which required fields are still empty.
  ///
  /// Named rather than just disabling the button: a greyed button with no
  /// explanation is the most common way a shopper abandons a checkout.
  List<String> get _missing => [
        if (_name.text.trim().isEmpty) 'your name',
        if (_phone.text.trim().length < 9) 'a phone number',
        if (_town.text.trim().isEmpty) 'your town',
      ];

  /// Whether what is currently typed in the phone field is the number this
  /// device has actually proved.
  ///
  /// Compared after normalising, so 0772123456 and +256772123456 are the same
  /// number — which they are, and a shopper who retypes their own number in a
  /// different shape should not be sent a second code for it.
  bool _verifiedFor(String typed) {
    if (_token == null || _verifiedPhone == null) return false;
    return _normalisePhone(typed) == _verifiedPhone;
  }

  /// The one thing the app still hands to the browser.
  ///
  /// Cash on delivery is priced from a point on a map — see `codZoneFor` on the
  /// storefront — and this screen has a town and a landmark. Rather than guess
  /// a zone, it sends the shopper to the page that can ask properly, carrying
  /// the basket and the details so nothing is retyped. Everything else about
  /// payment now happens in the app; this is the exception, and it is here
  /// because the app is missing an ADDRESS PICKER, not a payment flow.
  Future<void> _openCashCheckout() async {
    await _persistDetails();

    final basket =
        _lines.map((line) => '${line.productId}:${line.quantity}').join(',');

    final uri = Uri.parse('$_apiBase/checkout').replace(queryParameters: {
      'app': '1',
      'pay': 'cod',
      'items': basket,
      'name': _name.text.trim(),
      'phone': _phone.text.trim(),
      'town': _town.text.trim(),
      if (_address.text.trim().isNotEmpty) 'address': _address.text.trim(),
    });

    bool opened = false;
    try {
      opened = await launchUrl(uri, mode: LaunchMode.externalApplication);
    } catch (_) {
      opened = false;
    }

    if (!opened) {
      _say('Could not open the browser. Try mobile money or a card instead.');
    }
  }

  Future<void> _persistDetails() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(
        _checkoutKey,
        jsonEncode({
          'name': _name.text.trim(),
          'phone': _phone.text.trim(),
          'town': _town.text.trim(),
          'address': _address.text.trim(),
        }),
      );
    } catch (_) {
      // Costs only the refill next time.
    }
  }

  /// Sends the shopper a code and, if they read it back, signs them in.
  ///
  /// Returns true when the screen ends up with a proved phone number. The sheet
  /// itself is `_KOtpSheet` at the foot of this file; everything that touches
  /// the network lives in there, and this only records what came back.
  ///
  /// ---- Why the checkout insists on a PHONE ----
  ///
  /// The account page will verify either channel. This one will not: the number
  /// on an order is what a rider rings from the gate, and an order carrying an
  /// email and a number nobody has checked is an order that gets to the street
  /// and then fails. Signing in by email and then checking out asks once for a
  /// number, which lands on the same account either way — WordPress matches on
  /// `billing_phone` and updates it. See `/customers/otp-session`.
  Future<bool> _verifyPhone() async {
    final result = await showModalBottomSheet<_KVerified>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      // Not dismissible by a stray tap on the scrim. A shopper who has already
      // been sent an SMS and loses the sheet to a mis-tap has to burn a second
      // code, and the shop pays for both.
      isDismissible: false,
      builder: (_) => _KOtpSheet(
        channel: 'sms',
        initialContact: _phone.text.trim(),
        name: _name.text.trim(),
        reason:
            'The rider calls this number to deliver your order, so we check it '
            'before you pay.',
      ),
    );

    if (result == null || !mounted) return false;

    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_authKey, result.token);
      await prefs.setString(_verifiedPhoneKey, result.contact);
      if (result.name.isNotEmpty) {
        await prefs.setString(_authNameKey, result.name);
      }
    } catch (_) {
      // The session still works for this run. Not worth stopping an order the
      // shopper has just proved they are entitled to place.
    }

    if (!mounted) return false;
    setState(() {
      _token = result.token;
      _verifiedPhone = result.contact;
      _phone.text = result.contact;
    });
    return true;
  }

  /// Places the order and takes the payment, without leaving the app.
  ///
  /// Four steps, in this order, and the order matters:
  ///
  ///   1. Verify the phone, if it is not already. `/api/checkout` rejects an
  ///      order with no session, so doing this first turns what would be a 403
  ///      into a sheet the shopper can actually answer.
  ///   2. POST the basket to `/api/checkout`. WooCommerce writes the order and
  ///      hands back its id and a short-lived `payment_token`. Nothing has been
  ///      charged at this point — the order exists, awaiting payment.
  ///   3. POST to `/api/payments/pesapal/start` with that token, which opens a
  ///      Pesapal session and returns a URL.
  ///   4. Show that URL in a WebView and wait for it to land back on
  ///      `/payment/callback`, then ask the server what actually happened.
  ///
  /// ---- Prices are not sent, and that is deliberate ----
  ///
  /// Ids and quantities only. What each line costs is the server's to decide;
  /// a figure posted from a phone is one the shop would have to either trust or
  /// ignore, and there is no third option.
  ///
  /// ---- Step 4 asks the server rather than believing the WebView ----
  ///
  /// The callback URL carries a tracking id and nothing about whether the money
  /// moved. Reading "success" off a redirect is how an app ships a free-order
  /// bug: the URL is whatever the last page navigated to, and a shopper with a
  /// proxy can navigate anywhere. `/api/app/payment/status` settles it against
  /// Pesapal's own API, server side, and that answer is the only one this
  /// screen acts on.
  Future<void> _placeOrder() async {
    if (_missing.isNotEmpty || _sending) return;

    final phone = _normalisePhone(_phone.text);
    if (phone == null) {
      _say('That does not look like a Ugandan mobile number. Try 07XX XXX XXX.');
      return;
    }

    // Verified, and verified as THIS number. A shopper who proves 0772… and
    // then edits the field to 0700… has an unverified number on the order
    // again, which is the whole thing the gate is for.
    if (_token == null || _verifiedPhone != phone) {
      final proved = await _verifyPhone();
      if (!proved) return;
    }

    setState(() => _sending = true);
    await _persistDetails();

    final placed = await _createOrder();
    if (placed == null) return;

    await _payFor(placed.id, placed.paymentToken);
  }

  /// Step 2. Writes the order, awaiting payment.
  ///
  /// Returns null when anything went wrong, having already told the shopper
  /// what. `_sending` is cleared on every failing path here rather than by the
  /// caller, because a stuck spinner on a checkout reads as a placed order.
  Future<_KPlaced?> _createOrder({bool mayRetry = true}) async {
    final items = _lines
        .map((line) => {
              'productId': line.productId,
              'quantity': line.quantity,
            })
        .toList();

    dynamic data;
    int status = 0;
    try {
      final response = await http
          .post(
            Uri.parse('$_apiBase/api/checkout'),
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
              'Authorization': 'Bearer ${_token ?? ''}',
              // The same order, sent twice, is what a stalled mobile
              // connection and a double tap both look like to the server.
              // See lib/idempotency.ts — this key is what lets it tell a
              // retry from a second order.
              'Idempotency-Key': _idempotencyKey(),
            },
            body: jsonEncode({
              'customer': {
                'first_name': _name.text.trim(),
                'phone': _phone.text.trim(),
                'address_1': _address.text.trim().isEmpty
                    ? _town.text.trim()
                    : _address.text.trim(),
                'city': _town.text.trim(),
              },
              'items': items,
              'payment_method': _method,
              // The order is created BEFORE the money moves, so it has to be
              // marked as such. Without this the shop would see a paid order
              // for a payment that may yet be abandoned.
              'awaiting_payment': true,
            }),
          )
          .timeout(const Duration(seconds: 30));
      status = response.statusCode;
      data = jsonDecode(response.body);
    } catch (_) {
      status = 0;
    }

    if (!mounted) return null;

    /* ---- An expired session, caught rather than reported ----
     *
     * `verification_required` means the server did not accept the token — it
     * has lapsed, or WordPress no longer knows it. The shopper has done nothing
     * wrong and there is nothing in the message for them to act on, so showing
     * it would be a dead end at the exact moment they are trying to pay.
     *
     * Instead the stale token is dropped and the sheet is reopened. One retry,
     * not a loop: if the second attempt is refused too then something is wrong
     * that another code will not fix, and a checkout that keeps texting codes
     * to a shopper is worse than one that admits it is stuck. */
    if (status == 403 &&
        data is Map &&
        data['code'] == 'verification_required' &&
        mayRetry) {
      setState(() {
        _token = null;
        _verifiedPhone = null;
        _sending = false;
      });

      final proved = await _verifyPhone();
      if (!proved || !mounted) return null;

      setState(() => _sending = true);
      return _createOrder(mayRetry: false);
    }

    if (status != 200 || data is! Map) {
      setState(() => _sending = false);
      _say((data is Map && data['error'] != null)
          ? data['error'].toString()
          : 'Could not place the order. Check your connection and try again.');
      return null;
    }

    final id = data['id'];
    if (id is! int || id <= 0) {
      setState(() => _sending = false);
      _say('The shop did not return an order number. Nothing has been charged.');
      return null;
    }

    return _KPlaced(
        id: id, paymentToken: (data['payment_token'] ?? '').toString());
  }

  /// Steps 3 and 4. Opens Pesapal in a sheet and settles what came of it.
  Future<void> _payFor(int orderId, String paymentToken) async {
    dynamic data;
    int status = 0;
    try {
      final response = await http
          .post(
            Uri.parse('$_apiBase/api/payments/pesapal/start'),
            headers: const {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
            },
            body: jsonEncode({
              'purpose': {'kind': 'order', 'orderId': orderId},
              // The app has no cookie jar, so the token that authorises this
              // payment travels in the body. /api/payments/pesapal/start
              // accepts either; see `authorise` in that route.
              'token': paymentToken,
            }),
          )
          .timeout(const Duration(seconds: 30));
      status = response.statusCode;
      data = jsonDecode(response.body);
    } catch (_) {
      status = 0;
    }

    if (!mounted) return;

    final url = (data is Map) ? (data['redirect_url'] ?? '').toString() : '';
    if (status != 200 || url.isEmpty) {
      setState(() => _sending = false);
      _unpaidOrder(
        orderId,
        (data is Map && data['error'] != null)
            ? data['error'].toString()
            : 'Could not open the payment page.',
      );
      return;
    }

    final outcome = await showModalBottomSheet<_KPayOutcome>(
      context: context,
      isScrollControlled: true,
      isDismissible: false,
      enableDrag: false,
      backgroundColor: Colors.transparent,
      builder: (_) => _KPaymentSheet(url: url, amount: _money(_subtotal)),
    );

    if (!mounted) return;
    setState(() => _sending = false);

    if (outcome == null || outcome.cancelled) {
      _unpaidOrder(orderId, 'Payment was cancelled.');
      return;
    }

    if (!outcome.paid) {
      _unpaidOrder(orderId, outcome.message);
      return;
    }

    // Paid. The basket is emptied only now, and only on the server's word —
    // clearing it when the sheet opened would lose the basket of every shopper
    // whose payment failed.
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.remove(_basketKey);
    } catch (_) {}

    if (!mounted) return;
    setState(() => _lines = const []);
    await _showPaid(orderId);
  }

  /// What the screen says when an order exists but is not paid for.
  ///
  /// The order NUMBER is the important half. It is real, it is in WooCommerce,
  /// and the shop can find it — so a shopper whose payment failed has something
  /// to quote rather than an apology, and the basket is deliberately left alone
  /// so that trying again costs nothing.
  ///
  /// Retrying passes an empty payment token on purpose. The one minted with the
  /// order is a single short-lived grant and it has been spent; the route falls
  /// back to the cookie it will not find and answers with its own error, which
  /// is the honest outcome. A retry that silently reused a spent token would be
  /// a payment authorised by nothing.
  void _unpaidOrder(int orderId, String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('$message Order #$orderId is saved and not paid for.'),
        duration: const Duration(seconds: 6),
        behavior: SnackBarBehavior.floating,
        action: SnackBarAction(
          label: 'Try again',
          textColor: Colors.white,
          onPressed: () {
            setState(() => _sending = true);
            _payFor(orderId, '');
          },
        ),
      ),
    );
  }

  /// The one screen in this app that says money has changed hands.
  ///
  /// A dialog rather than a snackbar, and not dismissible by tapping outside: a
  /// shopper who has just paid should have to acknowledge the order number,
  /// because it is the only thing they can quote if anything goes wrong later.
  Future<void> _showPaid(int orderId) async {
    await showDialog<void>(
      context: context,
      barrierDismissible: false,
      builder: (dialogContext) => AlertDialog(
        backgroundColor: _KColors.panel,
        shape:
            RoundedRectangleBorder(borderRadius: BorderRadius.circular(_rPanel)),
        title: Row(
          children: [
            Container(
              width: 34,
              height: 34,
              decoration: const BoxDecoration(
                  color: _KColors.saveSoft, shape: BoxShape.circle),
              child:
                  const Icon(Icons.check_rounded, size: 20, color: _KColors.save),
            ),
            const SizedBox(width: _KSpace.sm),
            const Expanded(
              child: Text('Payment received',
                  style: TextStyle(
                      fontSize: 17,
                      fontWeight: FontWeight.w800,
                      color: _KColors.ink)),
            ),
          ],
        ),
        content: Text(
          'Order #$orderId is paid and on its way. We will call the number you '
          'verified before it is delivered.',
          style:
              const TextStyle(fontSize: 13.5, height: 1.5, color: _KColors.body),
        ),
        actions: [
          FilledButton(
            onPressed: () => Navigator.of(dialogContext).pop(),
            style: FilledButton.styleFrom(
              backgroundColor: _KColors.flame,
              shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(_rPill)),
            ),
            child: const Text('Done',
                style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700)),
          ),
        ],
      ),
    );

    if (!mounted) return;
    // Back to wherever the shopper came from. The basket is empty behind this,
    // so leaving them on a checkout for an order they have paid for would be
    // the one screen guaranteed to confuse.
    Navigator.of(context).maybePop();
  }

  void _say(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        behavior: SnackBarBehavior.floating,
      ),
    );
  }

  /// A key unique to this basket and this minute.
  ///
  /// It has to be stable across a retry of the SAME order and different for a
  /// new one, which is exactly what the server needs to tell a stalled
  /// connection from a shopper who genuinely wants two. The basket contents
  /// supply the first half and the clock, coarsened to the minute, the second.
  ///
  /// Capped at 120 characters because a fifty-line basket would otherwise send
  /// a header longer than some proxies will forward.
  String _idempotencyKey() {
    final basket =
        _lines.map((line) => '${line.productId}x${line.quantity}').join('-');
    final minute = DateTime.now().millisecondsSinceEpoch ~/ 60000;
    final key = 'app-$minute-$basket';
    return key.length > 120 ? key.substring(0, 120) : key;
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
          title: const Text('Checkout',
              style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w700,
                  color: Colors.white)),
        ),
        body: _buildBody(),
        bottomNavigationBar: _lines.isEmpty ? null : _buildBar(),
      ),
    );
  }

  Widget _buildBody() {
    if (_loading) {
      return const Center(
          child: CircularProgressIndicator(color: _KColors.primary));
    }

    if (_lines.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(_KSpace.xl),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.shopping_bag_outlined,
                  size: 44, color: _KColors.muted),
              const SizedBox(height: _KSpace.md),
              const Text('Your basket is empty',
                  style: TextStyle(
                      fontSize: 17,
                      fontWeight: FontWeight.w800,
                      color: _KColors.ink)),
              const SizedBox(height: _KSpace.sm),
              const Text('Add something before checking out.',
                  style: TextStyle(fontSize: 13.5, color: _KColors.body)),
              const SizedBox(height: _KSpace.lg),
              FilledButton(
                onPressed: () => Navigator.of(context).maybePop(),
                style: FilledButton.styleFrom(backgroundColor: _KColors.flame),
                child: const Text('Back to basket'),
              ),
            ],
          ),
        ),
      );
    }

    return ListView(
      padding: const EdgeInsets.all(_KSpace.md),
      children: [
        _panel(
          title: 'Delivery details',
          child: Column(
            children: [
              _Field(
                controller: _name,
                label: 'Full name',
                hint: 'The name on the delivery',
                icon: Icons.person_outline_rounded,
                onChanged: (_) => setState(() {}),
              ),
              const SizedBox(height: _KSpace.md),
              _Field(
                controller: _phone,
                label: 'Phone number',
                hint: '07XX XXX XXX',
                icon: Icons.phone_outlined,
                keyboardType: TextInputType.phone,
                onChanged: (_) => setState(() {}),
              ),
              const SizedBox(height: _KSpace.md),
              _Field(
                controller: _town,
                label: 'Town or city',
                hint: 'Kampala, Jinja, Mbarara…',
                icon: Icons.location_city_rounded,
                onChanged: (_) => setState(() {}),
              ),
              const SizedBox(height: _KSpace.md),
              _Field(
                controller: _address,
                label: 'Address or landmark (optional)',
                hint: 'What the courier should look for',
                icon: Icons.place_outlined,
                onChanged: (_) => setState(() {}),
              ),
            ],
          ),
        ),
        const SizedBox(height: _KSpace.md),
        _panel(
          title: 'How you are paying',
          child: Column(
            children: [
              // Both of these end at the same Pesapal session; the difference
              // is which tab it opens on and, more to the point, that the
              // choice is made HERE. A shopper who picks "MTN or Airtel"
              // before they tap knows what is about to be asked of them, which
              // is the whole reason a payment page is not a surprise.
              _MethodTile(
                icon: Icons.smartphone_rounded,
                title: 'Mobile money',
                subtitle: 'MTN MoMo or Airtel Money. Approve on your phone.',
                selected: _method == 'mobile',
                onTap: () => setState(() => _method = 'mobile'),
              ),
              const SizedBox(height: _KSpace.sm),
              _MethodTile(
                icon: Icons.credit_card_rounded,
                title: 'Card',
                subtitle: 'Visa or Mastercard, entered on Pesapal.',
                selected: _method == 'card',
                onTap: () => setState(() => _method = 'card'),
              ),
              const SizedBox(height: _KSpace.md),
              // Said plainly rather than left for a shopper to discover at the
              // door. Cash on delivery needs a map point to decide whether the
              // address is in a zone the riders collect from, and this screen
              // collects a town and a landmark instead — so the app cannot
              // honestly offer it. Sending them to a page that can is better
              // than a greyed-out option with no explanation.
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Icon(Icons.info_outline_rounded,
                      size: 15, color: _KColors.muted),
                  const SizedBox(width: 6),
                  Expanded(
                    child: GestureDetector(
                      onTap: () => _openCashCheckout(),
                      child: const Text(
                        'Paying cash on delivery? Tap here — it needs your exact '
                        'drop-off point, which the website asks for on a map.',
                        style: TextStyle(
                            fontSize: 12, height: 1.4, color: _KColors.muted),
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
        const SizedBox(height: _KSpace.md),
        _panel(
          title: 'Your order',
          child: Column(
            children: [
              for (final line in _lines)
                Padding(
                  padding: const EdgeInsets.only(bottom: _KSpace.sm),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // The photograph, with the quantity riding its corner.
                      // A separate "2×" column was costing a line of width on
                      // every row to say something the badge says in the space
                      // the picture was already taking.
                      Stack(
                        children: [
                          ClipRRect(
                            borderRadius: BorderRadius.circular(_rPhoto),
                            child: Container(
                              width: 44,
                              height: 44,
                              color: _KColors.hairline,
                              child: line.image.isEmpty
                                  ? const Icon(
                                      Icons.image_not_supported_outlined,
                                      size: 16,
                                      color: _KColors.muted)
                                  : CachedNetworkImage(
                                      imageUrl: line.image,
                                      httpHeaders: _kImageHeaders,
                                      // Contain, never cover: a supplier
                                      // photograph cropped to 44px loses the
                                      // product and keeps its background.
                                      fit: BoxFit.contain,
                                      placeholder: (_, __) => const ColoredBox(
                                          color: _KColors.hairline),
                                      errorWidget: (_, __, ___) =>
                                          const ColoredBox(
                                              color: _KColors.hairline),
                                    ),
                            ),
                          ),
                          if (line.quantity > 1)
                            Positioned(
                              right: 0,
                              top: 0,
                              child: Container(
                                padding: const EdgeInsets.symmetric(
                                    horizontal: 5, vertical: 1),
                                decoration: BoxDecoration(
                                  color: _KColors.ink,
                                  borderRadius: BorderRadius.circular(_rPill),
                                ),
                                child: Text('${line.quantity}',
                                    style: const TextStyle(
                                        fontSize: 10,
                                        fontWeight: FontWeight.w800,
                                        color: Colors.white)),
                              ),
                            ),
                        ],
                      ),
                      const SizedBox(width: _KSpace.md),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(line.name,
                                maxLines: 2,
                                overflow: TextOverflow.ellipsis,
                                style: const TextStyle(
                                    fontSize: 13,
                                    height: 1.35,
                                    color: _KColors.ink)),
                            if (line.variantLabel != null &&
                                line.variantLabel!.isNotEmpty)
                              Text(line.variantLabel!,
                                  style: const TextStyle(
                                      fontSize: 11.5, color: _KColors.muted)),
                          ],
                        ),
                      ),
                      const SizedBox(width: _KSpace.sm),
                      Text(_money(line.lineTotal),
                          style: const TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w700,
                              color: _KColors.ink)),
                    ],
                  ),
                ),
              const Divider(color: _KColors.line, height: _KSpace.lg),
              Row(
                children: [
                  Text('Subtotal · $_count ${_count == 1 ? 'item' : 'items'}',
                      style: const TextStyle(
                          fontSize: 13.5, color: _KColors.muted)),
                  const Spacer(),
                  Text(_money(_subtotal),
                      style: const TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w800,
                          color: _KColors.ink)),
                ],
              ),
              const SizedBox(height: 4),
              Row(
                children: [
                  const Text('Delivery',
                      style: TextStyle(fontSize: 13.5, color: _KColors.muted)),
                  const Spacer(),
                  Text(
                    _freeDeliveryFrom > 0 && _subtotal >= _freeDeliveryFrom
                        ? 'Free'
                        : 'Calculated at payment',
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight:
                          _subtotal >= _freeDeliveryFrom && _freeDeliveryFrom > 0
                              ? FontWeight.w700
                              : FontWeight.w400,
                      color:
                          _subtotal >= _freeDeliveryFrom && _freeDeliveryFrom > 0
                              ? _KColors.save
                              : _KColors.muted,
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
        const SizedBox(height: _KSpace.md),
        // Said before the shopper taps, not after. Being asked for a code is
        // surprising if it is not announced, and a surprise at payment is
        // where orders are lost.
        //
        // Two states, because they are two different messages: one is "there
        // is a step coming", the other is "that step is done, here is the
        // number we hold". The second is worth its space — it is the number
        // the rider will call, and this is the shopper's chance to notice it
        // is the wrong one.
        Container(
          padding: const EdgeInsets.all(_KSpace.md),
          decoration: BoxDecoration(
            color: _verifiedFor(_phone.text)
                ? _KColors.saveSoft
                : _KColors.warnSoft,
            borderRadius: BorderRadius.circular(_rPanel),
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(
                  _verifiedFor(_phone.text)
                      ? Icons.verified_user_rounded
                      : Icons.sms_outlined,
                  size: 18,
                  color: _verifiedFor(_phone.text)
                      ? _KColors.save
                      : _KColors.warn),
              const SizedBox(width: _KSpace.sm),
              Expanded(
                child: Text(
                  _verifiedFor(_phone.text)
                      ? 'Verified. We will call ${_verifiedPhone ?? ''} about this delivery, '
                          'and your order history is now on this phone.'
                      : 'We text you a 6-digit code before payment, because the rider '
                          'calls this number to deliver your order. Payment itself '
                          'stays in the app.',
                  style: TextStyle(
                      fontSize: 12.5,
                      height: 1.45,
                      color: _verifiedFor(_phone.text)
                          ? _KColors.save
                          : _KColors.warn),
                ),
              ),
            ],
          ),
        ),
        if (_returnsDays > 0) ...[
          const SizedBox(height: _KSpace.md),
          Row(
            children: [
              const Icon(Icons.verified_outlined, size: 16, color: _KColors.save),
              const SizedBox(width: 6),
              Text('$_returnsDays-day returns on everything',
                  style: const TextStyle(fontSize: 12.5, color: _KColors.body)),
            ],
          ),
        ],
        const SizedBox(height: _KSpace.xl),
      ],
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
          // The same heading the shelves on Home carry: a short bar of the
          // brand gradient, then the title. It costs three pixels of width and
          // it is what makes a panel on this page read as part of the same shop
          // as the screen the shopper arrived from.
          Row(
            children: [
              Container(
                width: 3,
                height: 15,
                decoration: BoxDecoration(
                  gradient: _brandGradient,
                  borderRadius: BorderRadius.circular(_rPill),
                ),
              ),
              const SizedBox(width: _KSpace.sm),
              Text(title,
                  style: const TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w800,
                      color: _KColors.ink)),
            ],
          ),
          const SizedBox(height: _KSpace.md),
          child,
        ],
      ),
    );
  }

  Widget _buildBar() {
    final missing = _missing;
    return Container(
      padding: EdgeInsets.fromLTRB(
        _KSpace.lg,
        _KSpace.md,
        _KSpace.lg,
        // Clears the home indicator on a gesture-navigation phone.
        _KSpace.md + MediaQuery.of(context).padding.bottom,
      ),
      decoration: const BoxDecoration(
        color: _KColors.panel,
        border: Border(top: BorderSide(color: _KColors.line)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (missing.isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(bottom: _KSpace.sm),
              child: Text('Add ${missing.join(', ')} to continue',
                  style: const TextStyle(fontSize: 12, color: _KColors.muted)),
            ),
          _GradientButton(
            // Three labels for three different waits, because "Opening…" over
            // a thirty-second call to WooCommerce is the point at which a
            // shopper taps again. What the button says is the only thing
            // telling them the app has not hung.
            label: _sending
                ? 'Working…'
                : _verifiedFor(_phone.text)
                    ? 'Pay ${_money(_subtotal)}'
                    : 'Verify and pay · ${_money(_subtotal)}',
            enabled: missing.isEmpty && !_sending,
            onTap: _placeOrder,
          ),
        ],
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
    required this.onChanged,
    this.keyboardType,
  });

  final TextEditingController controller;
  final String label;
  final String hint;
  final IconData icon;
  final ValueChanged<String> onChanged;
  final TextInputType? keyboardType;

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
          onChanged: onChanged,
          keyboardType: keyboardType,
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

/// The primary call to action: a gradient pill, full width.
///
/// Duplicated from the basket rather than shared. Every page here carries its
/// own copy of everything it draws; a shared widget would be the one import
/// that reintroduces the paste-order problem the architecture exists to avoid.
class _GradientButton extends StatelessWidget {
  const _GradientButton({
    required this.label,
    required this.enabled,
    required this.onTap,
  });

  final String label;
  final bool enabled;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      height: 50,
      decoration: BoxDecoration(
        gradient: enabled ? _brandGradient : null,
        color: enabled ? null : _KColors.line,
        borderRadius: BorderRadius.circular(_rPill),
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: enabled ? onTap : null,
          borderRadius: BorderRadius.circular(_rPill),
          child: Center(
            child: Text(
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

// ------------------------------------------------------------
//  The small results these sheets hand back
// ------------------------------------------------------------

/// A proved contact and the session it bought.
class _KVerified {
  const _KVerified({
    required this.token,
    required this.contact,
    required this.name,
  });

  /// The bearer token, as `/api/app/auth/otp` returned it.
  final String token;

  /// The contact in the shape the server normalised it to — +2567XXXXXXXX for
  /// a phone, lower-cased for an email. Stored rather than what was typed, so
  /// that comparing it against a re-typed number actually works.
  final String contact;

  /// For the greeting on the account page. Empty is not an error.
  final String name;
}

/// An order that exists in WooCommerce and has not been paid for.
class _KPlaced {
  const _KPlaced({required this.id, required this.paymentToken});

  final int id;

  /// A short-lived grant authorising exactly one payment for exactly this
  /// order. Minted by `/api/checkout`; see `mintPaymentToken`.
  final String paymentToken;
}

/// What became of a trip through Pesapal.
///
/// `paid` is the server's word, never the WebView's — see `_KPaymentSheet`.
class _KPayOutcome {
  const _KPayOutcome({
    required this.paid,
    required this.cancelled,
    required this.message,
  });

  final bool paid;
  final bool cancelled;
  final String message;
}

// ------------------------------------------------------------
//  One payment method
// ------------------------------------------------------------

/// A radio row, drawn as a card rather than a Radio.
///
/// Material's own radio is 20px of tap target in a 48px row and the label is
/// not part of it, which on a phone means a shopper aiming at the word misses.
/// The whole card is the target here.
class _MethodTile extends StatelessWidget {
  const _MethodTile({
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
        padding: const EdgeInsets.all(_KSpace.md),
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
        child: Row(
          children: [
            Icon(icon,
                size: 22,
                color: selected ? _KColors.primary : _KColors.muted),
            const SizedBox(width: _KSpace.md),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title,
                      style: TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w700,
                          color: selected ? _KColors.ink : _KColors.body)),
                  const SizedBox(height: 2),
                  Text(subtitle,
                      style: const TextStyle(
                          fontSize: 12, height: 1.35, color: _KColors.muted)),
                ],
              ),
            ),
            Icon(
                selected
                    ? Icons.radio_button_checked_rounded
                    : Icons.radio_button_unchecked_rounded,
                size: 20,
                color: selected ? _KColors.primary : _KColors.line),
          ],
        ),
      ),
    );
  }
}

// ------------------------------------------------------------
//  The verification sheet
// ------------------------------------------------------------

/// Sends a one-time code and trades it for a session.
///
/// ---- Two requests, and what each one is for ----
///
/// `POST /api/otp/start` takes a channel and a contact and sends six digits by
/// SMS or by email. It answers with a `challenge`: the code, sealed and
/// encrypted, that the app cannot read and cannot forge.
///
/// `POST /api/app/auth/otp` takes that challenge back with the digits the
/// shopper typed. If they match, it finds or creates the WordPress customer for
/// that contact and returns a bearer token. That token is the account.
///
/// ---- The code is never checked here ----
///
/// Worth stating because it would be easy, and wrong, to compare the two on the
/// phone: the challenge would have to contain the code in a form the app could
/// read, which is a code an attacker can read too. Everything about the check
/// happens on the server, and this sheet only knows whether it passed.
class _KOtpSheet extends StatefulWidget {
  const _KOtpSheet({
    required this.channel,
    required this.initialContact,
    required this.name,
    required this.reason,
  });

  /// Always 'sms' here. The checkout proves a phone number and nothing else —
  /// see the note on `_verifyPhone`. The account page's copy of this sheet
  /// takes either channel and lets the shopper pick.
  final String channel;
  final String initialContact;

  /// Passed to the server so a brand-new account has something better than a
  /// generated username on it. Empty is fine.
  final String name;

  /// One sentence saying why this is being asked. A code request with no reason
  /// is indistinguishable from a phishing attempt, and shoppers are right to
  /// treat it as one.
  final String reason;

  @override
  State<_KOtpSheet> createState() => _KOtpSheetState();
}

class _KOtpSheetState extends State<_KOtpSheet> {
  final TextEditingController _contact = TextEditingController();
  final TextEditingController _code = TextEditingController();

  late String _channel;
  String _challenge = '';
  String _sentTo = '';
  bool _busy = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _channel = widget.channel;
    _contact.text = widget.initialContact;
  }

  @override
  void dispose() {
    _contact.dispose();
    _code.dispose();
    super.dispose();
  }

  /// Step one: ask the server to send a code.
  Future<void> _send() async {
    final typed = _contact.text.trim();

    // Checked here as well as on the server, because the round trip to find out
    // that 070 is not a phone number is three seconds a shopper spends watching
    // a spinner for an answer the app already had.
    final destination =
        _channel == 'sms' ? _normalisePhone(typed) : (typed.toLowerCase());

    if (_channel == 'sms' && destination == null) {
      setState(() => _error = 'Enter a Ugandan mobile number, like 0772 123 456.');
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
      // `alreadyVerified` means this browser proved this contact before. The
      // app has no such cookie, so it never comes back true here — but if the
      // route ever learns to say it for a device, an empty challenge is what
      // arrives, and a sheet asking for a code nobody sent is worse than an
      // error.
      if (_challenge.isEmpty) {
        _error = 'Verification is not available right now. Please try again shortly.';
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
              'name': widget.name,
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

    // The contact the server normalised, not the one that was typed. They
    // differ for every shopper who writes 0772 rather than +256772, and the
    // difference is what makes a stored number fail to match itself later.
    final proved = _channel == 'sms'
        ? (_normalisePhone(_contact.text) ?? _contact.text.trim())
        : _contact.text.trim().toLowerCase();

    Navigator.of(context).pop(_KVerified(
      token: token,
      contact: proved,
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
      padding: EdgeInsets.only(
          bottom: MediaQuery.of(context).viewInsets.bottom),
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
                  child: Text(sent ? 'Enter the code' : 'Verify your number',
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
                  : widget.reason,
              style: const TextStyle(
                  fontSize: 13, height: 1.45, color: _KColors.body),
            ),
            const SizedBox(height: _KSpace.lg),

            if (!sent) ...[
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
            _GradientButton(
              label: _busy
                  ? 'Please wait…'
                  : (sent ? 'Confirm' : 'Send me a code'),
              enabled: !_busy,
              onTap: sent ? _confirm : _send,
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
                            // usually mistyped the number, and sending a
                            // second one to the same wrong number is the shop
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
            SizedBox(height: MediaQuery.of(context).padding.bottom + _KSpace.sm),
          ],
        ),
      ),
    );
  }
}

// ------------------------------------------------------------
//  The payment sheet
// ------------------------------------------------------------

/// Pesapal's own page, in a sheet, with the app's chrome around it.
///
/// ---- What is in the WebView, and what is not ----
///
/// The page inside is Pesapal's, served from Pesapal's domain over TLS. This
/// app does not see the PIN or the card number, does not inject script into
/// that page, and does not read anything out of it. The only thing it watches
/// is WHERE the WebView navigates.
///
/// ---- The one navigation that matters ----
///
/// When Pesapal is finished it sends the browser back to
/// `kandiug.com/payment/callback?OrderTrackingId=…`. That URL is the signal
/// that the trip is over. It is NOT the answer to whether the money moved:
/// `_settle` below asks the server, which asks Pesapal's API with credentials
/// this app does not hold. Believing the URL instead would be a free-order bug
/// one proxy away.
///
/// ---- Closing early is safe ----
///
/// The close button stays live for the whole payment. If money has already left
/// the shopper's account, Pesapal's IPN settles the order server-side whatever
/// this sheet does — so abandoning costs nothing, and a sheet that traps a
/// shopper on a payment page they no longer want is how an app gets uninstalled.
class _KPaymentSheet extends StatefulWidget {
  const _KPaymentSheet({required this.url, required this.amount});

  final String url;

  /// Printed in the header. A payment page that does not say what is being
  /// charged asks for trust it has not earned.
  final String amount;

  @override
  State<_KPaymentSheet> createState() => _KPaymentSheetState();
}

class _KPaymentSheetState extends State<_KPaymentSheet> {
  late final WebViewController _controller;

  bool _loading = true;

  /// True from the moment the callback URL is seen. It stops a second
  /// navigation — Pesapal's callback page redirects once more on some flows —
  /// from starting a second settle and popping the sheet twice.
  bool _settling = false;

  @override
  void initState() {
    super.initState();

    _controller = WebViewController()
      // Pesapal's checkout is a JavaScript application; without this it renders
      // as a blank white box and nothing says why.
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setNavigationDelegate(
        NavigationDelegate(
          onPageStarted: (_) {
            if (mounted) setState(() => _loading = true);
          },
          onPageFinished: (_) {
            if (mounted) setState(() => _loading = false);
          },
          onNavigationRequest: (request) {
            final uri = Uri.tryParse(request.url);
            if (uri == null || !uri.path.contains('/payment/callback')) {
              return NavigationDecision.navigate;
            }

            if (_settling) return NavigationDecision.prevent;
            _settling = true;

            final cancelled = uri.queryParameters['cancelled'] != null;
            final tracking = uri.queryParameters['OrderTrackingId'] ?? '';
            final reference =
                uri.queryParameters['OrderMerchantReference'] ?? '';

            // Prevented rather than navigated: the callback page is a web page
            // meant for a browser, and letting it paint inside the sheet shows
            // the shopper a second, differently-styled result screen behind the
            // one this app is about to show.
            _finish(cancelled: cancelled, tracking: tracking, reference: reference);
            return NavigationDecision.prevent;
          },
        ),
      )
      ..loadRequest(Uri.parse(widget.url));
  }

  Future<void> _finish({
    required bool cancelled,
    required String tracking,
    required String reference,
  }) async {
    if (cancelled || tracking.isEmpty) {
      if (!mounted) return;
      Navigator.of(context).pop(const _KPayOutcome(
        paid: false,
        cancelled: true,
        message: 'Payment was cancelled.',
      ));
      return;
    }

    if (mounted) setState(() => _loading = true);

    dynamic data;
    int status = 0;
    try {
      final response = await http
          .post(
            Uri.parse('$_apiBase/api/app/payment/status'),
            headers: const {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
            },
            body: jsonEncode({
              'order_tracking_id': tracking,
              'merchant_reference': reference,
            }),
          )
          .timeout(const Duration(seconds: 30));
      status = response.statusCode;
      data = jsonDecode(response.body);
    } catch (_) {
      status = 0;
    }

    if (!mounted) return;

    final paid = status == 200 && data is Map && data['paid'] == true;

    Navigator.of(context).pop(_KPayOutcome(
      paid: paid,
      cancelled: false,
      message: (data is Map && data['description'] != null)
          ? data['description'].toString()
          // Said carefully. The app could not reach the server, which is not
          // the same as the payment failing — and telling a shopper their money
          // is gone when it may not be is the worst thing this sheet can say.
          : 'We could not confirm the payment. If money left your account, '
              'your order is safe.',
    ));
  }

  @override
  Widget build(BuildContext context) {
    return FractionallySizedBox(
      // Not full height. The strip of scrim above the sheet is what says this
      // is a step inside the app rather than a new screen, and it is where a
      // shopper's thumb goes to get out.
      heightFactor: 0.92,
      child: Container(
        decoration: const BoxDecoration(
          color: _KColors.panel,
          borderRadius:
              BorderRadius.vertical(top: Radius.circular(_rPanel + 6)),
        ),
        clipBehavior: Clip.antiAlias,
        child: Column(
          children: [
            Container(
              padding: const EdgeInsets.fromLTRB(
                  _KSpace.lg, _KSpace.md, _KSpace.sm, _KSpace.md),
              decoration: const BoxDecoration(
                border: Border(bottom: BorderSide(color: _KColors.line)),
              ),
              child: Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('Pay ${widget.amount}',
                            style: const TextStyle(
                                fontSize: 15,
                                fontWeight: FontWeight.w800,
                                color: _KColors.ink)),
                        const SizedBox(height: 1),
                        const Row(
                          children: [
                            Icon(Icons.lock_rounded,
                                size: 12, color: _KColors.save),
                            SizedBox(width: 4),
                            Text('Secured by Pesapal',
                                style: TextStyle(
                                    fontSize: 11.5, color: _KColors.muted)),
                          ],
                        ),
                      ],
                    ),
                  ),
                  IconButton(
                    // Live throughout, and safe throughout — see the note on
                    // this class.
                    onPressed: () => Navigator.of(context).pop(
                      const _KPayOutcome(
                        paid: false,
                        cancelled: true,
                        message: 'Payment was cancelled.',
                      ),
                    ),
                    icon: const Icon(Icons.close_rounded,
                        size: 22, color: _KColors.muted),
                  ),
                ],
              ),
            ),
            Expanded(
              child: Stack(
                children: [
                  WebViewWidget(controller: _controller),
                  if (_loading)
                    const ColoredBox(
                      color: _KColors.panel,
                      child: Center(
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            CircularProgressIndicator(color: _KColors.primary),
                            SizedBox(height: _KSpace.md),
                            Text('Opening payment…',
                                style: TextStyle(
                                    fontSize: 13, color: _KColors.muted)),
                          ],
                        ),
                      ),
                    ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
