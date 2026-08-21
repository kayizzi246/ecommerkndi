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

import 'dart:async';
import 'dart:convert';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:http/http.dart' as http;
import 'package:url_launcher/url_launcher.dart';

// ============================================================
// IMAGE DELIVERY
// ============================================================

/// The `Accept` header every photograph in this screen is fetched with.
///
/// ---- Why an app has to say this out loud ----
///
/// The API now hands back image URLs pointing at the storefront's image
/// optimiser (`/_next/image?...`) rather than at the raw WordPress upload, and
/// that endpoint picks its output format from the REQUEST: a client that says
/// it takes WebP gets WebP, and a client that says nothing gets the original
/// format back, resized.
///
/// Dart's HTTP client — which is what `cached_network_image` uses — sends no
/// `Accept` header at all. So without this line the app would collect the
/// resizing and the CDN delivery and silently leave the format conversion on
/// the table, which on this catalogue is about 45% of the bytes. Flutter
/// decodes WebP natively on both Android and iOS, so there is nothing to lose
/// by asking for it.
///
/// `image/*` after it is the fallback for any URL that is not going through
/// the optimiser — a seller avatar on another domain, say — where the server
/// should simply send whatever it has.
const Map<String, String> _kImageHeaders = <String, String>{
  'Accept': 'image/webp,image/*;q=0.8',
};


// ============================================================
//  KANDI — CHECKOUT  (v3)
//
//  Sibling of cart_widget.dart and delivery_address_widget.dart.
//  Same brand, same type, same API, same conventions.
//
//  WHAT CHANGED FROM v2, AND WHY IT HAD TO
//  -----------------------------------------------------------
//  v2 of this screen was a different shop. It is worth writing
//  down exactly what it did, because every line of it looked
//  reasonable and none of it reached this business:
//
//    • ORDERS WENT TO SUPABASE. `_db.from('orders').insert(...)`
//      wrote a row to a Postgres table. WooCommerce — which holds
//      the catalogue, the stock, the sellers, the commissions and
//      every order the website has ever taken — never heard about
//      it. Stock was never decremented, no seller was ever
//      credited, the order did not appear in wp-admin, and the
//      shopper could not see it under Orders on the site. The app
//      was quietly running a second, invisible shop.
//
//    • PAYMENTS WENT TO kandistyle.com. Both the mobile-money
//      call (`yo-payments/v1/process`) and the card call
//      (`kandi-pesapal/v1/init-payment`) pointed at another
//      domain entirely, with its own merchant account. Money
//      taken by the app did not land where money taken by the
//      website lands.
//
//    • THE APP NAMED ITS OWN PRICE. Every one of those calls sent
//      an `amount` it had calculated in Dart, from a cart it read
//      out of the device. Anything that can edit the device can
//      set the price of an order.
//
//    • THE CART WAS A DIFFERENT CART. `kandi_cart_<userId>`,
//      keyed on a Supabase login. The rest of this app — and the
//      website — keep the basket in `kandi-cart-v2`, per device,
//      no account required. A shopper filled one basket and
//      checked out of another.
//
//  v3 does none of that. It places the order through the same
//  endpoints the website's own checkout uses, in the same order,
//  with the same rules.
//
//  THE FLOW
//  -----------------------------------------------------------
//   1. Read the basket        ShoppingCartPage.loadLines()
//   2. Read the address       DeliveryAddressPage.savedRecord()
//   3. Price the delivery     POST /api/delivery/quote
//   4. Create the order       POST /api/checkout        → WooCommerce
//   5. Start the payment      POST /api/payments/pesapal/start
//   6. Open Pesapal           external browser
//   7. Confirm                POST /api/app/payment/status  (polled)
//   8. Empty the basket       ShoppingCartPage.clearCart()
//
//  THE RULE UNDERNEATH ALL OF IT
//  -----------------------------------------------------------
//  THIS APP NEVER STATES A PRICE.
//
//  Step 4 sends product IDs and quantities; the server prices the
//  line items from WooCommerce. Step 4 sends the delivery POINT;
//  the server re-runs `quoteDelivery` against the shop's own
//  rates. Step 5 sends nothing but the order number; WordPress
//  reads the total off the order it already holds.
//
//  So the totals drawn on this screen are a PREVIEW. They are
//  computed from the same sources and will agree — but if they
//  ever did not, the server's figure is the one charged, and the
//  shopper is never billed something they were not shown because
//  the amount was never ours to send.
//
//  PAYMENT: ONE PROVIDER, ONE MERCHANT
//  -----------------------------------------------------------
//  Card and mobile money both settle through Pesapal, exactly as
//  on the website. There is no separate mobile-money integration
//  and no second merchant account. Pesapal's own page presents
//  MTN, Airtel and cards; picking a method here only sets the
//  label the order carries in wp-admin before payment confirms.
//
//  That is why this screen no longer asks for a phone number to
//  charge: the payment happens on Pesapal's page, not here, and
//  a number typed here would have been collected for nothing.
//
//  WHY THE STATUS IS POLLED
//  -----------------------------------------------------------
//  The website sends the shopper back to /payment/callback, which
//  settles the payment while they watch. An app has no such
//  return trip — Pesapal opens in the phone's browser and the
//  shopper finishes somewhere this code cannot see. So it asks:
//  `POST /api/app/payment/status`, which calls the SAME settle
//  path the web callback and the IPN use. Safe to call twice, and
//  it cannot mark an order paid — the status is always fetched
//  from Pesapal.
//
//  If the shopper closes the app mid-payment, nothing is lost:
//  Pesapal's IPN settles the order server-side regardless, and
//  the order is already in WooCommerce.
//
//  SETUP  (FlutterFlow)
//  -----------------------------------------------------------
//  • Custom Widget name:  KandiCheckout   (must match the class)
//
//    ---- The class is `KandiCheckout`, not `CheckoutPage` ----
//
//    It was `CheckoutPage` and the build failed with
//
//      lib/checkout/checkout_widget.dart:85:31: Error: Method not
//      found: 'KandiCheckout'.
//              child: custom_widgets.KandiCheckout(
//
//    That file is GENERATED. FlutterFlow writes the page canvas
//    out as Dart, and where the canvas holds a custom widget it
//    emits a call to `custom_widgets.<the widget's name in the
//    FlutterFlow UI>`. The widget in this project is named
//    KandiCheckout, so that is the only symbol the generated
//    page will ever look for — pasting a file that declares
//    `CheckoutPage` into it compiles a class nobody calls and
//    leaves the call site pointing at nothing.
//
//    So the Dart class has to follow the FlutterFlow name, not
//    the other way round: the name in the UI is what the
//    generator reads, and it cannot be renamed from here. If the
//    widget is ever renamed in FlutterFlow, this class and
//    `_KandiCheckoutState` must be renamed with it in the same
//    sitting, or this exact error comes back.
//
//    Nothing else references it. The sibling widgets reach this
//    screen through `KandiCheckout.open(context)` inside this
//    file only, and the cart, address and search widgets keep
//    their own names, which already match their FlutterFlow
//    widgets.
//  • Dependencies (Settings ▸ Pubspec):
//        http: ^1.2.0
//        cached_network_image: ^3.3.1
//        google_fonts: ^6.1.0
//        url_launcher: ^6.2.5
//  • Parameters — all optional:
//        width, height       double?
//        onOrderComplete     Action
//        onBackTap           Action
//
//  SIGN-IN IS NOW REQUIRED — and this note used to say it was not
//  -----------------------------------------------------------
//  It read: "NOT USED HERE: Supabase, and no `userId` parameter.
//  A shopper does not need an account to buy, and requiring one
//  here would turn away the shopper who just wants the shoes."
//
//  Half of that is still true and half of it is now wrong, so
//  both halves are worth keeping straight.
//
//  STILL TRUE: this screen takes no `userId` parameter, and the
//  ORDER still does not carry one. The basket is per device, the
//  address record is per device, and `POST /api/checkout` gets
//  its name and phone from that record exactly as before. Signing
//  in is a gate in front of this screen, not a change to what it
//  sends. Nothing about the order shape moved.
//
//  NOW WRONG: the shopper is required to have a Supabase session
//  before the form is drawn at all. The reasoning for and against
//  is written out at `_authGate` below rather than here, because
//  it is a product decision that may well be revisited and it
//  should be argued where the code that implements it lives.
//
//  What that adds to this file: one import, one bool, one gate
//  view, and a dependency on `KandiAuthPage` — whose SETUP block
//  records what it must keep doing for the gate to work.
// ============================================================

