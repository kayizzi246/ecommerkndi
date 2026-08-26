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

// ============================================================
//  KANDI — PRODUCT
//
//  The screen a shopper decides on, rebuilt on the design
//  system. The one it replaces was 4,462 lines — the largest
//  file in the app by a wide margin.
//
//  THE SHAPE OF THE PAGE
//  -----------------------------------------------------------
//  Gallery, then the two lines that matter (name and price),
//  then the choice, then everything that is evidence for the
//  choice. In that order, because that is the order the decision
//  is made in, and a page that puts the delivery terms above the
//  price is answering a question nobody has asked yet.
//
//  THE BUY BAR IS PINNED
//  -----------------------------------------------------------
//  Add to cart sits in a bar at the foot of the screen rather
//  than in the flow of the page. On a phone the description, the
//  reviews and the related products are all longer than a
//  screen, so an inline button is a button the shopper has to
//  scroll BACK to — and the moment they are convinced is the
//  moment it has to be under their thumb.
//
//  WHAT A VARIATION COSTS IF IT IS WRONG
//  -----------------------------------------------------------
//  A variable product cannot be added until every attribute has
//  been chosen, and the bar says which one is missing rather
//  than sitting there disabled. A disabled button with no
//  explanation is the single most common dead end in a shopping
//  app: the shopper cannot tell whether it is broken, whether
//  the item is out of stock, or whether they have missed a step.
// ============================================================

/// One selectable value of an attribute — a size, a colour.
class _Option {
  const _Option({required this.name, this.swatch, this.image});

  final String name;

  /// A hex or a CSS colour word, when the attribute is a colour.
  final String? swatch;

  /// A thumbnail, when the seller uploaded one for this option.
  final String? image;

  static _Option? fromJson(dynamic raw) {
    if (raw is! Map) return null;
    final name = (raw['name'] ?? '').toString().trim();
    if (name.isEmpty) return null;
    return _Option(
      name: name,
      swatch: _text(raw['value']),
      image: _text(raw['image']),
    );
  }

  static String? _text(dynamic v) {
    final s = v?.toString().trim() ?? '';
    return s.isEmpty ? null : s;
  }
}

/// One attribute — "Size", "Colour" — and the values it offers.
class _Attribute {
  const _Attribute({required this.name, required this.options});

  final String name;
  final List<_Option> options;

  bool get isColour {
    final lower = name.toLowerCase();
    return lower == 'color' || lower == 'colour';
  }

  static _Attribute? fromJson(dynamic raw) {
    if (raw is! Map) return null;
    final name = (raw['name'] ?? '').toString().trim();
    final options = (raw['options'] is List)
        ? (raw['options'] as List)
            .map(_Option.fromJson)
            .whereType<_Option>()
            .toList()
        : <_Option>[];
    if (name.isEmpty || options.isEmpty) return null;
    return _Attribute(name: name, options: options);
  }
}

/// One buyable combination of attributes.
class _Variation {
  const _Variation({
    required this.id,
    required this.price,
    required this.attributes,
    required this.inStock,
  });

  final int id;
  final num price;
  final Map<String, String> attributes;
  final bool inStock;

  /// Whether this variation is the one the shopper has selected.
  ///
  /// Matched case-insensitively on both sides. WooCommerce is inconsistent
  /// about the case of attribute keys between the product and its variations —
  /// "Size" on one and "size" on the other is common — and an exact match
  /// silently finds nothing, which presents as "Add to cart does nothing" with
  /// no error anywhere.
  bool matches(Map<String, String> chosen) {
    if (chosen.length != attributes.length) return false;
    for (final entry in attributes.entries) {
      final picked = chosen.entries
          .where((e) => e.key.toLowerCase() == entry.key.toLowerCase())
          .map((e) => e.value)
          .firstOrNull;
      if (picked == null) return false;
      if (picked.toLowerCase() != entry.value.toLowerCase()) return false;
    }
    return true;
  }

  static _Variation? fromJson(dynamic raw) {
    if (raw is! Map) return null;
    final id = raw['id'] is int ? raw['id'] as int : 0;
    if (id == 0) return null;

    final attributes = <String, String>{};
    final rawAttributes = raw['attributes'];
    if (rawAttributes is Map) {
      rawAttributes.forEach((key, value) {
        attributes[key.toString()] = value?.toString() ?? '';
      });
    }

    return _Variation(
      id: id,
      price: raw['price'] is num ? raw['price'] as num : 0,
      attributes: attributes,
      inStock: raw['inStock'] != false,
    );
  }
}

