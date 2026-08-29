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
import '/custom_code/widgets/kandi_support_screen.dart';
import '/custom_code/widgets/kandi_orders_screen.dart';

import 'dart:async';

// ============================================================
//  KANDI — AFTER THE ORDER
//
//  Two screens: the confirmation, and the one that waits for a
//  payment to clear.
//
//  WHY THE WAIT NEEDS A SCREEN AT ALL
//  -----------------------------------------------------------
//  Cash on delivery finishes the moment the order exists. Mobile
//  money and card do not: the shopper leaves for Pesapal, pays,
//  and comes back — and in between, the order is real but
//  unpaid.
//
//  The app had nowhere to put that. A shopper who paid and
//  returned had no confirmation, and one whose payment failed
//  had no way to try again, so both ended up in the same place:
//  an order list showing "pending" with no explanation.
//
//  POLLING, AND WHY IT BACKS OFF
//  -----------------------------------------------------------
//  `/api/app/payment/status` is documented as safe to poll and
//  safe to call twice — it asks Pesapal and, on a paid order,
//  tells WordPress. So this asks repeatedly rather than trusting
//  the redirect, because a shopper on a Ugandan mobile network
//  routinely comes back to the app before the callback has
//  landed.
//
//  The interval widens as it goes. A mobile-money confirmation
//  usually lands in seconds, so the first few checks are quick;
//  after that, hammering the endpoint every two seconds for five
//  minutes is a hot phone and a bill, and the answer is no more
//  likely to have changed.
// ============================================================

/// Where a payment has got to.
enum KandiPaymentState { waiting, paid, failed, cancelled, unknown }

/// Unwinds to the shell and opens the order list.
///
/// The LIST rather than the order itself: both screens here hold an order id,
/// and the detail screen needs a whole [KandiOrder] that only the list has
/// fetched. The order just placed is the first row on it.
///
/// The navigator is taken before the pop on purpose. `popUntil` disposes the
/// screen that called this, so a `Navigator.of(context)` afterwards would be
/// looking up an element that is no longer in the tree.
void _openOrders(BuildContext context) {
  final navigator = Navigator.of(context);
  KandiNav.tabSelector?.call(KandiNav.accountTab);
  navigator.popUntil((route) => route.isFirst);
  navigator.push(
    MaterialPageRoute<void>(builder: (_) => const KandiOrdersScreen()),
  );
}

/// The order a payment screen is waiting on.
///
/// Rides on the route rather than the constructor — see [KandiNav.open].
class KandiPaymentArgs {
  const KandiPaymentArgs({
    required this.orderId,
    this.orderNumber = '',
    this.paymentToken = '',
  });

  final int orderId;
  final String orderNumber;

  /// Proof that this app placed this order, minted by `/api/checkout` and
  /// returned in its response.
  ///
  /// Required to start the payment again: WooCommerce order ids are
  /// sequential, so `/api/payments/pesapal/start` will not open a payment
  /// against a bare id — without the token a loop could open a payment against
  /// any order in the shop and read that buyer's name, email and address out
  /// of the quote that comes back.
  final String paymentToken;
}

/// The wait between leaving for Pesapal and the money arriving.
///
/// Opened by the checkout as
/// `KandiNav.open(context, const KandiPaymentScreen(), args: KandiPaymentArgs(...))`.
class KandiPaymentScreen extends StatefulWidget {
  const KandiPaymentScreen({super.key, this.width, this.height});

  final double? width;
  final double? height;

  @override
  State<KandiPaymentScreen> createState() => _KandiPaymentScreenState();
}

class _KandiPaymentScreenState extends State<KandiPaymentScreen> {
  KandiPaymentState _state = KandiPaymentState.waiting;
  Timer? _timer;
  int _attempt = 0;

  int _orderId = 0;
  String _orderNumber = '';
  String _paymentToken = '';

  bool _started = false;

