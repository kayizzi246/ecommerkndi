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
import '/custom_code/widgets/kandi_product_screen.dart';
import '/custom_code/widgets/kandi_checkout_screen.dart';

// ============================================================
//  KANDI — CART
//
//  The basket, rebuilt on the design system and on the shared
//  store in `kandi_cart_store.dart`.
//
//  WHAT THIS SCREEN IS RESPONSIBLE FOR
//  -----------------------------------------------------------
//  Showing the lines, editing them, and getting out of the way.
//  It owns no state of its own: `KandiCart` holds the basket and
//  this listens to it, which is why the badge in the masthead
//  and the total down here can never disagree.
//
//  THE TOTAL IS A SUBTOTAL, AND IT SAYS SO
//  -----------------------------------------------------------
//  Delivery is priced at checkout, from the shopper's own
//  address, so this screen cannot know it. It prints "Subtotal"
//  and a line saying delivery comes next rather than a "Total"
//  that is about to change — a number that moves between the
//  cart and the checkout is the single fastest way to lose
//  somebody's trust at the last step.
// ============================================================

/// The basket.
///
/// The free-delivery threshold used to be a parameter, on the reasoning that
/// the home feed already carries it and a second request to learn one number
/// is a request the shopper waits for. Both halves of that are still true —
/// which is why it comes from [KandiShop], the holder the home feed fills in
/// as a side effect of the fetch it was making anyway. Nothing extra goes over
/// the wire, and nobody has to type the number into the builder.
class KandiCartScreen extends StatefulWidget {
  const KandiCartScreen({super.key, this.width, this.height});

  final double? width;
  final double? height;

  @override
  State<KandiCartScreen> createState() => _KandiCartScreenState();
}

class _KandiCartScreenState extends State<KandiCartScreen> {
  bool _ready = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    await KandiCart.load();
    if (mounted) setState(() => _ready = true);