const String _kApiBaseUrl = 'https://kandiug.com';

const Color _kOrange = Color(0xFFFF6A00);
const Color _kOrangeDark = Color(0xFFE85D00);
const Color _kInk = Color(0xFF111827);
const Color _kBody = Color(0xFF4B5563);
const Color _kMuted = Color(0xFF6B7280);
const Color _kFaint = Color(0xFF9CA3AF);
const Color _kLine = Color(0xFFE5E7EB);
const Color _kSurface = Color(0xFFF9FAFB);
const Color _kGreen = Color(0xFF16A34A);
const Color _kRed = Color(0xFFE53935);

TextStyle _type({
  double size = 14,
  FontWeight weight = FontWeight.w400,
  Color color = _kInk,
  double height = 1.4,
}) =>
    GoogleFonts.poppins(
      fontSize: size,
      fontWeight: weight,
      color: color,
      height: height,
    );

String _ugx(double amount) {
  final whole = amount.round().toString();
  final buffer = StringBuffer();
  for (var i = 0; i < whole.length; i++) {
    if (i > 0 && (whole.length - i) % 3 == 0) buffer.write(',');
    buffer.write(whole[i]);
  }
  return 'UGX $buffer';
}

/// How the shopper is paying. The order the shop understands.
enum _Method { cod, mobile, card }

/// Where the screen is in the payment.
enum _Stage { editing, placing, awaitingPayment, confirming, done, failed }

class KandiCheckout extends StatefulWidget {
  const KandiCheckout({
    super.key,
    this.width,
    this.height,
    this.onOrderComplete,
    this.onBackTap,
  });

  final double? width;
  final double? height;
  final Future Function()? onOrderComplete;
  final Future Function()? onBackTap;

  /// Opens the checkout.
  ///
  /// A static on the widget class because that is the only symbol FlutterFlow
  /// exports from this file — see the note at the head of `cart_widget.dart`.
  static Future<void> open(BuildContext context) {
    return Navigator.of(context).push(
      MaterialPageRoute<void>(builder: (_) => const KandiCheckout()),
    );
  }

  @override
  State<KandiCheckout> createState() => _KandiCheckoutState();
}

class _KandiCheckoutState extends State<KandiCheckout> {
  List<Map<String, dynamic>> _lines = <Map<String, dynamic>>[];
  Map<String, dynamic>? _address;

  double _subtotal = 0;
  int _itemCount = 0;

  double _deliveryFee = 0;
  bool _deliveryFree = false;
  bool _deliverable = true;
  String _deliveryLabel = '';
  bool _quoting = false;

  _Method _method = _Method.cod;
  bool _pesapalEnabled = true;

  _Stage _stage = _Stage.editing;
  String _message = '';
  bool _loading = true;

  /// Whether there is a Supabase session on this device.
  ///
  /// Starts true so the first frame is the loading spinner rather than the
  /// gate: `_load` sets it for real within a tick, and a gate that flashes up
  /// and vanishes for a signed-in shopper is worse than a spinner.
  bool _signedIn = true;