  /// How long to wait before the next check, by attempt number.
  ///
  /// Quick at first because a mobile-money confirmation usually lands in
  /// seconds, then widening. The list ends rather than repeating: after about
  /// two minutes the answer is not coming on its own, and a screen that spins
  /// forever is a screen that has stopped telling the truth.
  static const List<int> _backoff = [2, 2, 3, 4, 5, 8, 10, 15, 20, 30, 30];

  /// Reads the order off the route and starts asking, once.
  ///
  /// `didChangeDependencies` rather than `initState` because `ModalRoute.of`
  /// needs the element in the tree — see [KandiNav.argsOf].
  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_started) return;
    _started = true;

    final args = KandiNav.argsOf<KandiPaymentArgs>(context);
    if (args != null) {
      _orderId = args.orderId;
      _orderNumber = args.orderNumber;
      _paymentToken = args.paymentToken;
    }

    _check();
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  /// Opens Pesapal again for an order that failed or was cancelled.
  ///
  /// This used to be handed out as `onRetry`, on the reasoning that opening a
  /// browser is FlutterFlow's job. In practice it left the one button on the
  /// screen that matters — the shopper WANTS to pay — wired to nothing unless
  /// somebody remembered to build the call by hand in the builder.
  Future<void> _retry() async {
    if (_paymentToken.isEmpty) {
      kandiToast(
        context,
        'Open this order from Orders to pay for it',
        error: true,
      );
      return;
    }

    setState(() {
      _state = KandiPaymentState.waiting;
      _attempt = 0;
    });

    final result = await KandiApi.post(
      '/api/payments/pesapal/start',
      body: {
        'purpose': {'kind': 'order', 'orderId': _orderId},
        'token': _paymentToken,
      },
    );

    if (!mounted) return;

    final data = result.data;
    final url = data is Map ? (data['redirect_url'] ?? '').toString() : '';

    if (url.isEmpty) {
      setState(() => _state = KandiPaymentState.failed);
      kandiToast(
        context,
        KandiApi.message(data, 'The payment window would not open.'),
        error: true,
      );
      return;
    }

    await KandiNav.openUrl(context, url);
    // The shopper is now in the browser. Start asking again, so the screen has
    // the answer by the time they come back.
    if (mounted) await _check();
  }

  Future<void> _check() async {
    final result = await KandiApi.post(
      '/api/app/payment/status',
      body: {'orderId': _orderId},
    );

    if (!mounted) return;

    if (result.status == 200 && result.data is Map) {
      final data = result.data as Map;
      final raw = (data['status'] ?? data['state'] ?? '').toString().toLowerCase();

      final state = switch (raw) {
        'paid' || 'completed' || 'processing' || 'success' =>
          KandiPaymentState.paid,
        'failed' || 'invalid' => KandiPaymentState.failed,
        'cancelled' || 'canceled' => KandiPaymentState.cancelled,
        _ => KandiPaymentState.waiting,
      };

      if (state != KandiPaymentState.waiting) {
        setState(() => _state = state);
        if (state == KandiPaymentState.paid) {
          // The order has moved, so anything holding a list of them is wrong.
          KandiCache.invalidate('orders:v1');
        }
        return;
      }
    }

    // Still waiting, or the check itself failed. A failed check is treated as
    // "not yet" rather than as an error: the payment may well have succeeded
    // and it is this request that did not land, and telling somebody their
    // payment failed when it did not is the worst possible mistake here.
    if (_attempt >= _backoff.length) {
      setState(() => _state = KandiPaymentState.unknown);
      return;
    }

    final wait = _backoff[_attempt];
    _attempt++;
    _timer = Timer(Duration(seconds: wait), _check);
  }

  void _checkAgain() {
    setState(() {
      _state = KandiPaymentState.waiting;
      _attempt = 0;
    });
    _check();
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      width: widget.width,
      height: widget.height,
      color: KandiColors.page,
      child: Scaffold(
        backgroundColor: KandiColors.page,
        // No back button while a payment is in flight. Popping mid-check
        // leaves the shopper on the cart with a real, unpaid order behind
        // them and no idea it exists.
        appBar: kandiAppBar(
          context,
          'Payment',
          showBack: _state != KandiPaymentState.waiting,
        ),
        body: Padding(
          padding: const EdgeInsets.all(KandiSpace.gutter),
          child: switch (_state) {
            KandiPaymentState.waiting => _waiting(),
            KandiPaymentState.paid => _paid(),
            KandiPaymentState.failed => _failed(),
            KandiPaymentState.cancelled => _cancelled(),
            KandiPaymentState.unknown => _unknown(),
          },
        ),
      ),
    );
  }

  Widget _waiting() {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const SizedBox(
            width: 42,
            height: 42,
            child: CircularProgressIndicator(
                strokeWidth: 3, color: KandiColors.primary),
          ),
          const SizedBox(height: KandiSpace.xl),
          Text('Confirming your payment', style: KandiType.heading()),
          const SizedBox(height: KandiSpace.sm),
          Text(
            // Says what to do — nothing — because the instinct is to press
            // something, and pressing back here is the one thing that makes it
            // worse.
            'This usually takes a few seconds. Keep this screen open.',
            textAlign: TextAlign.center,
            style: KandiType.bodyText(),
          ),
        ],
      ),
    );
  }

  Widget _paid() {
    return Column(
      children: [
        const Spacer(),
        Container(
          width: 72,
          height: 72,
          decoration: const BoxDecoration(
            color: KandiColors.successSoft,
            shape: BoxShape.circle,
          ),
          child: const Icon(Icons.check_rounded,
              size: 36, color: KandiColors.success),
        ),
        const SizedBox(height: KandiSpace.xl),
        Text('Payment received', style: KandiType.display()),
        const SizedBox(height: KandiSpace.sm),
        Text(
          _orderNumber.isEmpty
              ? 'Your order is confirmed and being packed.'
              : 'Order #$_orderNumber is confirmed and being packed.',
          textAlign: TextAlign.center,
          style: KandiType.bodyText(),
        ),
        const Spacer(),
        KandiButton(
          label: 'Track this order',
          icon: Icons.local_shipping_outlined,
          onPressed: () => _openOrders(context),
        ),
        const SizedBox(height: KandiSpace.sm),
        KandiButton(
          label: 'Keep shopping',
          tone: KandiButtonTone.outline,
          onPressed: () => KandiNav.goTab(context, KandiNav.homeTab),
        ),
        const SizedBox(height: KandiSpace.lg),
      ],
    );
  }

  Widget _failed() => _outcome(
        icon: Icons.close_rounded,
        colour: KandiColors.sale,
        tint: KandiColors.saleSoft,
        title: 'Payment did not go through',
        // Names the two commonest causes, because both are things the shopper
        // can fix. "An error occurred" is a fact about our software.
        message: 'Nothing has been charged. This is usually a declined card '
            'or not enough balance on the mobile money account.',
        primaryLabel: 'Try paying again',
        onPrimary: _retry,
      );

  Widget _cancelled() => _outcome(
        icon: Icons.remove_circle_outline_rounded,
        colour: KandiColors.muted,
        tint: KandiColors.hairline,
        title: 'Payment cancelled',
        message: 'Your order is saved and unpaid. You can pay for it whenever '
            'you are ready.',
        primaryLabel: 'Pay now',
        onPrimary: _retry,
      );

  /// The honest answer when we genuinely do not know.
  ///
  /// Deliberately not "failed". A payment that has not confirmed within two
  /// minutes has very often still succeeded — the callback is late, not
  /// missing — and telling somebody it failed sends them to pay a second time.
  Widget _unknown() => _outcome(
        icon: Icons.schedule_rounded,
        colour: KandiColors.primaryInk,
        tint: KandiColors.primarySoft,
        title: 'Still confirming',
        message: 'This is taking longer than usual. Your order is saved — '
            'check it in a minute, or talk to us if it stays this way.',
        primaryLabel: 'Check again',
        onPrimary: _checkAgain,
      );

  Widget _outcome({
    required IconData icon,
    required Color colour,
    required Color tint,
    required String title,
    required String message,
    required String primaryLabel,
    required VoidCallback? onPrimary,
  }) {
    return Column(
      children: [
        const Spacer(),
        Container(
          width: 72,
          height: 72,
          decoration: BoxDecoration(color: tint, shape: BoxShape.circle),
          child: Icon(icon, size: 34, color: colour),
        ),
        const SizedBox(height: KandiSpace.xl),
        Text(title, style: KandiType.heading(), textAlign: TextAlign.center),
        const SizedBox(height: KandiSpace.sm),
        Text(message, textAlign: TextAlign.center, style: KandiType.bodyText()),
        const Spacer(),
        KandiButton(label: primaryLabel, onPressed: onPrimary),
        const SizedBox(height: KandiSpace.sm),
        KandiButton(
          label: 'See the order',
          tone: KandiButtonTone.outline,
          onPressed: () => _openOrders(context),
        ),
        const SizedBox(height: KandiSpace.md),
        GestureDetector(
          onTap: () => KandiNav.open(context, const KandiSupportScreen()),
          child: Text(
            'Talk to someone',
            style: KandiType.label(color: KandiColors.primaryInk)
                .copyWith(fontWeight: FontWeight.w600),
          ),
        ),
        const SizedBox(height: KandiSpace.lg),
      ],
    );
  }
}