    // The threshold the summary quotes. Usually already in hand from the home
    // feed, in which case this returns without a request.
    await KandiShop.ensure();
    if (mounted) setState(() {});
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      width: widget.width,
      height: widget.height,
      color: KandiColors.page,
      child: Scaffold(
        backgroundColor: KandiColors.page,
        appBar: kandiAppBar(context, 'Your cart'),
        // Listening to the store rather than holding a copy. Every edit below
        // writes to `KandiCart` and this rebuilds from it, so there is exactly
        // one version of the basket in the app at any moment.
        body: ValueListenableBuilder<int>(
          valueListenable: KandiCart.revision,
          builder: (context, _, __) {
            if (!_ready) return _skeleton();
            if (KandiCart.isEmpty) return _empty();
            return _lines();
          },
        ),
        bottomNavigationBar: ValueListenableBuilder<int>(
          valueListenable: KandiCart.revision,
          builder: (context, _, __) {
            if (!_ready || KandiCart.isEmpty) return const SizedBox.shrink();
            return _summary();
          },
        ),
      ),
    );
  }

  Widget _lines() {
    final lines = KandiCart.lines;

    return ListView.separated(
      padding: const EdgeInsets.all(KandiSpace.gutter),
      itemCount: lines.length,
      separatorBuilder: (_, __) => const SizedBox(height: KandiSpace.sm),
      itemBuilder: (context, index) => _line(lines[index]),
    );
  }

  Widget _line(KandiCartLine line) {
    return Dismissible(
      key: ValueKey(line.key),
      direction: DismissDirection.endToStart,
      background: Container(
        alignment: Alignment.centerRight,
        padding: const EdgeInsets.only(right: KandiSpace.xl),
        decoration: BoxDecoration(
          color: KandiColors.saleSoft,
          borderRadius: KandiRadius.md,
        ),
        child: const Icon(Icons.delete_outline_rounded,
            color: KandiColors.sale, size: 22),
      ),
      onDismissed: (_) => _remove(line),
      child: KandiCard(
        padding: const EdgeInsets.all(KandiSpace.md),
        onTap: () => KandiNav.open(
          context,
          const KandiProductScreen(),
          args: line.productId,
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            KandiImage(url: line.image, width: 76, height: 76),
            const SizedBox(width: KandiSpace.md),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    line.name,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: KandiType.label(),
                  ),
                  if (line.options.isNotEmpty) ...[
                    const SizedBox(height: 2),
                    Text(
                      // "Colour: Blue · Size: 42" — the choices, printed back.
                      // A basket line that hides them is a line a shopper has
                      // to open the product page to verify.
                      line.options.entries
                          .map((e) => '${e.key}: ${e.value}')
                          .join(' · '),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: KandiType.caption(),
                    ),
                  ],
                  const SizedBox(height: KandiSpace.sm),
                  Row(
                    children: [
                      Text(
                        kandiPrice(line.price),
                        style: KandiType.price(size: 15),
                      ),
                      const Spacer(),
                      _stepper(line),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _stepper(KandiCartLine line) {
    return Container(
      decoration: BoxDecoration(
        color: KandiColors.hairline,
        borderRadius: KandiRadius.sm,
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          _step(
            // At one, the minus becomes a bin. Decrementing to zero and having
            // the line vanish is a surprise; a bin icon says what the next tap
            // does before it happens.
            line.quantity > 1 ? Icons.remove_rounded : Icons.delete_outline_rounded,
            () => line.quantity > 1
                ? KandiCart.setQuantity(line.key, line.quantity - 1)
                : _remove(line),
          ),
          SizedBox(
            width: 32,
            child: Text(
              '${line.quantity}',
              textAlign: TextAlign.center,
              style: KandiType.title(),
            ),
          ),
          _step(
            Icons.add_rounded,
            line.quantity >= 20
                ? null
                : () => KandiCart.setQuantity(line.key, line.quantity + 1),
          ),
        ],
      ),
    );
  }

  Widget _step(IconData icon, VoidCallback? onTap) {
    return InkWell(
      onTap: onTap,
      borderRadius: KandiRadius.sm,
      child: SizedBox(
        width: 32,
        height: 32,
        child: Icon(
          icon,
          size: 16,
          color: onTap == null ? KandiColors.faint : KandiColors.ink,
        ),
      ),
    );
  }

  Future<void> _remove(KandiCartLine line) async {
    await KandiCart.remove(line.key);
    if (!mounted) return;

    // Undo rather than a confirmation dialog. A dialog interrupts the ninety
    // per cent of removals that were intended in order to protect the ten that
    // were not; undo costs the intended ones nothing and rescues the rest.
    ScaffoldMessenger.of(context)
      ..clearSnackBars()
      ..showSnackBar(
        SnackBar(
          content: Text(
            'Removed ${line.name}',
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: KandiType.label(color: Colors.white),
          ),
          backgroundColor: KandiColors.band,
          behavior: SnackBarBehavior.floating,
          shape: const RoundedRectangleBorder(borderRadius: KandiRadius.md),
          margin: const EdgeInsets.all(KandiSpace.lg),
          action: SnackBarAction(
            label: 'Undo',
            textColor: KandiColors.deal,
            onPressed: () => KandiCart.add(
              productId: line.productId,
              name: line.name,
              price: line.price,
              image: line.image,
              slug: line.slug,
              variationId: line.variationId,
              options: line.options,
              quantity: line.quantity,
            ),
          ),
        ),
      );
  }

  Widget _summary() {
    final subtotal = KandiCart.subtotal;
    final threshold = KandiShop.freeDeliveryFrom;
    final away = threshold - subtotal;

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
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // The free-delivery nudge, and only when it is both true and
          // reachable. Telling somebody with UGX 12,000 in the basket that
          // they are UGX 138,000 from free delivery is not a nudge, it is a
          // reminder of how far they are from anything.
          if (threshold > 0 && away > 0 && away <= threshold * 0.4) ...[
            Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(
                horizontal: KandiSpace.md,
                vertical: KandiSpace.sm,
              ),
              decoration: BoxDecoration(
                color: KandiColors.primarySoft,
                borderRadius: KandiRadius.sm,
              ),
              child: Text(
                'Add ${kandiPrice(away)} more for free delivery',
                textAlign: TextAlign.center,
                style: KandiType.caption(color: KandiColors.primaryInk)
                    .copyWith(fontWeight: FontWeight.w600),
              ),
            ),
            const SizedBox(height: KandiSpace.md),
          ] else if (threshold > 0 && away <= 0) ...[
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Icon(Icons.check_circle_rounded,
                    size: 15, color: KandiColors.success),
                const SizedBox(width: KandiSpace.xs),
                Text(
                  'Your order qualifies for free delivery',
                  style: KandiType.caption(color: KandiColors.success)
                      .copyWith(fontWeight: FontWeight.w600),
                ),
              ],
            ),
            const SizedBox(height: KandiSpace.md),
          ],

          Row(
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // "Subtotal", not "Total". Delivery is priced at checkout
                  // from the shopper's address, and a number that changes
                  // after this screen is the fastest way to lose trust at the
                  // last step.
                  Text('Subtotal', style: KandiType.caption()),
                  Text(kandiPrice(subtotal), style: KandiType.price(size: 20)),
                  Text(
                    'Delivery calculated at checkout',
                    style: KandiType.micro(weight: FontWeight.w400),
                  ),
                ],
              ),
              const Spacer(),
              SizedBox(
                width: 168,
                child: KandiButton(
                  label: 'Checkout',
                  icon: Icons.lock_outline_rounded,
                  onPressed: () => KandiNav.open(
                    context,
                    const KandiCheckoutScreen(),
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _empty() {
    return KandiEmpty(
      icon: Icons.shopping_bag_outlined,
      title: 'Your cart is empty',
      message: 'Everything you add will be waiting here.',
      actionLabel: 'Start shopping',
      onAction: () => KandiNav.goTab(context, KandiNav.homeTab),
    );
  }

  Widget _skeleton() {
    return ListView.separated(
      padding: const EdgeInsets.all(KandiSpace.gutter),
      itemCount: 3,
      separatorBuilder: (_, __) => const SizedBox(height: KandiSpace.sm),
      itemBuilder: (context, _) => const KandiCard(
        padding: EdgeInsets.all(KandiSpace.md),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            KandiSkeleton(width: 76, height: 76),
            SizedBox(width: KandiSpace.md),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  KandiSkeleton(width: double.infinity, height: 13),
                  SizedBox(height: KandiSpace.sm),
                  KandiSkeleton(width: 120, height: 13),
                  SizedBox(height: KandiSpace.md),
                  KandiSkeleton(width: 90, height: 16),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
