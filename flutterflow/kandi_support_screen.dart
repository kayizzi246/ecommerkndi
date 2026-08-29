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
import '/custom_code/widgets/kandi_auth_screen.dart';

// ============================================================
//  KANDI — HELP, ADDRESSES AND REVIEWS
//
//  Three small screens the app did not have, in one file
//  because each is under two hundred lines and none of them
//  earns its own.
//
//  HELP
//  -----------------------------------------------------------
//  The commonest questions answered on the spot, then a way to
//  reach a person. The answers are drawn from the shop's own
//  settings — the delivery threshold, the returns window — so
//  they cannot go stale the way a hardcoded FAQ does the first
//  time wp-admin changes a number.
//
//  ADDRESSES
//  -----------------------------------------------------------
//  Saved on the handset, not the server. WooCommerce keeps ONE
//  shipping address per customer, so a "saved addresses" screen
//  backed by it could hold exactly one — which is not a feature.
//  Locally the app can hold several, and the checkout fills
//  itself from whichever is picked.
//
//  REVIEWS
//  -----------------------------------------------------------
//  `/api/products/[id]/reviews` accepts a POST, and nothing in
//  the app ever called it. A shopper could read reviews and not
//  write one, which is the wrong way round for a marketplace —
//  the reviews on this catalogue have to come from somewhere,
//  and the people best placed to write them have just received
//  the thing.
// ============================================================

// ============================================================
//  HELP
// ============================================================

/// Help, contact, and the shop's answers to the five things it gets asked.
///
/// ---- The numbers on this screen are not typed anywhere ----
///
/// The phone number, the WhatsApp number, the delivery threshold and the
/// returns window used to be parameters, filled in by hand in the builder from
/// app state. Two problems with that: a shop that changed its returns policy
/// in WordPress had an app that went on quoting the old one until somebody
/// remembered to edit a widget, and the same five values had to be typed again
/// on every screen that quoted them.
///
/// They come from [KandiShop] now, which reads them from the same
/// `/api/app/home` payload the home feed arrives in.
class KandiSupportScreen extends StatefulWidget {
  const KandiSupportScreen({super.key, this.width, this.height});

  final double? width;
  final double? height;

  @override
  State<KandiSupportScreen> createState() => _KandiSupportScreenState();
}

class _KandiSupportScreenState extends State<KandiSupportScreen> {
  final _name = TextEditingController();
  final _email = TextEditingController();
  final _message = TextEditingController();

  bool _sending = false;
  bool _sent = false;
  String? _error;
  int? _openQuestion;

  @override
  void initState() {
    super.initState();

    // The delivery threshold and the returns window are quoted in the answers
    // below. A shopper can reach this screen from the account tab without ever
    // having loaded the home feed, so it cannot be assumed they are in hand.
    KandiShop.ensure().then((_) {
      if (mounted) setState(() {});
    });

    // Prefills from the signed-in account, because asking somebody for their
    // email when the app already knows it is asking them to prove they are
    // paying attention.
    KandiAuth.load().then((_) {
      if (!mounted) return;
      final customer = KandiAuth.customer;
      if (customer != null) {
        _name.text = (customer['first_name'] ?? '').toString();
        _email.text = (customer['email'] ?? '').toString();
        setState(() {});
      }
    });
  }

  @override
  void dispose() {
    for (final c in [_name, _email, _message]) {
      c.dispose();
    }
    super.dispose();
  }

  List<(String, String)> get _questions => [
        (
          'How long does delivery take?',
          'Around Kampala, one to two working days. Upcountry, up to five. '
              '${KandiShop.freeDeliveryFrom > 0 ? "Delivery is free on orders over ${kandiPrice(KandiShop.freeDeliveryFrom)}." : ""}',
        ),
        (
          'How do I pay?',
          'Cash to the courier on delivery, or MTN Mobile Money, Airtel Money '
              'or a card at checkout. Card details are never stored by the shop.',
        ),
        (
          'Can I return something?',
          KandiShop.returnsDays > 0
              ? 'Yes — within ${KandiShop.returnsDays} days of delivery, in its '
                  'original condition with tags attached. If it arrived faulty '
                  'or wrong, we cover the courier both ways.'
              : 'Yes. If it arrived faulty or wrong, we cover the courier both '
                  'ways.',
        ),
        (
          'Where is my order?',
          'Open Account, then Orders. Every order shows how far along it is. '
              'If it has not moved in a few days, message us with the order '
              'number.',
        ),
        (
          'Is my card safe?',
          'The shop never sees your card. Payments go through Pesapal, which '
              'handles the card details directly.',
        ),
      ];