/// One review, as the page prints it.
class _Review {
  const _Review({
    required this.author,
    required this.rating,
    required this.body,
    this.verified = false,
    this.date = '',
  });

  final String author;
  final int rating;
  final String body;
  final bool verified;
  final String date;

  static _Review? fromJson(dynamic raw) {
    if (raw is! Map) return null;
    final body = (raw['body'] ?? '').toString().trim();
    if (body.isEmpty) return null;
    return _Review(
      author: (raw['author'] ?? 'Shopper').toString(),
      rating: raw['rating'] is int ? raw['rating'] as int : 0,
      body: body,
      verified: raw['verified'] == true,
      date: (raw['date'] ?? '').toString(),
    );
  }
}

/// Everything the screen draws.
class _Detail {
  const _Detail({
    required this.product,
    required this.images,
    required this.attributes,
    required this.variations,
    required this.description,
    required this.reviews,
    required this.ratingAverage,
    required this.ratingCount,
    this.sellerName,
    this.sellerSlug,
    this.freeDeliveryFrom = 0,
    this.returnsDays = 0,
  });

  final KandiProduct product;
  final List<String> images;
  final List<_Attribute> attributes;
  final List<_Variation> variations;
  final String description;
  final List<_Review> reviews;
  final double ratingAverage;
  final int ratingCount;
  final String? sellerName;
  final String? sellerSlug;
  final num freeDeliveryFrom;
  final int returnsDays;

  static _Detail? fromJson(dynamic raw) {
    if (raw is! Map) return null;
    final rawProduct = raw['product'];
    final product = KandiProduct.fromJson(rawProduct);
    if (product == null || rawProduct is! Map) return null;

    final rawReviews = raw['reviews'];
    final rawTerms = raw['commerce'] ?? raw['terms'];
    final seller = rawProduct['seller'];

    return _Detail(
      product: product,
      images: (rawProduct['images'] is List)
          ? (rawProduct['images'] as List)
              .map((e) => e.toString())
              .where((e) => e.isNotEmpty)
              .toList()
          // Falls back to the tile shot so the gallery is never empty on a
          // product whose extra photographs failed to serialise.
          : (product.image.isEmpty ? <String>[] : <String>[product.image]),
      attributes: (rawProduct['attributes'] is List)
          ? (rawProduct['attributes'] as List)
              .map(_Attribute.fromJson)
              .whereType<_Attribute>()
              .toList()
          : const [],
      variations: (rawProduct['variations'] is List)
          ? (rawProduct['variations'] as List)
              .map(_Variation.fromJson)
              .whereType<_Variation>()
              .toList()
          : const [],
      // The server sends HTML because a future in-app renderer may want it.
      // Until there is one, the tags come out here — printing raw `<p>` at a
      // shopper is worse than printing nothing.
      description: _plain(
        (rawProduct['description'] ?? rawProduct['shortDescription'] ?? '')
            .toString(),
      ),
      reviews: (rawReviews is Map && rawReviews['latest'] is List)
          ? (rawReviews['latest'] as List)
              .map(_Review.fromJson)
              .whereType<_Review>()
              .toList()
          : const [],
      ratingAverage: (rawReviews is Map && rawReviews['average'] is num)
          ? (rawReviews['average'] as num).toDouble()
          : product.rating,
      ratingCount: (rawReviews is Map && rawReviews['count'] is int)
          ? rawReviews['count'] as int
          : product.ratingCount,
      sellerName: seller is Map ? seller['name']?.toString() : null,
      sellerSlug: seller is Map ? seller['slug']?.toString() : null,
      freeDeliveryFrom: (rawTerms is Map && rawTerms['freeDeliveryFrom'] is num)
          ? rawTerms['freeDeliveryFrom'] as num
          : 0,
      returnsDays: (rawTerms is Map && rawTerms['returnsDays'] is int)
          ? rawTerms['returnsDays'] as int
          : 0,
    );
  }

