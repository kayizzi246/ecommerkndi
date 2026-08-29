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
import '/custom_code/widgets/kandi_cart_store.dart';
import '/custom_code/widgets/kandi_addresses_screen.dart';
import '/custom_code/widgets/kandi_payment_screen.dart';

import 'dart:math';

// ============================================================
//  KANDI — CHECKOUT
//
//  The last screen, and the only one where a mistake costs
//  somebody money.
//
//  ONE PAGE, NOT A WIZARD
//  -----------------------------------------------------------
//  Details, delivery, payment and the order summary are all on
//  one scroll. A multi-step wizard looks tidier and is worse
//  here: every step is a screen a shopper can abandon on, and
//  the field they want to correct is always on the step they
//  just left. One page means the whole commitment is visible at
//  once, which is also what makes the total believable.
//
//  THE TOTAL IS THE SERVER'S
//  -----------------------------------------------------------
//  Delivery is quoted by `/api/delivery/quote` against the
//  address, and the order total is whatever `/api/checkout`
//  charges. This screen never invents a figure — it displays
//  what it was told and sends the basket. A client that computes
//  its own total is a client that eventually disagrees with the
//  invoice, and the shopper is the one who finds out.
//
//  IDEMPOTENCY
//  -----------------------------------------------------------
//  Every submit carries an `Idempotency-Key`, minted once per
//  ATTEMPT. A stalled connection on a Ugandan mobile network,
//  a double tap, or a browser retrying a POST all produce two
//  identical orders otherwise — the shop packs both, the shopper
//  is charged twice, and somebody notices a week later. The
//  server half of this already exists; this is the half that
//  sends the key.
// ============================================================

/// What the delivery quote came back with.
class _Quote {
  const _Quote({required this.fee, required this.label, this.free = false});

  final num fee;
  final String label;
  final bool free;

  static _Quote? fromJson(dynamic raw) {
    if (raw is! Map) return null;
    final fee = raw['fee'] ?? raw['amount'] ?? raw['cost'];
    if (fee is! num) return null;
    return _Quote(
      fee: fee,
      label: (raw['label'] ?? raw['name'] ?? 'Delivery').toString(),
      free: fee == 0 || raw['free'] == true,
    );
  }
}

/// Name, address, payment method, and the button that makes an order.
///
/// Where it goes afterwards is decided here now. Cash on delivery is finished
/// the moment the order exists, so it lands on the confirmation; a card or
/// mobile-money order is real and unpaid until Pesapal says otherwise, so it
/// lands on the payment screen with the token that lets it open Pesapal again.
/// Both used to be an `onOrderPlaced` callback, which meant the one moment in
/// the app where money changes hands depended on a parameter somebody had to
/// remember to wire.
class KandiCheckoutScreen extends StatefulWidget {
  const KandiCheckoutScreen({super.key, this.width, this.height});

  final double? width;
  final double? height;

  @override
  State<KandiCheckoutScreen> createState() => _KandiCheckoutScreenState();
}

class _KandiCheckoutScreenState extends State<KandiCheckoutScreen> {
  final _formKey = GlobalKey<FormState>();

  final _firstName = TextEditingController();
  final _lastName = TextEditingController();
  final _phone = TextEditingController();
  final _email = TextEditingController();
  final _address = TextEditingController();
  final _city = TextEditingController();
  final _notes = TextEditingController();

  /// `cod` or `pesapal`. The server's own names, not the app's.
  String _payment = 'cod';

  _Quote? _quote;
  bool _quoting = false;
  bool _placing = false;
  String? _error;

  /// One key per checkout ATTEMPT.
  ///
  /// Minted when the screen opens and replaced only after an order is
  /// successfully placed. That is the correct lifetime: a failed submit that
  /// the shopper corrects and retries is the SAME attempt and must reuse the
  /// key, or the retry creates a second order the first one only failed to
  /// report. A key per tap would defeat the whole mechanism.
  late String _idempotencyKey = _mintKey();

  static String _mintKey() {
    final random = Random();
    final stamp = DateTime.now().millisecondsSinceEpoch;
    final noise = List.generate(8, (_) => random.nextInt(36).toRadixString(36))
        .join();
    return 'app-$stamp-$noise';
  }

  @override
  void initState() {
    super.initState();
    KandiCart.load().then((_) {
      if (mounted) setState(() {});
    });
  }

  @override
  void dispose() {
    for (final controller in [
      _firstName,
      _lastName,
      _phone,
      _email,
      _address,
      _city,
      _notes,
    ]) {
      controller.dispose();
    }
    super.dispose();
  }