  Future<void> _send() async {
    final message = _message.text.trim();
    if (message.length < 10) {
      setState(() => _error = 'Tell us a little more so we can help.');
      return;
    }
    final email = _email.text.trim();
    if (!email.contains('@') || !email.contains('.')) {
      setState(() => _error = 'We need an email address to reply to.');
      return;
    }

    FocusScope.of(context).unfocus();
    setState(() {
      _sending = true;
      _error = null;
    });

    final result = await KandiApi.post('/api/contact', body: {
      'name': _name.text.trim(),
      'email': email,
      'message': message,
    });

    if (!mounted) return;

    if (result.status == 200 || result.status == 201) {
      setState(() {
        _sending = false;
        _sent = true;
        _message.clear();
      });
      return;
    }

    setState(() {
      _sending = false;
      _error = result.status == 0
          ? 'Could not reach Kandi. Check your connection.'
          : KandiApi.message(result.data, 'We could not send that. Try again.');
    });
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      width: widget.width,
      height: widget.height,
      color: KandiColors.page,
      child: Scaffold(
        backgroundColor: KandiColors.page,
        appBar: kandiAppBar(context, 'Help'),
        body: ListView(
          padding: const EdgeInsets.all(KandiSpace.gutter),
          children: [
            // The fastest routes first. Somebody opening Help usually wants a
            // person, and putting the FAQ above the phone number is the shop
            // answering a question they did not ask.
            _contactRow(),
            const SizedBox(height: KandiSpace.md),
            _faq(),
            const SizedBox(height: KandiSpace.md),
            _form(),
            const SizedBox(height: KandiSpace.xxl),
          ],
        ),
      ),
    );
  }

  Widget _contactRow() {
    final options = <(IconData, String, String, VoidCallback?)>[
      if (KandiShop.whatsapp.isNotEmpty)
        (
          Icons.chat_bubble_outline_rounded,
          'WhatsApp',
          'Usually fastest',
          () => KandiNav.whatsApp(context, KandiShop.whatsapp),
        ),
      if (KandiShop.phone.isNotEmpty)
        (
          Icons.phone_outlined,
          'Call us',
          KandiShop.phone,
          () => KandiNav.dial(context, KandiShop.phone),
        ),
    ];

    if (options.isEmpty) return const SizedBox.shrink();

    return Row(
      children: [
        for (final option in options) ...[
          Expanded(
            child: KandiCard(
              padding: const EdgeInsets.symmetric(
                horizontal: KandiSpace.md,
                vertical: KandiSpace.lg,
              ),
              onTap: option.$4,
              child: Column(
                children: [
                  Container(
                    width: 42,
                    height: 42,
                    decoration: const BoxDecoration(
                      color: KandiColors.primarySoft,
                      shape: BoxShape.circle,
                    ),
                    child: Icon(option.$1,
                        size: 20, color: KandiColors.primary),
                  ),
                  const SizedBox(height: KandiSpace.sm),
                  Text(option.$2, style: KandiType.title()),
                  Text(
                    option.$3,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: KandiType.caption(),
                  ),
                ],
              ),
            ),
          ),
          if (option != options.last) const SizedBox(width: KandiSpace.sm),
        ],
      ],
    );
  }

  Widget _faq() {
    return KandiCard(
      padding: EdgeInsets.zero,
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(
              KandiSpace.lg,
              KandiSpace.lg,
              KandiSpace.lg,
              KandiSpace.sm,
            ),
            child: Row(
              children: [
                Text('Common questions', style: KandiType.heading()),
              ],
            ),
          ),
          for (var i = 0; i < _questions.length; i++) ...[
            InkWell(
              // One open at a time. An accordion where everything can be open
              // at once is a page of text with headings in it, which is what
              // the accordion was for.
              onTap: () => setState(
                () => _openQuestion = _openQuestion == i ? null : i,
              ),
              child: Padding(
                padding: const EdgeInsets.symmetric(
                  horizontal: KandiSpace.lg,
                  vertical: KandiSpace.md,
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(_questions[i].$1,
                              style: KandiType.title()),
                        ),
                        Icon(
                          _openQuestion == i
                              ? Icons.remove_rounded
                              : Icons.add_rounded,
                          size: 18,
                          color: KandiColors.muted,
                        ),
                      ],
                    ),
                    if (_openQuestion == i) ...[
                      const SizedBox(height: KandiSpace.sm),
                      Text(_questions[i].$2.trim(),
                          style: KandiType.bodyText()),
                    ],
                  ],
                ),
              ),
            ),
            if (i < _questions.length - 1)
              const Divider(height: 1, color: KandiColors.hairline),
          ],
        ],
      ),
    );
  }

  Widget _form() {
    if (_sent) {
      return KandiCard(
        child: Row(
          children: [
            const Icon(Icons.mark_email_read_outlined,
                size: 22, color: KandiColors.success),
            const SizedBox(width: KandiSpace.md),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Message sent', style: KandiType.title()),
                  Text(
                    'We usually reply the same working day.',
                    style: KandiType.caption(),
                  ),
                ],
              ),
            ),
            TextButton(
              onPressed: () => setState(() => _sent = false),
              child: Text('Send another',
                  style: KandiType.label(color: KandiColors.primaryInk)),
            ),
          ],
        ),
      );
    }

    return KandiCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Send us a message', style: KandiType.heading()),
          const SizedBox(height: KandiSpace.lg),
          _field(_name, 'Your name'),
          const SizedBox(height: KandiSpace.md),
          _field(_email, 'Email', keyboard: TextInputType.emailAddress),
          const SizedBox(height: KandiSpace.md),
          _field(
            _message,
            'What can we help with?',
            maxLines: 4,
            hint: 'Include your order number if it is about an order',
          ),
          if (_error != null) ...[
            const SizedBox(height: KandiSpace.md),
            Text(_error!, style: KandiType.label(color: KandiColors.sale)),
          ],
          const SizedBox(height: KandiSpace.lg),
          KandiButton(
            label: 'Send message',
            busy: _sending,
            onPressed: _sending ? null : _send,
          ),
        ],
      ),
    );
  }

  Widget _field(
    TextEditingController controller,
    String label, {
    TextInputType? keyboard,
    int maxLines = 1,
    String? hint,
  }) {
    return TextField(
      controller: controller,
      keyboardType: keyboard,
      maxLines: maxLines,
      style: KandiType.bodyText(color: KandiColors.ink),
      decoration: InputDecoration(
        labelText: label,
        hintText: hint,
        labelStyle: KandiType.label(color: KandiColors.muted),
        hintStyle: KandiType.caption(color: KandiColors.faint),
        filled: true,
        fillColor: KandiColors.hairline,
        contentPadding: const EdgeInsets.all(KandiSpace.md),
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

// ============================================================
//  WRITE A REVIEW
// ============================================================

/// The other half of the reviews the product page prints.
///
/// `/api/products/[id]/reviews` has accepted a POST all along and nothing in
/// the app ever called it — a shopper could read reviews and not write one.
/// The product a review is being written about.
///
/// Rides on the route rather than the constructor — see [KandiNav.open].
class KandiReviewArgs {
  const KandiReviewArgs({
    required this.productId,
    this.productName = '',
    this.productImage = '',
  });

  final int productId;
  final String productName;
  final String productImage;
}

/// Write a review of something you bought.
///
/// Pushed from the product screen, which is the only place that knows which
/// product is being reviewed. It pops itself with `true` when the review
/// lands, so the product screen knows to refetch.
class KandiReviewScreen extends StatefulWidget {
  const KandiReviewScreen({super.key, this.width, this.height});

  final double? width;
  final double? height;

  @override
  State<KandiReviewScreen> createState() => _KandiReviewScreenState();
}

class _KandiReviewScreenState extends State<KandiReviewScreen> {
  final _name = TextEditingController();
  final _email = TextEditingController();
  final _body = TextEditingController();

  int _productId = 0;
  String _productName = '';
  String _productImage = '';

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final args = KandiNav.argsOf<KandiReviewArgs>(context);
    if (args == null) return;
    _productId = args.productId;
    _productName = args.productName;
    _productImage = args.productImage;
  }

  int _rating = 0;
  bool _sending = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    KandiAuth.load().then((_) {
      if (!mounted) return;
      final customer = KandiAuth.customer;
      if (customer != null) {
        _name.text = (customer['first_name'] ?? '').toString();
        _email.text = (customer['email'] ?? '').toString();
        setState(() {});
      }
    });
  }

  @override
  void dispose() {
    for (final c in [_name, _email, _body]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _send() async {
    if (_rating == 0) {
      setState(() => _error = 'Pick a rating first.');
      return;
    }
    if (_body.text.trim().length < 10) {
      setState(() => _error = 'A sentence or two helps the next shopper.');
      return;
    }

    FocusScope.of(context).unfocus();
    setState(() {
      _sending = true;
      _error = null;
    });

    final result = await KandiApi.post(
      '/api/products/$_productId/reviews',
      headers: await KandiSession.headers(),
      body: {
        'rating': _rating,
        'review': _body.text.trim(),
        'reviewer': _name.text.trim(),
        'reviewer_email': _email.text.trim(),
      },
    );

    if (!mounted) return;

    if (result.status == 200 || result.status == 201) {
      // The product's cached detail carries the review list and the average,
      // both of which this has just changed.
      KandiCache.invalidate('product:$_productId');
      setState(() => _sending = false);
      kandiToast(context, 'Thank you — your review is in');
      Navigator.of(context).pop(true);
      return;
    }

    setState(() {
      _sending = false;
      _error = result.status == 0
          ? 'Could not reach Kandi. Check your connection.'
          : KandiApi.message(
              result.data,
              'We could not post that review. Please try again.',
            );
    });
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      width: widget.width,
      height: widget.height,
      color: KandiColors.page,
      child: Scaffold(
        backgroundColor: KandiColors.page,
        appBar: kandiAppBar(context, 'Write a review'),
        body: ListView(
          padding: const EdgeInsets.all(KandiSpace.gutter),
          children: [
            if (_productName.isNotEmpty)
              KandiCard(
                padding: const EdgeInsets.all(KandiSpace.md),
                child: Row(
                  children: [
                    KandiImage(
                        url: _productImage, width: 52, height: 52),
                    const SizedBox(width: KandiSpace.md),
                    Expanded(
                      child: Text(
                        _productName,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: KandiType.label(),
                      ),
                    ),
                  ],
                ),
              ),
            const SizedBox(height: KandiSpace.md),
            KandiCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('How was it?', style: KandiType.heading()),
                  const SizedBox(height: KandiSpace.md),
                  Row(
                    children: [
                      for (var i = 1; i <= 5; i++)
                        GestureDetector(
                          onTap: () => setState(() => _rating = i),
                          child: Padding(
                            padding: const EdgeInsets.only(right: KandiSpace.sm),
                            child: Icon(
                              i <= _rating
                                  ? Icons.star_rounded
                                  : Icons.star_outline_rounded,
                              size: 36,
                              color: i <= _rating
                                  ? KandiColors.deal
                                  : KandiColors.line,
                            ),
                          ),
                        ),
                      const SizedBox(width: KandiSpace.sm),
                      if (_rating > 0)
                        Text(
                          switch (_rating) {
                            1 => 'Poor',
                            2 => 'Not great',
                            3 => 'Fine',
                            4 => 'Good',
                            _ => 'Excellent',
                          },
                          style: KandiType.label(color: KandiColors.body),
                        ),
                    ],
                  ),
                  const SizedBox(height: KandiSpace.lg),
                  TextField(
                    controller: _body,
                    maxLines: 5,
                    style: KandiType.bodyText(color: KandiColors.ink),
                    decoration: InputDecoration(
                      hintText:
                          'What was good, what was not, how was the fit…',
                      hintStyle: KandiType.label(color: KandiColors.faint),
                      filled: true,
                      fillColor: KandiColors.hairline,
                      contentPadding: const EdgeInsets.all(KandiSpace.md),
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
                        borderSide:
                            BorderSide(color: KandiColors.primary, width: 1.5),
                      ),
                    ),
                  ),
                ],
              ),
            ),
            if (_error != null) ...[
              const SizedBox(height: KandiSpace.md),
              Text(_error!, style: KandiType.label(color: KandiColors.sale)),
            ],
            const SizedBox(height: KandiSpace.lg),
            KandiButton(
              label: 'Post review',
              busy: _sending,
              onPressed: _sending ? null : _send,
            ),
            const SizedBox(height: KandiSpace.md),
            Text(
              // Says what happens next. A review that vanishes into moderation
              // with no warning reads as a review that failed to post, and the
              // shopper writes it again.
              'Reviews are checked before they appear on the shop.',
              textAlign: TextAlign.center,
              style: KandiType.caption(),
            ),
          ],
        ),
      ),
    );
  }
}