  int? _orderId;
  String? _trackingId;
  Timer? _poll;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _poll?.cancel();
    super.dispose();
  }

  double get _total => _subtotal + (_deliveryFree ? 0 : _deliveryFee);

  bool get _hasLocation =>
      _address != null && _address!['lat'] is num && _address!['lng'] is num;

  bool get _canPay =>
      _lines.isNotEmpty &&
      _hasLocation &&
      _deliverable &&
      !_quoting &&
      _stage == _Stage.editing;

  // ==========================================================
  // LOADING
  // ==========================================================

  Future<void> _load() async {
    // ---- Signed in, or nothing else happens ----
    //
    // Checked before the basket is even read. There is no point pricing an
    // order for somebody who is about to be sent away to sign in, and reading
    // storage first would flash a fully drawn checkout for a frame before the
    // gate replaced it.
    //
    // `ensureSignedIn`, not `isSignedIn`. The session lives on the device and
    // the synchronous check answers from memory alone — so on a COLD START,
    // which is exactly what this is, it says "signed out" for a shopper who
    // signed in last week and shows them a gate they have already passed. The
    // await reads the saved token first, and checks it against the shop once
    // per launch so a token the shop stopped honouring cannot walk somebody
    // all the way to the payment step.
    if (!await KandiAuthPage.ensureSignedIn()) {
      if (!mounted) return;
      setState(() {
        _signedIn = false;
        _loading = false;
      });
      return;
    }
    _signedIn = true;

    // The basket comes from `ShoppingCartPage`, not from a reader of our own.
    // One basket, one writer — see `loadLines` over there for why it hands back
    // maps rather than its own line type.
    final lines = await ShoppingCartPage.loadLines();
    final address = await DeliveryAddressPage.savedRecord();

    double subtotal = 0;
    int count = 0;
    for (final line in lines) {
      final price = (line['price'] is num) ? (line['price'] as num).toDouble() : 0.0;
      final qty = (line['quantity'] is num) ? (line['quantity'] as num).toInt() : 1;
      subtotal += price * qty;
      count += qty;
    }

    if (!mounted) return;
    setState(() {
      _lines = lines;
      _address = address;
      _subtotal = subtotal;
      _itemCount = count;
      _loading = false;
    });

    await _checkPesapal();
    if (_hasLocation) await _quote();
  }

  /// Whether the shop can take card and mobile money at all.
  ///
  /// Asked up front so a shopper is not allowed to pick a method, fill
  /// everything in, press pay and only then discover the shop has no Pesapal
  /// credentials. An unreachable check is treated as "available", matching the
  /// website: a shop whose backend is down has larger problems than a greyed
  /// out radio button, and hiding the option would push everyone to cash on
  /// delivery until somebody noticed.
  Future<void> _checkPesapal() async {
    try {
      final res = await http
          .get(Uri.parse('$_kApiBaseUrl/api/payments/pesapal/status'))
          .timeout(const Duration(seconds: 10));
      final data = jsonDecode(res.body);
      if (data is Map && data['enabled'] == false && mounted) {
        setState(() {
          _pesapalEnabled = false;
          _method = _Method.cod;
        });
      }
    } catch (_) {
      // Left enabled.
    }
  }

  /// Prices the delivery for the saved address against the current basket.
  ///
  /// Re-quoted here rather than reusing the figure the address screen showed:
  /// the basket has almost certainly changed since then, and the basket total
  /// is what decides whether the order clears the free-delivery threshold.
  Future<void> _quote() async {
    final address = _address;
    if (address == null || !_hasLocation) return;

    setState(() => _quoting = true);

    try {
      final res = await http
          .post(
            Uri.parse('$_kApiBaseUrl/api/delivery/quote'),
            headers: const {'Content-Type': 'application/json'},
            body: jsonEncode({
              'point': {'lat': address['lat'], 'lng': address['lng']},
              'subtotal': _subtotal,
            }),
          )
          .timeout(const Duration(seconds: 20));

      if (!mounted) return;
      final data = jsonDecode(res.body);

      if (res.statusCode == 200 && data is Map) {
        setState(() {
          _quoting = false;
          _deliveryFee =
              (data['fee'] is num) ? (data['fee'] as num).toDouble() : 0;
          _deliveryFree = data['free'] == true;
          _deliverable = data['deliverable'] != false;
          _deliveryLabel =
              (data['place'] ?? data['label'] ?? '').toString();
        });
      } else {
        setState(() {
          _quoting = false;
          _deliverable = false;
        });
      }
    } catch (_) {
      if (!mounted) return;
      // A failed quote must not block the order. The server prices delivery
      // again when the order is placed, from the same point — so the fee is
      // correct on the order even when this preview could not be drawn.
      setState(() => _quoting = false);
    }
  }

  Future<void> _editAddress() async {
    await DeliveryAddressPage.open(context, subtotal: _subtotal);
    final address = await DeliveryAddressPage.savedRecord();
    if (!mounted) return;
    setState(() => _address = address);
    if (_hasLocation) await _quote();
  }

  // ==========================================================
  // PLACING THE ORDER
  // ==========================================================

  Future<void> _pay() async {
    if (!_canPay) return;
    HapticFeedback.mediumImpact();

    final address = _address!;
    final viaPesapal = _method != _Method.cod;

    setState(() {
      _stage = _Stage.placing;
      _message = 'Placing your order…';
    });

    try {
      // ---- Step 1: the order, in WooCommerce ----
      //
      // Created first, whichever way it is being paid for. For a Pesapal order
      // it is created `pending` via `awaiting_payment`, which means two things
      // that both matter: Pesapal charges the total WooCommerce calculated
      // rather than a figure this app supplied, and an abandoned payment leaves
      // a visible unpaid order in wp-admin instead of nothing at all.
      final orderRes = await http
          .post(
            Uri.parse('$_kApiBaseUrl/api/checkout'),
            headers: const {'Content-Type': 'application/json'},
            body: jsonEncode({
              'customer': {
                'first_name': (address['first_name'] ?? '').toString(),
                'last_name': (address['last_name'] ?? '').toString(),
                'phone': (address['phone'] ?? '').toString(),
                'address_1': (address['address'] ?? '').toString(),
                'city': (address['city'] ?? '').toString(),
              },
              // IDs and quantities only. Prices are read from WooCommerce at
              // the other end, so what is in the device cannot set them.
              'items': _lines
                  .map((line) => {
                        'productId': line['productId'],
                        'quantity': line['quantity'],
                        'options': line['options'],
                      })
                  .toList(),
              'payment_method': _method == _Method.card
                  ? 'card'
                  : _method == _Method.mobile
                      ? 'mobile'
                      : 'cod',
              'awaiting_payment': viaPesapal,
              // The point, not the price: the server re-quotes from it, so a
              // tampered fee cannot reach the order.
              'delivery_point': {'lat': address['lat'], 'lng': address['lng']},
              'delivery_place':
                  (address['place'] ?? _deliveryLabel).toString(),
            }),
          )
          .timeout(const Duration(seconds: 60));

      final orderData = jsonDecode(orderRes.body);
      if (orderRes.statusCode != 200 || orderData is! Map) {
        // Written out rather than folded into one expression with `??`. The
        // compact version had a precedence bug worth remembering: in
        // `a is Map ? a['error'] : null ?? 'fallback'` the `??` binds to the
        // `null` branch alone, so a Map that simply had no `error` key fell
        // through to `.toString()` on null and showed the shopper the word
        // "null" where the reason should have been.
        final reason = orderData is Map ? orderData['error'] : null;
        throw _Failure(
          (reason == null || reason.toString().trim().isEmpty)
              ? 'The shop could not accept your order. Please try again.'
              : reason.toString(),
        );
      }

      _orderId = (orderData['id'] is num)
          ? (orderData['id'] as num).toInt()
          : int.tryParse('${orderData['id']}');

      if (!viaPesapal) {
        await _finish();
        return;
      }

      // ---- Step 2: the payment ----
      //
      // Only the order number goes over the wire. WordPress already holds the
      // order, so it reads the real total and the real buyer from WooCommerce
      // rather than trusting a client to state its own price.
      setState(() => _message = 'Opening the payment page…');

      final payRes = await http
          .post(
            Uri.parse('$_kApiBaseUrl/api/payments/pesapal/start'),
            headers: const {'Content-Type': 'application/json'},
            body: jsonEncode({
              'purpose': {'kind': 'order', 'orderId': _orderId},
            }),
          )
          .timeout(const Duration(seconds: 60));

      final payData = jsonDecode(payRes.body);
      final redirect = (payData is Map ? payData['redirect_url'] : null)?.toString();

      if (payRes.statusCode != 200 || redirect == null || redirect.isEmpty) {
        // The order is saved either way, so this is recoverable rather than
        // fatal — the shopper can try again or switch to cash on delivery, and
        // nothing they entered is lost.
        throw _Failure((payData is Map ? payData['error'] : null)?.toString() ??
            'The payment service did not respond. Your order is saved — try '
                'again, or choose cash on delivery.');
      }

      _trackingId = (payData['order_tracking_id'] ?? '').toString();

      // ---- Step 3: hand over to Pesapal ----
      //
      // `externalApplication` rather than an in-app webview, deliberately. Card
      // 3-D Secure and the mobile-money confirmation both redirect through the
      // bank's or the telco's own domain, and several of them refuse to render
      // inside an embedded view. The phone's browser is also where a shopper's
      // saved cards live.
      final uri = Uri.parse(redirect);
      var launched = false;
      try {
        launched = await launchUrl(uri, mode: LaunchMode.externalApplication);
      } catch (_) {
        launched = false;
      }
      if (!launched) {
        try {
          launched = await launchUrl(uri);
        } catch (_) {
          launched = false;
        }
      }
      if (!launched) {
        throw _Failure(
            'Could not open the payment page. Your order is saved — try again, '
            'or choose cash on delivery.');
      }

      if (!mounted) return;
      setState(() {
        _stage = _Stage.awaitingPayment;
        _message =
            'Finish paying in your browser, then come back here. We check '
            'automatically.';
      });
      _startPolling();
    } on _Failure catch (failure) {
      if (!mounted) return;
      HapticFeedback.heavyImpact();
      setState(() {
        _stage = _Stage.failed;
        _message = failure.message;
      });
    } catch (_) {
      if (!mounted) return;
      HapticFeedback.heavyImpact();
      setState(() {
        _stage = _Stage.failed;
        _message = 'Could not reach the shop. Check your connection and try again.';
      });
    }
  }

  /// Asks the shop whether the payment has landed, every few seconds.
  ///
  /// Bounded at roughly five minutes. Giving up is not the same as failing, and
  /// the wording says so: Pesapal's IPN settles the order on the server whether
  /// this app is watching or not, so a shopper who runs out of patience has
  /// still paid and still has an order.
  void _startPolling() {
    _poll?.cancel();
    var ticks = 0;
    _poll = Timer.periodic(const Duration(seconds: 5), (timer) async {
      if (!mounted || _stage == _Stage.done) {
        timer.cancel();
        return;
      }
      if (++ticks > 60) {
        timer.cancel();
        if (mounted) {
          setState(() => _message =
              'Still waiting for confirmation. If you have paid, your order is '
              'safe — we will confirm it shortly.');
        }
        return;
      }
      await _checkPayment(silent: true);
    });
  }

  Future<void> _checkPayment({bool silent = false}) async {
    final tracking = _trackingId;
    if (tracking == null || tracking.isEmpty) return;

    if (!silent && mounted) {
      setState(() {
        _stage = _Stage.confirming;
        _message = 'Checking your payment…';
      });
    }

    try {
      final res = await http
          .post(
            Uri.parse('$_kApiBaseUrl/api/app/payment/status'),
            headers: const {'Content-Type': 'application/json'},
            body: jsonEncode({'order_tracking_id': tracking}),
          )
          .timeout(const Duration(seconds: 30));

      final data = jsonDecode(res.body);
      if (data is! Map) return;

      if (data['paid'] == true) {
        _poll?.cancel();
        await _finish();
        return;
      }

      // `pending` means the check itself could not be completed — not that the
      // payment failed. Treating the two the same would tell a shopper whose
      // money has left their account that it had not.
      if (data['pending'] == true) {
        if (!silent && mounted) {
          setState(() {
            _stage = _Stage.awaitingPayment;
            _message = (data['description'] ?? 'Still waiting.').toString();
          });
        }
        return;
      }

      if (!silent && mounted) {
        setState(() {
          _stage = _Stage.awaitingPayment;
          _message = (data['description'] ?? 'Payment not completed yet.').toString();
        });
      }
    } catch (_) {
      if (!silent && mounted) {
        setState(() {
          _stage = _Stage.awaitingPayment;
          _message = 'Could not check just now. Try again in a moment.';
        });
      }
    }
  }

  /// The basket is emptied only here — after the shop has the order.
  ///
  /// Never before the order is created and never on a failed payment. An empty
  /// basket after a payment that did not go through is the worst outcome
  /// available: the shopper has no order and nothing to retry with.
  Future<void> _finish() async {
    _poll?.cancel();
    await ShoppingCartPage.clearCart();
    HapticFeedback.mediumImpact();
    if (!mounted) return;
    setState(() {
      _stage = _Stage.done;
      _message = '';
    });
  }

  // ==========================================================
  // UI
  // ==========================================================

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      body: SafeArea(
        child: Column(
          children: [
            _header(),
            Expanded(child: _body()),
          ],
        ),
      ),
    );
  }

  Widget _body() {
    if (_loading) {
      return const Center(
        child: CircularProgressIndicator(color: _kOrange, strokeWidth: 2),
      );
    }
    // Before the basket, before the address, before anything: is there
    // somebody to bill? See `_authGate` for the argument.
    if (!_signedIn) return _authGate();
    if (_stage == _Stage.done) return _successView();
    if (_lines.isEmpty) return _emptyView();

    return Column(
      children: [
        Expanded(
          child: ListView(
            padding: const EdgeInsets.all(16),
            children: [
              _itemsCard(),
              const SizedBox(height: 14),
              _addressCard(),
              const SizedBox(height: 14),
              _methodCard(),
              const SizedBox(height: 14),
              _summaryCard(),
              if (_stage != _Stage.editing) ...[
                const SizedBox(height: 14),
                _statusCard(),
              ],
              const SizedBox(height: 24),
            ],
          ),
        ),
        _payBar(),
      ],
    );
  }

  /// The masthead, and under it the three-step spine.
  ///
  /// ---- Why a stepper earned its place ----
  ///
  /// Not decoration. A checkout that is one long scroll of cards gives a
  /// shopper no way to tell how much is left, and the moment they cannot tell,
  /// the safe assumption is "more than I want to do right now". Three labelled
  /// steps answer it before they start: address, payment, done.
  ///
  /// It is also the one place the screen can show that the address step is
  /// INCOMPLETE without shouting. A shopper who has no location saved sees step
  /// one still open rather than discovering it at the pay button.
  ///
  /// Back is guarded while a payment is in flight — see `_confirmLeave`.
  Widget _header() {
    return Container(
      decoration: const BoxDecoration(
        border: Border(bottom: BorderSide(color: _kLine)),
      ),
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 10),
            child: Row(
              children: [
                GestureDetector(
                  onTap: _leave,
                  child: const SizedBox(
                    width: 40,
                    height: 40,
                    child:
                        Icon(Icons.arrow_back_ios_new, size: 20, color: _kInk),
                  ),
                ),
                const SizedBox(width: 4),
                Text('Checkout',
                    style: _type(size: 18, weight: FontWeight.w700)),
                const Spacer(),
                // Not a button. A padlock beside the total is the one piece of
                // reassurance a checkout can offer that costs nothing and is
                // true: the payment happens on Pesapal, not here, and this app
                // never sees a card number.
                const Icon(Icons.lock_outline, size: 15, color: _kMuted),
                const SizedBox(width: 5),
                Text('Secure', style: _type(size: 12, color: _kMuted)),
                const SizedBox(width: 14),
              ],
            ),
          ),
          if (_stage != _Stage.done) _stepper(),
        ],
      ),
    );
  }

  Widget _stepper() {
    final addressDone = _hasLocation;
    final paying = _stage != _Stage.editing;

    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
      child: Row(
        children: [
          _step(1, 'Address', done: addressDone, active: !addressDone),
          _stepBar(addressDone),
          _step(2, 'Payment',
              done: paying, active: addressDone && !paying),
          _stepBar(false),
          _step(3, 'Done', done: false, active: false),
        ],
      ),
    );
  }

  Widget _step(int number, String label,
      {required bool done, required bool active}) {
    final lit = done || active;
    return Row(
      children: [
        Container(
          width: 20,
          height: 20,
          decoration: BoxDecoration(
            color: done ? _kGreen : (active ? _kOrange : _kLine),
            shape: BoxShape.circle,
          ),
          child: done
              ? const Icon(Icons.check, size: 13, color: Colors.white)
              : Center(
                  child: Text('$number',
                      style: _type(
                        size: 11,
                        weight: FontWeight.w700,
                        color: active ? Colors.white : _kMuted,
                      )),
                ),
        ),
        const SizedBox(width: 6),
        Text(label,
            style: _type(
              size: 12,
              weight: lit ? FontWeight.w600 : FontWeight.w400,
              color: lit ? _kInk : _kMuted,
            )),
      ],
    );
  }

  Widget _stepBar(bool done) => Expanded(
        child: Container(
          height: 1.5,
          margin: const EdgeInsets.symmetric(horizontal: 8),
          color: done ? _kGreen : _kLine,
        ),
      );

  /// Leaving the checkout, with one question asked at the one moment it
  /// matters.
  ///
  /// Pressing back while a payment is open in the browser is the single most
  /// expensive mis-tap available on this screen: the order exists, the money
  /// may be moving, and walking away loses the only thing watching for the
  /// confirmation. Everywhere else, back is just back — a confirmation on an
  /// idle checkout is the kind of dialogue that trains people to tap "yes"
  /// without reading.
  Future<void> _leave() async {
    if (_stage == _Stage.awaitingPayment || _stage == _Stage.confirming) {
      final leave = await showDialog<bool>(
        context: context,
        builder: (dialogContext) => AlertDialog(
          backgroundColor: Colors.white,
          title: Text('Leave while paying?',
              style: _type(size: 16, weight: FontWeight.w700)),
          content: Text(
            'Your order is already saved. If you have paid, we will confirm it '
            'shortly either way — but leaving now stops us checking for you.',
            style: _type(size: 13.5, color: _kBody),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(dialogContext).pop(false),
              child: Text('Stay',
                  style: _type(size: 14, weight: FontWeight.w600)),
            ),
            TextButton(
              onPressed: () => Navigator.of(dialogContext).pop(true),
              child: Text('Leave',
                  style: _type(
                      size: 14, weight: FontWeight.w600, color: _kRed)),
            ),
          ],
        ),
      );
      if (leave != true) return;
    }

    await widget.onBackTap?.call();
    if (mounted) Navigator.of(context).maybePop();
  }

  Widget _card(Widget child, {Color? tint, Color? edge}) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: tint ?? Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: edge ?? _kLine),
      ),
      child: child,
    );
  }

  Widget _label(String text) => Text(
        text,
        style: _type(
          size: 11,
          weight: FontWeight.w700,
          color: _kFaint,
        ),
      );

  Widget _itemsCard() {
    return _card(
      Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              _label('ITEMS ($_itemCount)'),
              // Opens the basket rather than popping.
              //
              // `Navigator.pop` was wrong and only looked right: it assumes the
              // checkout was pushed FROM the basket, so it works when a shopper
              // arrives that way and quietly does something else — back to the
              // product page, back to the home tab — whenever they do not. It
              // also came back with a stale basket, because nothing re-read
              // storage after they edited it.
              //
              // Pushing the basket and reloading on return is correct from
              // wherever the checkout was opened, and the items, subtotal and
              // delivery quote are all rebuilt from what they actually left in
              // it.
              GestureDetector(
                onTap: () async {
                  await ShoppingCartPage.open(context);
                  if (mounted) await _load();
                },
                child: Text('Edit',
                    style: _type(
                        size: 13, weight: FontWeight.w600, color: _kOrange)),
              ),
            ],
          ),
          const SizedBox(height: 14),
          ..._lines.take(3).map((line) {
            final name = (line['name'] ?? 'Product').toString();
            final image = (line['image'] ?? '').toString();
            final price =
                (line['price'] is num) ? (line['price'] as num).toDouble() : 0.0;
            final qty = (line['quantity'] is num)
                ? (line['quantity'] as num).toInt()
                : 1;

            return Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: Row(
                children: [
                  ClipRRect(
                    borderRadius: BorderRadius.circular(8),
                    child: Container(
                      width: 48,
                      height: 48,
                      color: _kSurface,
                      child: image.startsWith('http')
                          ? CachedNetworkImage(
                              imageUrl: image,
                              httpHeaders: _kImageHeaders,
                              fit: BoxFit.cover,
                              errorWidget: (_, __, ___) => const Icon(
                                  Icons.image_outlined,
                                  color: _kFaint,
                                  size: 20),
                            )
                          : const Icon(Icons.image_outlined,
                              color: _kFaint, size: 20),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(name,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: _type(size: 13, weight: FontWeight.w500)),
                        const SizedBox(height: 2),
                        Text('Qty: $qty',
                            style: _type(size: 11, color: _kMuted)),
                      ],
                    ),
                  ),
                  Text(_ugx(price * qty),
                      style: _type(size: 13, weight: FontWeight.w700)),
                ],
              ),
            );
          }),
          if (_lines.length > 3)
            Text('+${_lines.length - 3} more',
                style: _type(size: 12, color: _kMuted)),
        ],
      ),
    );
  }

  Widget _addressCard() {
    final address = _address;
    final has = _hasLocation;

    return _card(
      Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              _label('DELIVERY ADDRESS'),
              GestureDetector(
                onTap: _editAddress,
                child: Text(has ? 'Change' : 'Add',
                    style: _type(
                        size: 13, weight: FontWeight.w600, color: _kOrange)),
              ),
            ],
          ),
          const SizedBox(height: 12),
          GestureDetector(
            onTap: _editAddress,
            child: Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: _kSurface,
                borderRadius: BorderRadius.circular(10),
              ),
              child: Row(
                children: [
                  Icon(Icons.location_on_outlined,
                      size: 22, color: has ? _kOrange : _kFaint),
                  const SizedBox(width: 12),
                  Expanded(
                    child: has
                        ? Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                [
                                  (address!['first_name'] ?? '').toString(),
                                  (address['last_name'] ?? '').toString()
                                ].where((s) => s.isNotEmpty).join(' '),
                                style:
                                    _type(size: 14, weight: FontWeight.w600),
                              ),
                              const SizedBox(height: 2),
                              Text(
                                [
                                  (address['address'] ?? '').toString(),
                                  (address['city'] ?? '').toString()
                                ].where((s) => s.isNotEmpty).join(', '),
                                maxLines: 2,
                                overflow: TextOverflow.ellipsis,
                                style: _type(size: 12, color: _kBody),
                              ),
                              Text((address['phone'] ?? '').toString(),
                                  style: _type(size: 12, color: _kMuted)),
                            ],
                          )
                        : Text(
                            // A v1 record — an address with no coordinates —
                            // lands here too, and it must: an order priced from
                            // no location gets no delivery line at all.
                            address == null
                                ? 'Add where this order is going'
                                : 'Confirm your location so we can price delivery',
                            style: _type(size: 13, color: _kMuted),
                          ),
                  ),
                  const Icon(Icons.chevron_right, color: _kMuted, size: 22),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _methodCard() {
    return _card(
      Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _label('PAYMENT'),
          const SizedBox(height: 12),
          _methodTile(
            _Method.cod,
            Icons.payments_outlined,
            'Cash on delivery',
            'Pay the rider when your order arrives',
          ),
          const SizedBox(height: 10),
          _methodTile(
            _Method.mobile,
            Icons.phone_android,
            'Mobile money',
            _pesapalEnabled
                ? 'MTN or Airtel, on the next screen'
                : 'Not available just now',
            enabled: _pesapalEnabled,
          ),
          const SizedBox(height: 10),
          _methodTile(
            _Method.card,
            Icons.credit_card,
            'Card',
            _pesapalEnabled
                ? 'Visa or Mastercard, on the next screen'
                : 'Not available just now',
            enabled: _pesapalEnabled,
          ),
          if (_method != _Method.cod && _pesapalEnabled) ...[
            const SizedBox(height: 12),
            Text(
              // Said plainly because the alternative is a shopper waiting on
              // this screen for an SMS prompt that is never coming.
              'You will finish paying on Pesapal in your browser, then come '
              'back here.',
              style: _type(size: 12, color: _kMuted),
            ),
          ],
        ],
      ),
    );
  }

  Widget _methodTile(
    _Method method,
    IconData icon,
    String title,
    String note, {
    bool enabled = true,
  }) {
    final selected = _method == method;
    return Opacity(
      opacity: enabled ? 1 : 0.45,
      child: GestureDetector(
        onTap: enabled ? () => setState(() => _method = method) : null,
        child: Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: selected ? _kOrange.withOpacity(0.06) : _kSurface,
            borderRadius: BorderRadius.circular(10),
            border: Border.all(
              color: selected ? _kOrange : _kLine,
              width: selected ? 1.5 : 1,
            ),
          ),
          child: Row(
            children: [
              Icon(icon, size: 20, color: selected ? _kOrange : _kMuted),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(title,
                        style: _type(size: 14, weight: FontWeight.w600)),
                    Text(note, style: _type(size: 11.5, color: _kMuted)),
                  ],
                ),
              ),
              if (selected)
                const Icon(Icons.check_circle, size: 20, color: _kOrange),
            ],
          ),
        ),
      ),
    );
  }

  Widget _summaryCard() {
    return _card(
      Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _label('SUMMARY'),
          const SizedBox(height: 14),
          _row('Subtotal ($_itemCount items)', _ugx(_subtotal)),
          const SizedBox(height: 8),
          _deliveryRow(),
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 12),
            child: Divider(height: 1, color: _kLine),
          ),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('Total', style: _type(size: 16, weight: FontWeight.w700)),
              Text(_ugx(_total),
                  style: _type(
                      size: 20, weight: FontWeight.w700, color: _kOrange)),
            ],
          ),
        ],
      ),
      tint: _kSurface,
    );
  }

  Widget _deliveryRow() {
    if (!_hasLocation) {
      return Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text('Delivery', style: _type(size: 13, color: _kBody)),
          GestureDetector(
            onTap: _editAddress,
            child: Text('Add address',
                style:
                    _type(size: 13, weight: FontWeight.w600, color: _kOrange)),
          ),
        ],
      );
    }
    if (_quoting) {
      return _row('Delivery', 'Working it out…');
    }
    if (!_deliverable) {
      return _row('Delivery', 'Too far', color: _kRed);
    }
    if (_deliveryFree) {
      return _row(
        _deliveryLabel.isEmpty ? 'Delivery' : 'Delivery ($_deliveryLabel)',
        'FREE',
        color: _kGreen,
      );
    }
    return _row(
      _deliveryLabel.isEmpty ? 'Delivery' : 'Delivery ($_deliveryLabel)',
      _ugx(_deliveryFee),
    );
  }

  Widget _row(String label, String value, {Color? color}) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Expanded(
          child: Text(label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: _type(size: 13, color: _kBody)),
        ),
        const SizedBox(width: 12),
        Text(value,
            style: _type(
                size: 13, weight: FontWeight.w600, color: color ?? _kInk)),
      ],
    );
  }

  /// The sign-in wall.
  ///
  /// ---- This reverses a decision written at the head of this file ----
  ///
  /// That note says, and still says: "A shopper does not need an account to
  /// buy, and requiring one here would turn away the shopper who just wants
  /// the shoes." That argument has not become wrong. Every checkout that adds
  /// a sign-in step loses some share of the people who reach it, and for an
  /// impulse purchase on a phone the share is not small.
  ///
  /// It is overruled deliberately, because the shop asked for it, and the
  /// counter-arguments are real too:
  ///
  ///   • An order placed anonymously from a device cannot be found again by
  ///     the person who placed it. The website has "Orders" behind an account;
  ///     the app had a receipt that vanished when storage was cleared.
  ///   • The name and phone on an anonymous order are whatever was typed into
  ///     the address form, unverified. A rider calling a mistyped number is a
  ///     delivery that fails and a fee paid twice.
  ///
  /// If conversion drops after this ships, THIS is the thing to measure, and
  /// the cheapest partial rollback is guest checkout for cash on delivery with
  /// sign-in kept for card and mobile money.
  ///
  /// ---- Why a wall and not an automatic redirect ----
  ///
  /// Pushing the auth page from `initState` was the obvious build and it is
  /// hostile: the shopper taps "Checkout" and lands, with no transition they
  /// asked for, on a page demanding a password — and the back gesture from
  /// there returns to the basket, so the checkout appears not to exist. A
  /// screen that says what is being asked and why, with one button, is one
  /// extra tap and no confusion.
  ///
  /// The session is re-read after the auth page closes rather than trusted
  /// from a callback, because sign-in can also complete through an OAuth
  /// redirect that this widget never sees.
  Widget _authGate() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(
        children: [
          const SizedBox(height: 40),
          Container(
            width: 88,
            height: 88,
            decoration: BoxDecoration(
              color: _kOrange.withOpacity(0.09),
              shape: BoxShape.circle,
            ),
            child: const Icon(Icons.lock_outline_rounded,
                color: _kOrange, size: 40),
          ),
          const SizedBox(height: 22),
          Text('Sign in to check out',
              style: _type(size: 20, weight: FontWeight.w700)),
          const SizedBox(height: 8),
          Text(
            // The reason, not the rule. "You must be signed in" is a wall;
            // this is what the shopper gets for the thirty seconds.
            'So we can send your order to the right person, keep your receipt, '
            'and let you track it from Orders.',
            textAlign: TextAlign.center,
            style: _type(size: 13.5, color: _kBody),
          ),
          const SizedBox(height: 24),
          GestureDetector(
            onTap: _openAuth,
            child: Container(
              width: double.infinity,
              height: 52,
              decoration: BoxDecoration(
                gradient: const LinearGradient(colors: [_kOrange, _kOrangeDark]),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Center(
                child: Text('Sign in or create account',
                    style: _type(
                        size: 15,
                        weight: FontWeight.w700,
                        color: Colors.white)),
              ),
            ),
          ),
          const SizedBox(height: 14),
          GestureDetector(
            // The way out. A wall with no door is a dead end, and the basket
            // is where somebody who is not ready to sign up wants to be —
            // with their items still in it, which they are.
            onTap: () async {
              await widget.onBackTap?.call();
              if (mounted) Navigator.of(context).maybePop();
            },
            child: Text('Back to basket',
                style: _type(
                    size: 13.5, weight: FontWeight.w600, color: _kMuted)),
          ),
          const SizedBox(height: 28),
          // The basket is not lost, and saying so is the point. The commonest
          // reason to abandon here is the fear that signing in means starting
          // over.
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: _kSurface,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: _kLine),
            ),
            child: Row(
              children: [
                const Icon(Icons.shopping_bag_outlined,
                    size: 18, color: _kMuted),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    'Your basket is saved on this phone. Nothing is lost.',
                    style: _type(size: 12.5, color: _kBody),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  /// Opens the auth page, then re-reads the session and carries on.
  Future<void> _openAuth() async {
    HapticFeedback.selectionClick();
    await KandiAuthPage.open(context);
    if (!mounted) return;

    if (!KandiAuthPage.isSignedIn()) {
      // Backed out without finishing. The gate stays; nothing is said, because
      // they know what they just did.
      //
      // There is no longer a second reason to be here. Sign-up used to return
      // no session while an emailed confirmation link went unclicked, so a
      // shopper could complete the form and still land back on this gate; the
      // shop's own accounts issue the session immediately, so creating one now
      // either signs you in or fails loudly.
      return;
    }

    setState(() {
      _signedIn = true;
      _loading = true;
    });
    await _load();
  }

  Widget _statusCard() {
    final failed = _stage == _Stage.failed;
    final waiting = _stage == _Stage.awaitingPayment;
    final color = failed ? _kRed : (waiting ? _kOrange : _kBody);

    return _card(
      Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (_stage == _Stage.placing || _stage == _Stage.confirming)
                const SizedBox(
                  width: 20,
                  height: 20,
                  child: CircularProgressIndicator(
                      strokeWidth: 2, color: _kOrange),
                )
              else
                Icon(
                  failed ? Icons.error_outline : Icons.hourglass_top,
                  size: 20,
                  color: color,
                ),
              const SizedBox(width: 12),
              Expanded(
                child: Text(_message, style: _type(size: 13, color: color)),
              ),
            ],
          ),
          if (waiting || failed) ...[
            const SizedBox(height: 12),
            GestureDetector(
              onTap: () {
                if (waiting) {
                  _checkPayment();
                } else {
                  setState(() {
                    _stage = _Stage.editing;
                    _message = '';
                  });
                }
              },
              child: Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                decoration: BoxDecoration(
                  color: _kInk,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  waiting ? "I've paid — check now" : 'Try again',
                  style: _type(
                      size: 12, weight: FontWeight.w600, color: Colors.white),
                ),
              ),
            ),
          ],
        ],
      ),
      tint: color.withOpacity(0.06),
      edge: color.withOpacity(0.25),
    );
  }

  Widget _payBar() {
    final busy = _stage == _Stage.placing || _stage == _Stage.confirming;
    final enabled = _canPay && !busy;

    return Container(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 16),
      decoration: const BoxDecoration(
        border: Border(top: BorderSide(color: _kLine)),
      ),
      child: GestureDetector(
        onTap: enabled
            ? _pay
            : (!_hasLocation ? _editAddress : null),
        child: Container(
          height: 54,
          decoration: BoxDecoration(
            gradient: (enabled || !_hasLocation)
                ? const LinearGradient(colors: [_kOrange, _kOrangeDark])
                : null,
            color: (enabled || !_hasLocation) ? null : _kLine,
            borderRadius: BorderRadius.circular(12),
          ),
          child: Center(
            child: busy
                ? const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(
                        strokeWidth: 2, color: Colors.white),
                  )
                : Text(
                    !_hasLocation
                        ? 'Add delivery address'
                        : _method == _Method.cod
                            ? 'Place order · ${_ugx(_total)}'
                            : 'Pay ${_ugx(_total)}',
                    style: _type(
                      size: 16,
                      weight: FontWeight.w700,
                      color: (enabled || !_hasLocation) ? Colors.white : _kMuted,
                    ),
                  ),
          ),
        ),
      ),
    );
  }

  Widget _emptyView() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Icon(Icons.shopping_bag_outlined, size: 56, color: _kFaint),
          const SizedBox(height: 16),
          Text('Your basket is empty',
              style: _type(size: 17, weight: FontWeight.w700)),
          const SizedBox(height: 6),
          Text('Add something to check out',
              style: _type(size: 13, color: _kMuted)),
          const SizedBox(height: 24),
          // A dead end needs a door. This state had none: a shopper who
          // reached the checkout with an empty basket could only use the
          // system back gesture, which on this screen is one tap they should
          // not have to find.
          GestureDetector(
            onTap: () async {
              await widget.onBackTap?.call();
              if (mounted) {
                Navigator.of(context).popUntil((route) => route.isFirst);
              }
            },
            child: Container(
              padding:
                  const EdgeInsets.symmetric(horizontal: 26, vertical: 13),
              decoration: BoxDecoration(
                gradient:
                    const LinearGradient(colors: [_kOrange, _kOrangeDark]),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Text('Start shopping',
                  style: _type(
                      size: 14,
                      weight: FontWeight.w700,
                      color: Colors.white)),
            ),
          ),
        ],
      ),
    );
  }

  Widget _successView() {
    final cod = _method == _Method.cod;
    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(
        children: [
          const SizedBox(height: 40),
          Container(
            width: 88,
            height: 88,
            decoration: BoxDecoration(
              color: _kGreen.withOpacity(0.1),
              shape: BoxShape.circle,
            ),
            child: const Icon(Icons.check_rounded, color: _kGreen, size: 48),
          ),
          const SizedBox(height: 24),
          Text(cod ? 'Order placed' : 'Payment received',
              style: _type(size: 22, weight: FontWeight.w700)),
          const SizedBox(height: 8),
          if (_orderId != null)
            Text('Order #$_orderId', style: _type(size: 14, color: _kMuted)),
          const SizedBox(height: 24),
          _card(
            Column(
              children: [
                _row('Total', _ugx(_total)),
                const SizedBox(height: 8),
                _row(
                  'Payment',
                  cod
                      ? 'Cash on delivery'
                      : _method == _Method.card
                          ? 'Card'
                          : 'Mobile money',
                ),
              ],
            ),
            tint: _kSurface,
          ),
          const SizedBox(height: 12),
          Text(
            cod
                ? 'Have the exact amount ready for the rider.'
                : 'We are preparing your order. You can track it under Orders.',
            textAlign: TextAlign.center,
            style: _type(size: 13, color: _kBody),
          ),
          const SizedBox(height: 24),
          GestureDetector(
            // `popUntil(isFirst)`, not `maybePop`.
            //
            // A single pop lands the shopper back on whatever pushed the
            // checkout — which is almost always the basket, and the basket is
            // now empty. Finishing an order and being shown an empty basket
            // reads as though something went wrong. This returns to the first
            // route, which is the shop.
            onTap: () async {
              await widget.onOrderComplete?.call();
              if (mounted) {
                Navigator.of(context).popUntil((route) => route.isFirst);
              }
            },
            child: Container(
              width: double.infinity,
              height: 52,
              decoration: BoxDecoration(
                gradient: const LinearGradient(colors: [_kOrange, _kOrangeDark]),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Center(
                child: Text('Continue shopping',
                    style: _type(
                        size: 15,
                        weight: FontWeight.w700,
                        color: Colors.white)),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// A failure carrying a sentence worth showing the shopper.
///
/// Distinguished from an arbitrary exception so the catch in `_pay` can tell a
/// message the server wrote — "We do not deliver that far yet" — from a network
/// fault, and show the right one. Everything else becomes "check your
/// connection", which is the honest reading of an exception nobody planned for.
class _Failure implements Exception {
  final String message;
  const _Failure(this.message);
}