  /// HTML to something a `Text` can print.
  ///
  /// Block tags become newlines before everything else is stripped, or a
  /// description written as five paragraphs arrives as one run-on sentence.
  /// The named entities are the four WordPress emits constantly; a full entity
  /// table would be a parser, and a parser belongs on the server.
  static String _plain(String html) {
    return html
        .replaceAll(RegExp(r'<br\s*/?>', caseSensitive: false), '\n')
        .replaceAll(RegExp(r'</(p|div|li|h[1-6])>', caseSensitive: false), '\n')
        .replaceAll(RegExp(r'<li[^>]*>', caseSensitive: false), '• ')
        .replaceAll(RegExp(r'<[^>]*>'), '')
        .replaceAll('&nbsp;', ' ')
        .replaceAll('&amp;', '&')
        .replaceAll('&quot;', '"')
        .replaceAll('&#039;', "'")
        .replaceAll(RegExp(r'\n{3,}'), '\n\n')
        .trim();
  }
}

class KandiProductScreen extends StatefulWidget {
  const KandiProductScreen({
    super.key,
    this.width,
    this.height,
    required this.productId,
    this.onAddToCart,
    this.onBuyNow,
    this.onOpenCart,
    this.onOpenSeller,
    this.onShare,
  });

  final double? width;
  final double? height;
  final int productId;

  /// Called with the product and, for a variable product, the chosen
  /// variation id and attribute map. The cart is owned elsewhere; this screen
  /// only decides WHAT is being added.
  final void Function(
    KandiProduct product,
    int? variationId,
    Map<String, String> options,
    int quantity,
  )? onAddToCart;

  final void Function(
    KandiProduct product,
    int? variationId,
    Map<String, String> options,
    int quantity,
  )? onBuyNow;

  final VoidCallback? onOpenCart;
  final void Function(String slug)? onOpenSeller;
  final void Function(String url)? onShare;

  @override
  State<KandiProductScreen> createState() => _KandiProductScreenState();
}

class _KandiProductScreenState extends State<KandiProductScreen> {
  late final String _key = 'product:${widget.productId}';

  late _Detail? _detail = KandiCache.peek<_Detail>(_key);
  bool _failed = false;

  final PageController _gallery = PageController();
  int _photo = 0;
  int _quantity = 1;

  /// Attribute name to chosen value.
  final Map<String, String> _chosen = <String, String>{};

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _gallery.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final detail = await KandiCache.read<_Detail?>(
        _key,
        // Shorter than the home feed's ten minutes. This is the screen a
        // shopper decides on, so its price and its stock line want to be
        // closer to the truth than a merchandising rail does.
        ttl: const Duration(minutes: 3),
        fetch: () async {
          final result =
              await KandiApi.get('/api/app/product/${widget.productId}');
          if (result.status != 200) throw StateError('product');
          return _Detail.fromJson(result.data);
        },
        onRefresh: (fresh) {
          if (mounted && fresh != null) setState(() => _detail = fresh);
        },
      );