  // ============================================================
  //  DELIVERY
  // ============================================================

  /// Asks the server what delivery costs, once there is a city to ask about.
  ///
  /// Debounced by the caller rather than fired on every keystroke: a quote per
  /// character typed into "Kampala" is seven requests for one answer, on a
  /// connection the shopper is paying for.
  Future<void> _fetchQuote() async {
    final city = _city.text.trim();
    if (city.isEmpty) {
      setState(() => _quote = null);
      return;
    }

    setState(() => _quoting = true);

    final result = await KandiApi.post(
      '/api/delivery/quote',
      body: {'place': city, 'subtotal': KandiCart.subtotal},
    );

    if (!mounted) return;
    setState(() {
      _quoting = false;
      // A failed quote leaves the fee unknown rather than guessing at zero.
      // The summary then says "calculated at checkout" and the server's own
      // figure lands on the order — which is the honest outcome, because a
      // client that invents a delivery fee is a client that will one day
      // undercharge and have to ask for more.
      _quote = result.status == 200 ? _Quote.fromJson(result.data) : null;
    });
  }

  // ============================================================
  //  PLACING THE ORDER
  // ============================================================

  Future<void> _place() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    if (KandiCart.isEmpty) return;

    FocusScope.of(context).unfocus();
    setState(() {
      _placing = true;
      _error = null;
    });

    final result = await KandiApi.post(
      '/api/checkout',
      headers: {'Idempotency-Key': _idempotencyKey},
      body: {
        'customer': {
          'first_name': _firstName.text.trim(),
          'last_name': _lastName.text.trim(),
          'phone': _phone.text.trim(),
          'email': _email.text.trim(),
          'address_1': _address.text.trim(),
          'city': _city.text.trim(),
          if (_notes.text.trim().isNotEmpty) 'notes': _notes.text.trim(),
        },
        'items': KandiCart.lines
            .map((line) => {
                  'productId': line.productId,
                  'quantity': line.quantity,
                  if (line.variationId != null && line.variationId! > 0)
                    'variationId': line.variationId,
                  if (line.options.isNotEmpty) 'options': line.options,
                })
            .toList(),
        'payment_method': _payment,
        // Cash on delivery is complete the moment the order exists. Anything
        // else is unpaid until the payment provider says otherwise, and the
        // server needs to know which of the two it is writing.
        'awaiting_payment': _payment != 'cod',
        'delivery_place': _city.text.trim(),
      },
    );

    if (!mounted) return;

    if (result.status == 0) {
      setState(() {
        _placing = false;
        _error = 'Could not reach Kandi. Check your connection and try again.';
      });
      return;
    }

    final data = result.data;
    final orderId = (data is Map && data['id'] is num)
        ? (data['id'] as num).toInt()
        : 0;

    if ((result.status != 200 && result.status != 201) || orderId == 0) {
      setState(() {
        _placing = false;
        _error = KandiApi.message(
          data,
          'We could not place your order. Please try again.',
        );
      });
      return;
    }

    // The order exists. The basket it was made from is now history, and the
    // attempt is over — so the next checkout gets a new key rather than being
    // treated as a replay of this one.
    await KandiCart.clear();
    _idempotencyKey = _mintKey();

    if (!mounted) return;
    setState(() => _placing = false);

    final orderNumber = (data is Map ? data['number'] ?? '' : '').toString();
    final paymentToken =
        (data is Map ? data['payment_token'] ?? '' : '').toString();

    // `pushReplacement`, not `push`. Going back to a checkout for a basket
    // that has just been emptied is a screen that can only say "your cart is
    // empty", and on a card order it is a second chance to place the same
    // order twice.
    final placed = _payment == 'cod';