// ============================================================
//  THE CONFIRMATION
// ============================================================

/// Shown after a cash-on-delivery order, where there is nothing to wait for.
class KandiOrderPlacedScreen extends StatelessWidget {
  const KandiOrderPlacedScreen({super.key, this.width, this.height});

  final double? width;
  final double? height;

  @override
  Widget build(BuildContext context) {
    // A StatelessWidget, so the route is read here rather than into a state
    // field. Cheap — one inherited-widget lookup per build.
    final orderNumber = KandiNav.argsOf<String>(context) ?? '';

    return Container(
      width: width,
      height: height,
      color: KandiColors.page,
      child: Scaffold(
        backgroundColor: KandiColors.page,
        // No back button and no app bar title. Going "back" from here lands on
        // a checkout for a basket that no longer exists.
        appBar: kandiAppBar(context, '', showBack: false),
        body: Padding(
          padding: const EdgeInsets.all(KandiSpace.gutter),
          child: Column(
            children: [
              const Spacer(),
              Container(
                width: 76,
                height: 76,
                decoration: const BoxDecoration(
                  color: KandiColors.successSoft,
                  shape: BoxShape.circle,
                ),
                child: const Icon(Icons.check_rounded,
                    size: 38, color: KandiColors.success),
              ),
              const SizedBox(height: KandiSpace.xl),
              Text('Order placed', style: KandiType.display()),
              const SizedBox(height: KandiSpace.sm),
              Text(
                orderNumber.isEmpty
                    ? 'We are packing it now.'
                    : 'Order #$orderNumber. We are packing it now.',
                textAlign: TextAlign.center,
                style: KandiType.bodyText(),
              ),
              const SizedBox(height: KandiSpace.xl),
              KandiCard(
                child: Row(
                  children: [
                    Container(
                      width: 40,
                      height: 40,
                      decoration: const BoxDecoration(
                        color: KandiColors.primarySoft,
                        shape: BoxShape.circle,
                      ),
                      child: const Icon(Icons.payments_outlined,
                          size: 19, color: KandiColors.primary),
                    ),
                    const SizedBox(width: KandiSpace.md),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('Pay on delivery', style: KandiType.title()),
                          Text(
                            'Have the amount ready for the courier.',
                            style: KandiType.caption(),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              const Spacer(),
              KandiButton(
                label: 'Track this order',
                icon: Icons.local_shipping_outlined,
                onPressed: () => _openOrders(context),
              ),
              const SizedBox(height: KandiSpace.sm),
              KandiButton(
                label: 'Keep shopping',
                tone: KandiButtonTone.outline,
                onPressed: () => KandiNav.goTab(context, KandiNav.homeTab),
              ),
              const SizedBox(height: KandiSpace.lg),
            ],
          ),
        ),
      ),
    );
  }
}