      if (!mounted) return;
      setState(() {
        _detail = detail;
        _failed = detail == null;
        _preselect();
      });
    } catch (_) {
      if (!mounted) return;
      setState(() => _failed = _detail == null);
    }
  }

  /// Chooses the only value of any single-value attribute.
  ///
  /// A product that comes in one colour still declares Colour as an attribute,
  /// and asking a shopper to "choose" from a list of one is a step that exists
  /// only because the data has a shape. Multi-value attributes are left
  /// deliberately unset — preselecting a size is how somebody ends up buying
  /// a 38 they never picked.
  void _preselect() {
    final detail = _detail;
    if (detail == null) return;
    for (final attribute in detail.attributes) {
      if (attribute.options.length == 1) {
        _chosen[attribute.name] = attribute.options.first.name;
      }
    }
  }

  /// The variation matching the current selection, if the selection is
  /// complete and that combination exists.
  _Variation? get _variation {
    final detail = _detail;
    if (detail == null || detail.variations.isEmpty) return null;
    if (_chosen.length != detail.attributes.length) return null;
    for (final variation in detail.variations) {
      if (variation.matches(_chosen)) return variation;
    }
    return null;
  }

  /// The first attribute the shopper has not answered.
  ///
  /// Named rather than counted, because "Choose a size" is an instruction and
  /// "Please select all options" is a riddle.
  String? get _missing {
    final detail = _detail;
    if (detail == null) return null;
    for (final attribute in detail.attributes) {
      if (!_chosen.containsKey(attribute.name)) return attribute.name;
    }
    return null;
  }

  @override
  Widget build(BuildContext context) {
    final detail = _detail;

    return Container(
      width: widget.width,
      height: widget.height,
      color: KandiColors.page,
      child: Scaffold(
        backgroundColor: KandiColors.page,
        appBar: kandiAppBar(
          context,
          '',
          actions: [
            if (widget.onShare != null && detail != null)
              IconButton(
                onPressed: () => widget.onShare!(detail.product.url),
                icon: const Icon(Icons.ios_share_rounded,
                    size: 20, color: KandiColors.ink),
              ),
            if (widget.onOpenCart != null)
              IconButton(
                onPressed: widget.onOpenCart,
                icon: const Icon(Icons.shopping_bag_outlined,
                    size: 21, color: KandiColors.ink),
              ),
          ],
        ),
        body: detail == null
            ? (_failed ? _offline() : _skeleton())
            : _content(detail),
        bottomNavigationBar: detail == null ? null : _buyBar(detail),
      ),
    );
  }

  // ============================================================
  //  THE PAGE
  // ============================================================

  Widget _content(_Detail detail) {
    return ListView(
      padding: EdgeInsets.zero,
      children: [
        _galleryBlock(detail),
        const SizedBox(height: KandiSpace.sm),
        _headline(detail),
        if (detail.attributes.isNotEmpty) _choices(detail),
        _quantityRow(),
        _terms(detail),
        if (detail.sellerName != null) _seller(detail),
        if (detail.description.isNotEmpty) _description(detail),
        if (detail.ratingCount > 0) _reviews(detail),
        // Clears the pinned buy bar. Without it the last card sits under the
        // bar and looks clipped — the classic "the page ends too early" bug.
        const SizedBox(height: KandiSpace.xxl),
      ],
    );
  }

  Widget _galleryBlock(_Detail detail) {
    final width = MediaQuery.of(context).size.width;
    final images = detail.images.isEmpty ? [''] : detail.images;

    return Container(
      color: KandiColors.surface,
      child: Column(
        children: [
          SizedBox(
            height: width,
            child: Stack(
              children: [
                PageView.builder(
                  controller: _gallery,
                  itemCount: images.length,
                  onPageChanged: (index) => setState(() => _photo = index),
                  itemBuilder: (context, index) => KandiImage(
                    url: images[index],
                    width: width,
                    height: width,
                    // Contain, not cover. A product shot is the thing being
                    // sold: cropping a shoe to fill a square is how a listing
                    // loses the toe of the shoe.
                    fit: BoxFit.contain,
                    radius: BorderRadius.zero,
                  ),
                ),
                if (detail.product.discountPercent > 0)
                  Positioned(
                    top: KandiSpace.md,
                    left: KandiSpace.md,
                    child:
                        KandiChip.deal('-${detail.product.discountPercent}%'),
                  ),
              ],
            ),
          ),
          if (images.length > 1) _dots(images.length),
        ],
      ),
    );
  }

  /// Dots rather than a thumbnail strip.
  ///
  /// A strip costs 70px of the first screen to show photographs the shopper
  /// can already reach by swiping. Dots cost 20px and say the same thing: how
  /// many there are and which one this is.
  Widget _dots(int count) {
    return Padding(
      padding: const EdgeInsets.only(bottom: KandiSpace.md),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          for (var i = 0; i < count; i++)
            AnimatedContainer(
              duration: const Duration(milliseconds: 180),
              margin: const EdgeInsets.symmetric(horizontal: 3),
              width: i == _photo ? 18 : 6,
              height: 6,
              decoration: BoxDecoration(
                color: i == _photo ? KandiColors.primary : KandiColors.line,
                borderRadius: KandiRadius.pill,
              ),
            ),
        ],
      ),
    );
  }

  /// Name and price, in that order, directly under the photograph.
  ///
  /// They are one thought — what it is, what it costs — and everything below
  /// is evidence for a decision these two lines have already framed.
  Widget _headline(_Detail detail) {
    final product = detail.product;
    final variation = _variation;

    // A variation can carry its own price. Showing the parent's while a
    // shopper has a large size selected is how an order total surprises
    // somebody at checkout.
    final priceLabel = variation != null && variation.price > 0
        ? kandiPrice(variation.price)
        : product.priceLabel;

    return KandiCard(
      margin: const EdgeInsets.symmetric(horizontal: KandiSpace.gutter),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(product.name, style: KandiType.title().copyWith(height: 1.35)),
          const SizedBox(height: KandiSpace.md),
          Row(
            crossAxisAlignment: CrossAxisAlignment.baseline,
            textBaseline: TextBaseline.alphabetic,
            children: [
              Text(priceLabel, style: KandiType.price(size: 24)),
              if (product.wasPriceLabel != null) ...[
                const SizedBox(width: KandiSpace.sm),
                Text(product.wasPriceLabel!, style: KandiType.wasPrice(size: 14)),
              ],
            ],
          ),
          if (product.savingLabel != null) ...[
            const SizedBox(height: KandiSpace.xs),
            Text(
              'You save ${product.savingLabel!}',
              style: KandiType.caption(color: KandiColors.primaryInk)
                  .copyWith(fontWeight: FontWeight.w700),
            ),
          ],
          if (detail.ratingCount > 0) ...[
            const SizedBox(height: KandiSpace.md),
            _stars(detail),
          ],
          const SizedBox(height: KandiSpace.sm),
          _stockLine(detail),
        ],
      ),
    );
  }

  Widget _stars(_Detail detail) {
    final filled = detail.ratingAverage.round();
    return Row(
      children: [
        for (var i = 0; i < 5; i++)
          Icon(
            i < filled ? Icons.star_rounded : Icons.star_outline_rounded,
            size: 16,
            color: i < filled ? KandiColors.deal : KandiColors.line,
          ),
        const SizedBox(width: KandiSpace.sm),
        Text(
          '${detail.ratingAverage.toStringAsFixed(1)} '
          '(${detail.ratingCount} ${detail.ratingCount == 1 ? "review" : "reviews"})',
          style: KandiType.caption(),
        ),
      ],
    );
  }

  Widget _stockLine(_Detail detail) {
    final variation = _variation;
    final inStock = variation?.inStock ?? detail.product.inStock;
    final left = detail.product.stockQuantity;

    if (!inStock) {
      return Row(
        children: [
          const Icon(Icons.remove_circle_outline,
              size: 15, color: KandiColors.muted),
          const SizedBox(width: KandiSpace.xs),
          Text('Out of stock', style: KandiType.caption()),
        ],
      );
    }

    // "Only 3 left" only when it is TRUE and low. A scarcity line on a product
    // with two hundred in the warehouse is the oldest trick on the internet
    // and shoppers read it as one.
    if (left != null && left > 0 && left <= 5) {
      return Row(
        children: [
          const Icon(Icons.bolt_rounded, size: 15, color: KandiColors.sale),
          const SizedBox(width: KandiSpace.xs),
          Text(
            'Only $left left',
            style: KandiType.caption(color: KandiColors.sale)
                .copyWith(fontWeight: FontWeight.w600),
          ),
        ],
      );
    }

    return Row(
      children: [
        const Icon(Icons.check_circle_outline,
            size: 15, color: KandiColors.success),
        const SizedBox(width: KandiSpace.xs),
        Text('In stock',
            style: KandiType.caption(color: KandiColors.success)),
      ],
    );
  }

  Widget _choices(_Detail detail) {
    return Padding(
      padding: const EdgeInsets.only(top: KandiSpace.md),
      child: KandiCard(
        margin: const EdgeInsets.symmetric(horizontal: KandiSpace.gutter),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            for (final attribute in detail.attributes) ...[
              Row(
                children: [
                  Text(attribute.name, style: KandiType.title()),
                  const SizedBox(width: KandiSpace.sm),
                  if (_chosen[attribute.name] != null)
                    Text(_chosen[attribute.name]!, style: KandiType.caption()),
                ],
              ),
              const SizedBox(height: KandiSpace.md),
              Wrap(
                spacing: KandiSpace.sm,
                runSpacing: KandiSpace.sm,
                children: attribute.options
                    .map((option) => _optionChip(attribute, option))
                    .toList(),
              ),
              if (attribute != detail.attributes.last)
                const Padding(
                  padding: EdgeInsets.symmetric(vertical: KandiSpace.md),
                  child: Divider(height: 1, color: KandiColors.hairline),
                ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _optionChip(_Attribute attribute, _Option option) {
    final selected = _chosen[attribute.name] == option.name;

    return GestureDetector(
      onTap: () => setState(() {
        // Tapping the selected value clears it. Without this a shopper who
        // picks the wrong size has no way back to "nothing chosen", which
        // matters on an attribute they did not mean to answer at all.
        if (selected) {
          _chosen.remove(attribute.name);
        } else {
          _chosen[attribute.name] = option.name;
        }
      }),
      child: Container(
        padding: EdgeInsets.symmetric(
          horizontal: attribute.isColour ? KandiSpace.sm : KandiSpace.md,
          vertical: KandiSpace.sm,
        ),
        decoration: BoxDecoration(
          color: selected ? KandiColors.primarySoft : KandiColors.surface,
          borderRadius: KandiRadius.sm,
          border: Border.all(
            color: selected ? KandiColors.primary : KandiColors.line,
            width: selected ? 1.5 : 1,
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (attribute.isColour && option.swatch != null) ...[
              Container(
                width: 16,
                height: 16,
                decoration: BoxDecoration(
                  color: _colour(option.swatch!),
                  shape: BoxShape.circle,
                  border: Border.all(color: KandiColors.line),
                ),
              ),
              const SizedBox(width: KandiSpace.sm),
            ],
            Text(
              option.name,
              style: KandiType.label(
                color: selected ? KandiColors.primaryInk : KandiColors.body,
              ).copyWith(fontWeight: selected ? FontWeight.w600 : null),
            ),
          ],
        ),
      ),
    );
  }

  /// A swatch value to a colour.
  ///
  /// Sellers type either a hex or a colour word, so both are handled — and a
  /// value that is neither falls back to the page grey rather than throwing.
  /// A malformed swatch should cost one dot, not the screen.
  static Color _colour(String value) {
    final v = value.trim().toLowerCase();
    if (v.startsWith('#')) {
      final hex = v.substring(1);
      final parsed = int.tryParse(hex, radix: 16);
      if (parsed != null && hex.length == 6) return Color(0xFF000000 | parsed);
      if (parsed != null && hex.length == 8) return Color(parsed);
    }
    const words = <String, Color>{
      'black': Color(0xFF111827),
      'white': Color(0xFFFFFFFF),
      'red': Color(0xFFDC2626),
      'blue': Color(0xFF2563EB),
      'green': Color(0xFF16A34A),
      'yellow': Color(0xFFFACC15),
      'orange': Color(0xFFFF6A00),
      'pink': Color(0xFFDB2777),
      'purple': Color(0xFF7C3AED),
      'grey': Color(0xFF9CA3AF),
      'gray': Color(0xFF9CA3AF),
      'brown': Color(0xFF92400E),
      'beige': Color(0xFFE7D8C0),
      'navy': Color(0xFF1E3A8A),
      'silver': Color(0xFFD1D5DB),
      'gold': Color(0xFFD4AF37),
    };
    return words[v] ?? KandiColors.hairline;
  }

  Widget _quantityRow() {
    return Padding(
      padding: const EdgeInsets.only(top: KandiSpace.md),
      child: KandiCard(
        margin: const EdgeInsets.symmetric(horizontal: KandiSpace.gutter),
        padding: const EdgeInsets.symmetric(
          horizontal: KandiSpace.lg,
          vertical: KandiSpace.md,
        ),
        child: Row(
          children: [
            Text('Quantity', style: KandiType.title()),
            const Spacer(),
            _stepper(Icons.remove_rounded, _quantity > 1,
                () => setState(() => _quantity--)),
            SizedBox(
              width: 44,
              child: Text(
                '$_quantity',
                textAlign: TextAlign.center,
                style: KandiType.title(),
              ),
            ),
            // Capped at twenty, matching the ceiling the checkout API enforces
            // per line. A control that lets somebody pick a number the server
            // will refuse is a control that fails at the worst moment.
            _stepper(Icons.add_rounded, _quantity < 20,
                () => setState(() => _quantity++)),
          ],
        ),
      ),
    );
  }

  Widget _stepper(IconData icon, bool enabled, VoidCallback onTap) {
    return Material(
      color: enabled ? KandiColors.hairline : KandiColors.surface,
      borderRadius: KandiRadius.sm,
      child: InkWell(
        onTap: enabled ? onTap : null,
        borderRadius: KandiRadius.sm,
        child: SizedBox(
          width: 34,
          height: 34,
          child: Icon(
            icon,
            size: 18,
            color: enabled ? KandiColors.ink : KandiColors.faint,
          ),
        ),
      ),
    );
  }

  /// Delivery, payment and returns — every figure from the shop's settings.
  ///
  /// None of these is typed here. A returns window hardcoded in an app is a
  /// promise that keeps being made after wp-admin has changed it, and it is
  /// the kind of drift a shopper discovers by being refused.
  Widget _terms(_Detail detail) {
    final rows = <(IconData, String, String?)>[
      (
        Icons.local_shipping_outlined,
        'Delivery',
        detail.freeDeliveryFrom > 0
            ? 'Free over ${kandiPrice(detail.freeDeliveryFrom)} · 1–3 days'
            : 'Countrywide, 1–3 days',
      ),
      (Icons.payments_outlined, 'Payment', 'Cash, MTN MoMo, Airtel or card'),
      if (detail.returnsDays > 0)
        (
          Icons.assignment_return_outlined,
          'Returns',
          '${detail.returnsDays} days, in original condition',
        ),
    ];

    return Padding(
      padding: const EdgeInsets.only(top: KandiSpace.md),
      child: KandiCard(
        margin: const EdgeInsets.symmetric(horizontal: KandiSpace.gutter),
        child: Column(
          children: [
            for (final row in rows) ...[
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Icon(row.$1, size: 18, color: KandiColors.primary),
                  const SizedBox(width: KandiSpace.md),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(row.$2, style: KandiType.label()),
                        if (row.$3 != null)
                          Text(row.$3!, style: KandiType.caption()),
                      ],
                    ),
                  ),
                ],
              ),
              if (row != rows.last)
                const Padding(
                  padding: EdgeInsets.symmetric(vertical: KandiSpace.md),
                  child: Divider(height: 1, color: KandiColors.hairline),
                ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _seller(_Detail detail) {
    return Padding(
      padding: const EdgeInsets.only(top: KandiSpace.md),
      child: KandiCard(
        margin: const EdgeInsets.symmetric(horizontal: KandiSpace.gutter),
        padding: const EdgeInsets.symmetric(
          horizontal: KandiSpace.lg,
          vertical: KandiSpace.md,
        ),
        onTap: detail.sellerSlug == null || widget.onOpenSeller == null
            ? null
            : () => widget.onOpenSeller!(detail.sellerSlug!),
        child: Row(
          children: [
            Container(
              width: 38,
              height: 38,
              decoration: const BoxDecoration(
                color: KandiColors.primarySoft,
                shape: BoxShape.circle,
              ),
              alignment: Alignment.center,
              child: const Icon(Icons.storefront_outlined,
                  size: 18, color: KandiColors.primary),
            ),
            const SizedBox(width: KandiSpace.md),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Sold by', style: KandiType.caption()),
                  Text(
                    detail.sellerName!,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: KandiType.title(),
                  ),
                ],
              ),
            ),
            if (detail.sellerSlug != null && widget.onOpenSeller != null)
              const Icon(Icons.chevron_right_rounded,
                  color: KandiColors.faint),
          ],
        ),
      ),
    );
  }

  Widget _description(_Detail detail) {
    return Padding(
      padding: const EdgeInsets.only(top: KandiSpace.md),
      child: KandiCard(
        margin: const EdgeInsets.symmetric(horizontal: KandiSpace.gutter),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('About this item', style: KandiType.heading()),
            const SizedBox(height: KandiSpace.md),
            // Collapsed to eight lines with no "read more" control, because
            // the alternative on this catalogue is worse: imported supplier
            // descriptions run to spec tables and boilerplate, and a full one
            // pushes the reviews off the screen entirely.
            Text(
              detail.description,
              maxLines: 8,
              overflow: TextOverflow.ellipsis,
              style: KandiType.bodyText(),
            ),
          ],
        ),
      ),
    );
  }

  Widget _reviews(_Detail detail) {
    return Padding(
      padding: const EdgeInsets.only(top: KandiSpace.md),
      child: KandiCard(
        margin: const EdgeInsets.symmetric(horizontal: KandiSpace.gutter),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Text('Reviews', style: KandiType.heading()),
                const SizedBox(width: KandiSpace.sm),
                Text('(${detail.ratingCount})', style: KandiType.caption()),
              ],
            ),
            const SizedBox(height: KandiSpace.md),
            if (detail.reviews.isEmpty)
              Text(
                'No written reviews yet.',
                style: KandiType.bodyText(),
              )
            else
              for (final review in detail.reviews) ...[
                Row(
                  children: [
                    for (var i = 0; i < 5; i++)
                      Icon(
                        i < review.rating
                            ? Icons.star_rounded
                            : Icons.star_outline_rounded,
                        size: 13,
                        color: i < review.rating
                            ? KandiColors.deal
                            : KandiColors.line,
                      ),
                    const SizedBox(width: KandiSpace.sm),
                    Flexible(
                      child: Text(
                        review.author,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: KandiType.caption(color: KandiColors.body)
                            .copyWith(fontWeight: FontWeight.w600),
                      ),
                    ),
                    if (review.verified) ...[
                      const SizedBox(width: KandiSpace.sm),
                      // The one badge on a review worth drawing: it is the
                      // difference between an opinion and an opinion from
                      // somebody who paid.
                      const KandiChip(
                        label: 'Verified',
                        background: KandiColors.successSoft,
                        foreground: KandiColors.success,
                      ),
                    ],
                  ],
                ),
                const SizedBox(height: KandiSpace.xs),
                Text(
                  review.body,
                  maxLines: 4,
                  overflow: TextOverflow.ellipsis,
                  style: KandiType.bodyText(),
                ),
                if (review != detail.reviews.last)
                  const Padding(
                    padding: EdgeInsets.symmetric(vertical: KandiSpace.md),
                    child: Divider(height: 1, color: KandiColors.hairline),
                  ),
              ],
          ],
        ),
      ),
    );
  }

  // ============================================================
  //  THE BUY BAR
  // ============================================================

  Widget _buyBar(_Detail detail) {
    final variation = _variation;
    final needsChoice = detail.attributes.isNotEmpty && variation == null;
    final soldOut = !(variation?.inStock ?? detail.product.inStock);

    // The combination exists in the catalogue but is not stocked. Distinct
    // from "choose a size" and from "out of stock", and the shopper needs to
    // know which of the three they are looking at — the fix for each is
    // different.
    final combinationGone = detail.attributes.isNotEmpty &&
        _missing == null &&
        variation == null;

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
      child: soldOut
          ? KandiButton(
              label: 'Out of stock',
              onPressed: null,
              icon: Icons.remove_shopping_cart_outlined,
            )
          : Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                if (combinationGone) ...[
                  Text(
                    'That combination is not available. Try another.',
                    style: KandiType.caption(color: KandiColors.sale),
                  ),
                  const SizedBox(height: KandiSpace.sm),
                ],
                Row(
                  children: [
                    Expanded(
                      child: KandiButton(
                        label: needsChoice && _missing != null
                            // Names the missing attribute. "Choose a size" is
                            // an instruction; a greyed-out button is a riddle.
                            ? 'Choose ${_missing!.toLowerCase()}'
                            : 'Add to cart',
                        icon: needsChoice
                            ? Icons.tune_rounded
                            : Icons.add_shopping_cart_rounded,
                        tone: KandiButtonTone.outline,
                        onPressed: needsChoice ? null : () => _add(detail),
                      ),
                    ),
                    const SizedBox(width: KandiSpace.sm),
                    Expanded(
                      child: KandiButton(
                        label: 'Buy now',
                        onPressed: needsChoice || widget.onBuyNow == null
                            ? null
                            : () => widget.onBuyNow!(
                                  detail.product,
                                  variation?.id,
                                  Map<String, String>.from(_chosen),
                                  _quantity,
                                ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
    );
  }

  void _add(_Detail detail) {
    widget.onAddToCart?.call(
      detail.product,
      _variation?.id,
      Map<String, String>.from(_chosen),
      _quantity,
    );
    // The cart changed, so anything holding a cart total is now wrong.
    // A screen that mutates data is responsible for saying so.
    KandiCache.invalidate('cart');
    kandiToast(context, 'Added to your cart');
  }

  // ============================================================
  //  THE OTHER TWO STATES
  // ============================================================

  Widget _skeleton() {
    final width = MediaQuery.of(context).size.width;
    return ListView(
      children: [
        KandiSkeleton(width: width, height: width, radius: BorderRadius.zero),
        const SizedBox(height: KandiSpace.lg),
        const Padding(
          padding: EdgeInsets.symmetric(horizontal: KandiSpace.gutter),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              KandiSkeleton(width: double.infinity, height: 16),
              SizedBox(height: KandiSpace.sm),
              KandiSkeleton(width: 200, height: 16),
              SizedBox(height: KandiSpace.lg),
              KandiSkeleton(width: 140, height: 26),
              SizedBox(height: KandiSpace.lg),
              KandiSkeleton(width: double.infinity, height: 90),
            ],
          ),
        ),
      ],
    );
  }

  Widget _offline() {
    return KandiEmpty(
      icon: Icons.wifi_off_rounded,
      title: 'Could not load this product',
      message: 'Check your connection and try again.',
      actionLabel: 'Try again',
      onAction: () {
        KandiCache.invalidate(_key);
        setState(() => _failed = false);
        _load();
      },
    );
  }
}