    await Navigator.of(context).pushReplacement(
      MaterialPageRoute<void>(
        builder: (_) => placed
            ? const KandiOrderPlacedScreen()
            : const KandiPaymentScreen(),
        // The arguments go on the ROUTE, which is where both screens read
        // them from — see `KandiNav.open`. This is a `pushReplacement` rather
        // than a `KandiNav.open`, so the settings are spelled out here.
        settings: RouteSettings(
          arguments: placed
              ? orderNumber
              : KandiPaymentArgs(
                  orderId: orderId,
                  orderNumber: orderNumber,
                  paymentToken: paymentToken,
                ),
        ),
      ),
    );
  }

  /// Fills the delivery fields from the address book.
  ///
  /// The book existed and nothing opened it: `pickMode` was a parameter for a
  /// page to wire up, and no page did. One button is the whole feature.
  Future<void> _pickAddress() async {
    final address = await KandiNav.open<KandiAddress>(
      context,
      const KandiAddressesScreen(),
      args: true,
    );
    if (!mounted || address == null) return;

    setState(() {
      _address.text = address.street;
      _city.text = address.city;
      if (address.phone.isNotEmpty) _phone.text = address.phone;
      if (address.notes.isNotEmpty) _notes.text = address.notes;

      // "Jane Nakato" arrives as one field and leaves as two, because that is
      // the shape WooCommerce wants.
      final parts = address.name.trim().split(RegExp(r'\s+'));
      if (parts.length > 1) {
        _firstName.text = parts.first;
        _lastName.text = parts.sublist(1).join(' ');
      } else if (parts.first.isNotEmpty) {
        _firstName.text = parts.first;
      }
    });

    // The town may have changed, and with it what delivery costs.
    await _fetchQuote();
  }

  // ============================================================
  //  THE SCREEN
  // ============================================================

  @override
  Widget build(BuildContext context) {
    return Container(
      width: widget.width,
      height: widget.height,
      color: KandiColors.page,
      child: Scaffold(
        backgroundColor: KandiColors.page,
        appBar: kandiAppBar(context, 'Checkout'),
        body: KandiCart.isEmpty
            ? KandiEmpty(
                icon: Icons.shopping_bag_outlined,
                title: 'Your cart is empty',
                message: 'Add something to it before checking out.',
                actionLabel: 'Back to cart',
                onAction: () => Navigator.of(context).maybePop(),
              )
            : Form(
                key: _formKey,
                child: ListView(
                  padding: const EdgeInsets.all(KandiSpace.gutter),
                  children: [
                    _details(),
                    const SizedBox(height: KandiSpace.md),
                    _delivery(),
                    const SizedBox(height: KandiSpace.md),
                    _paymentBlock(),
                    const SizedBox(height: KandiSpace.md),
                    _order(),
                    if (_error != null) ...[
                      const SizedBox(height: KandiSpace.md),
                      _errorBanner(),
                    ],
                    const SizedBox(height: KandiSpace.xxl),
                  ],
                ),
              ),
        bottomNavigationBar: KandiCart.isEmpty ? null : _payBar(),
      ),
    );
  }

  Widget _details() {
    return KandiCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Your details', style: KandiType.heading()),
          const SizedBox(height: KandiSpace.lg),
          Row(
            children: [
              Expanded(
                child: _field(
                  _firstName,
                  'First name',
                  required: true,
                  capitalise: true,
                ),
              ),
              const SizedBox(width: KandiSpace.sm),
              Expanded(
                // Last name is not required, and that is deliberate: the
                // server asks for `first_name`, `phone`, `address_1` and
                // `city` and nothing else. A field marked required in the app
                // that the server does not need is a barrier the shop did not
                // ask for.
                child: _field(_lastName, 'Last name', capitalise: true),
              ),
            ],
          ),
          const SizedBox(height: KandiSpace.md),
          _field(
            _phone,
            'Phone number',
            required: true,
            keyboard: TextInputType.phone,
            hint: '07XX XXX XXX',
            validator: (value) {
              final digits = (value ?? '').replaceAll(RegExp(r'[^0-9]'), '');
              // Nine digits is a Ugandan number without its leading zero, so
              // this accepts 0771…, +256771… and 771… alike. Rejecting a
              // format the courier can still dial is a refusal with no
              // purpose.
              if (digits.length < 9) return 'Enter a number we can call';
              return null;
            },
          ),
          const SizedBox(height: KandiSpace.md),
          _field(
            _email,
            'Email (optional)',
            keyboard: TextInputType.emailAddress,
            hint: 'For your receipt',
            validator: (value) {
              final text = (value ?? '').trim();
              if (text.isEmpty) return null;
              if (!text.contains('@') || !text.contains('.')) {
                return 'Check this email address';
              }
              return null;
            },
          ),
        ],
      ),
    );
  }

  Widget _delivery() {
    return KandiCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Text('Where it goes', style: KandiType.heading()),
              const Spacer(),
              TextButton.icon(
                onPressed: _pickAddress,
                style: TextButton.styleFrom(
                  padding: EdgeInsets.zero,
                  minimumSize: Size.zero,
                  tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                ),
                icon: const Icon(Icons.bookmark_border_rounded,
                    size: 17, color: KandiColors.primary),
                label: Text(
                  'Saved',
                  style: KandiType.label(color: KandiColors.primary),
                ),
              ),
            ],
          ),
          const SizedBox(height: KandiSpace.lg),
          _field(
            _address,
            'Street, building, landmark',
            required: true,
            capitalise: true,
            maxLines: 2,
          ),
          const SizedBox(height: KandiSpace.md),
          _field(
            _city,
            'Town or city',
            required: true,
            capitalise: true,
            // The quote is asked for when the field is DONE, not while it is
            // being typed. Seven requests to spell "Kampala" is seven the
            // shopper pays for.
            onDone: _fetchQuote,
          ),
          const SizedBox(height: KandiSpace.md),
          _field(
            _notes,
            'Delivery notes (optional)',
            hint: 'Gate colour, who to ask for…',
            maxLines: 2,
          ),
          if (_quoting) ...[
            const SizedBox(height: KandiSpace.md),
            Row(
              children: [
                const SizedBox(
                  width: 14,
                  height: 14,
                  child: CircularProgressIndicator(
                      strokeWidth: 2, color: KandiColors.primary),
                ),
                const SizedBox(width: KandiSpace.sm),
                Text('Checking delivery…', style: KandiType.caption()),
              ],
            ),
          ],
        ],
      ),
    );
  }

  Widget _paymentBlock() {
    return KandiCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('How you pay', style: KandiType.heading()),
          const SizedBox(height: KandiSpace.md),
          _paymentOption(
            value: 'cod',
            icon: Icons.payments_outlined,
            title: 'Cash on delivery',
            subtitle: 'Pay the courier when it arrives',
          ),
          const Divider(height: KandiSpace.xl, color: KandiColors.hairline),
          _paymentOption(
            value: 'pesapal',
            icon: Icons.credit_card_rounded,
            title: 'Mobile money or card',
            subtitle: 'MTN MoMo, Airtel Money, Visa or Mastercard',
          ),
        ],
      ),
    );
  }

  Widget _paymentOption({
    required String value,
    required IconData icon,
    required String title,
    required String subtitle,
  }) {
    final selected = _payment == value;

    return GestureDetector(
      onTap: () => setState(() => _payment = value),
      behavior: HitTestBehavior.opaque,
      child: Row(
        children: [
          Container(
            width: 38,
            height: 38,
            decoration: BoxDecoration(
              color: selected ? KandiColors.primarySoft : KandiColors.hairline,
              borderRadius: KandiRadius.sm,
            ),
            child: Icon(
              icon,
              size: 18,
              color: selected ? KandiColors.primary : KandiColors.muted,
            ),
          ),
          const SizedBox(width: KandiSpace.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: KandiType.title()),
                Text(subtitle, style: KandiType.caption()),
              ],
            ),
          ),
          Icon(
            selected
                ? Icons.radio_button_checked_rounded
                : Icons.radio_button_off_rounded,
            size: 20,
            color: selected ? KandiColors.primary : KandiColors.line,
          ),
        ],
      ),
    );
  }

  Widget _order() {
    final subtotal = KandiCart.subtotal;
    final quote = _quote;

    return KandiCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Your order', style: KandiType.heading()),
          const SizedBox(height: KandiSpace.md),
          for (final line in KandiCart.lines) ...[
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                KandiImage(url: line.image, width: 44, height: 44),
                const SizedBox(width: KandiSpace.md),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        line.name,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: KandiType.label(),
                      ),
                      Text(
                        line.options.isEmpty
                            ? '× ${line.quantity}'
                            : '${line.options.values.join(" · ")} · × ${line.quantity}',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: KandiType.caption(),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: KandiSpace.sm),
                Text(kandiPrice(line.lineTotal),
                    style: KandiType.price(size: 13)),
              ],
            ),
            const SizedBox(height: KandiSpace.md),
          ],
          const Divider(height: 1, color: KandiColors.hairline),
          const SizedBox(height: KandiSpace.md),
          _summaryRow('Subtotal', kandiPrice(subtotal)),
          const SizedBox(height: KandiSpace.sm),
          _summaryRow(
            'Delivery',
            quote == null
                // Not "UGX 0". An unknown fee shown as zero is a promise the
                // invoice is about to break.
                ? 'Calculated at checkout'
                : (quote.free ? 'Free' : kandiPrice(quote.fee)),
            highlight: quote?.free ?? false,
          ),
          const SizedBox(height: KandiSpace.md),
          const Divider(height: 1, color: KandiColors.hairline),
          const SizedBox(height: KandiSpace.md),
          Row(
            children: [
              Text('Total', style: KandiType.title()),
              const Spacer(),
              Text(
                quote == null
                    ? kandiPrice(subtotal)
                    : kandiPrice(subtotal + quote.fee),
                style: KandiType.price(size: 20),
              ),
            ],
          ),
          if (quote == null) ...[
            const SizedBox(height: KandiSpace.xs),
            Text(
              'Delivery is added once we have your town.',
              style: KandiType.micro(weight: FontWeight.w400),
            ),
          ],
        ],
      ),
    );
  }

  Widget _summaryRow(String label, String value, {bool highlight = false}) {
    return Row(
      children: [
        Text(label, style: KandiType.bodyText()),
        const Spacer(),
        Text(
          value,
          style: KandiType.label(
            color: highlight ? KandiColors.success : KandiColors.ink,
          ).copyWith(fontWeight: FontWeight.w600),
        ),
      ],
    );
  }

  Widget _errorBanner() {
    return Container(
      padding: const EdgeInsets.all(KandiSpace.md),
      decoration: BoxDecoration(
        color: KandiColors.saleSoft,
        borderRadius: KandiRadius.md,
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(Icons.error_outline_rounded,
              size: 18, color: KandiColors.sale),
          const SizedBox(width: KandiSpace.sm),
          Expanded(
            child: Text(
              _error!,
              style: KandiType.label(color: KandiColors.sale),
            ),
          ),
        ],
      ),
    );
  }

  Widget _payBar() {
    final subtotal = KandiCart.subtotal;
    final total = subtotal + (_quote?.fee ?? 0);

    return Container(
      padding: EdgeInsets.fromLTRB(
        KandiSpace.gutter,
        KandiSpace.md,
        KandiSpace.gutter,
        KandiSpace.md + MediaQuery.of(context).padding.bottom,
      ),
      decoration: const BoxDecoration(
        color: KandiColors.surface,
        boxShadow: KandiShadow.raised,
      ),
      child: Row(
        children: [
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Text('Total', style: KandiType.caption()),
              Text(kandiPrice(total), style: KandiType.price(size: 19)),
            ],
          ),
          const SizedBox(width: KandiSpace.md),
          Expanded(
            child: KandiButton(
              // Names what happens next. "Place order" on a card payment is a
              // half-truth — the order is placed and then the shopper is sent
              // to pay — and a button that understates the next step is how
              // somebody abandons at the payment page thinking they are done.
              label: _payment == 'cod' ? 'Place order' : 'Pay now',
              icon: _payment == 'cod'
                  ? Icons.check_rounded
                  : Icons.lock_outline_rounded,
              busy: _placing,
              onPressed: _placing ? null : _place,
            ),
          ),
        ],
      ),
    );
  }

  // ---- One field, so every field looks and behaves the same ----
  Widget _field(
    TextEditingController controller,
    String label, {
    bool required = false,
    bool capitalise = false,
    String? hint,
    TextInputType? keyboard,
    int maxLines = 1,
    String? Function(String?)? validator,
    VoidCallback? onDone,
  }) {
    return TextFormField(
      controller: controller,
      keyboardType: keyboard,
      maxLines: maxLines,
      textCapitalization:
          capitalise ? TextCapitalization.words : TextCapitalization.none,
      style: KandiType.bodyText(color: KandiColors.ink),
      // `onEditingComplete` rather than `onChanged`: it fires when the field
      // is finished with, which is when a delivery quote is worth asking for.
      onEditingComplete: () {
        FocusScope.of(context).nextFocus();
        onDone?.call();
      },
      validator: validator ??
          (required
              ? (value) =>
                  (value ?? '').trim().isEmpty ? 'This one is needed' : null
              : null),
      decoration: InputDecoration(
        labelText: label,
        hintText: hint,
        labelStyle: KandiType.label(color: KandiColors.muted),
        hintStyle: KandiType.label(color: KandiColors.faint),
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
        errorBorder: const OutlineInputBorder(
          borderRadius: KandiRadius.md,
          borderSide: BorderSide(color: KandiColors.sale, width: 1.5),
        ),
        focusedErrorBorder: const OutlineInputBorder(
          borderRadius: KandiRadius.md,
          borderSide: BorderSide(color: KandiColors.sale, width: 1.5),
        ),
        errorStyle: KandiType.micro(
          color: KandiColors.sale,
          weight: FontWeight.w500,
        ),
      ),
    );
  }
}
