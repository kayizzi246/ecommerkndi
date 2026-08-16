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
import 'dart:ui' as ui;

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:http/http.dart' as http;

// ============================================================
//  KANDI — PRODUCT DETAIL  (v3)
//
//  Third sibling of home_sections_widget.dart and
//  category_navigation_menu.dart. Same brand, same type, same
//  API, same conventions. Nothing is shared between the three
//  files because FlutterFlow gives custom widgets no common
//  library to import from — each is a standalone paste.
//
//  WHAT CHANGED FROM v2 (GOLDLINE), AND WHY
//  -----------------------------------------------------------
//  1. IT READS THE SAME SHOP AS EVERYTHING ELSE. v2 queried
//     Supabase directly:
//
//         Supabase.instance.client.from('products')
//           .select().eq('id', widget.productId).single()
//
//     against a `products` table filled by a sync plugin. Every
//     other screen in this app, and the entire website, reads
//     WooCommerce.
//
//     Two databases cannot show one catalogue, and the failure is
//     not subtle: the ids do not refer to the same rows. Tapping a
//     product on the home screen passed a WooCommerce id into a
//     Supabase lookup, which found either nothing — "Failed to
//     load product" — or, worse, a completely different product
//     that happened to share the number.
//
//     This version reads ONE endpoint on the website:
//
//         GET {_kApiBaseUrl}/api/app/product/{slug or id}
//
//     which serves the product through the same `toAppProduct`
//     the home and category screens are already parsing. A price
//     edited in wp-admin reaches this page on its next open.
//
//  2. THE WISHLIST AND CART TABLES ARE GONE. v2 wrote to Supabase
//     `wishlist` rows and a SharedPreferences cart. Both described
//     a shop this app no longer talks to. The wishlist is
//     session-only here, mirroring the website (whose wishlist is
//     per-device localStorage) and the other two screens; the cart
//     is FlutterFlow's job — see `onAddToCart`.
//
//  3. NO INVENTED FACTS. v2 printed "7-Day Returns" and "Free
//     Shipping" over UGX 100,000 as hardcoded badges. Both are now
//     read from the shop's own settings and arrive with the
//     product, so the page cannot promise a window or a threshold
//     the checkout will not honour.
//
//  4. BRAND AND TYPE. v2 used Poppins headings, a red `_goldDeep`
//     and an ivory page. Matched to the storefront: Inter, white
//     page, orange #ff6a00, red reserved strictly for discounts.
//
//  SETUP  (FlutterFlow)
//  -----------------------------------------------------------
//  • Custom Widget name:  ProductDetailWidget
//  • Dependencies (Settings ▸ Pubspec):
//        http: ^1.2.0
//        cached_network_image: ^3.3.1
//        google_fonts: ^6.1.0
//  • Parameters:
//        productId   String   REQUIRED — the slug or numeric id
//        cartRoute   String   optional
//        searchRoute String   optional
//
//    `productId` is a STRING even though WooCommerce ids are
//    numbers, and that is deliberate: the home and category
//    screens pass a slug when they have one, because a slug is
//    what the website's own URLs use. The endpoint accepts either.
//
//  NOTE ON THE SUPABASE IMPORT ABOVE: FlutterFlow writes that
//  header itself and rewrites it on every save, so it stays.
//  Nothing in this file uses Supabase any more.
// ============================================================

// ============================================================
// CONFIG — keep identical to the other two widgets
// ============================================================

/// The live storefront origin. No trailing slash.
const String _kApiBaseUrl = 'https://kandiug.com';

/// FlutterFlow page names. Empty string disables that tap.
const String _kCartRoute = 'Cart';
const String _kProductRoute = 'ProductDetail';

// ============================================================
// BRAND — matched to app/globals.css
// ============================================================

const Color _kPrimary = Color(0xFFFF6A00);

// `_kPrimarySoft` (#FFF3E8) is not declared here. This page has no selected
// rows or active chips for it to sit behind — the only tinted panels are the
// terms block and the review cards, both of which are neutral grey on purpose
// so the orange stays reserved for the one button that matters.

/// Darkened orange that clears 4.6:1 with white text on it.
const Color _kPrimaryInk = Color(0xFFB34A00);

/// Discounts only. Never a resting price.
const Color _kSale = Color(0xFFE53935);

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

/// At or below this many units the page says how few are left.
/// The same threshold as the website's LOW_STOCK_AT.
const int _kLowStockAt = 5;

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

/// The price. 700 with tabular figures, as everywhere else in the shop.
TextStyle _price({double size = 26, Color color = _kInk}) => GoogleFonts.inter(
      fontSize: size,
      fontWeight: FontWeight.w700,
      color: color,
      height: 1.1,
      letterSpacing: size * -0.008,
      fontFeatures: const [ui.FontFeature.tabularFigures()],
    );

TextStyle _struck({double size = 15}) => GoogleFonts.inter(
      fontSize: size,
      fontWeight: FontWeight.w400,
      color: _kFaint,
      decoration: TextDecoration.lineThrough,
      decorationColor: _kFaint,
      fontFeatures: const [ui.FontFeature.tabularFigures()],
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

// ============================================================
// MODELS — mirror app/api/app/product/[id]/route.ts
// ============================================================

/// Read defensively throughout: a thrown exception in `fromJson` would take the
/// whole page down over one malformed field, and a page with a gap in it is
/// better than a red error box.
int _toInt(dynamic v) {
  if (v is num) return v.toInt();
  if (v is String) return int.tryParse(v) ?? 0;
  return 0;
}

double _toDouble(dynamic v) {
  if (v is num) return v.toDouble();
  if (v is String) return double.tryParse(v) ?? 0;
  return 0;
}

List<String> _toStrings(dynamic raw) {
  if (raw is! List) return const [];
  return raw
      .map((e) => (e ?? '').toString())
      .where((s) => s.isNotEmpty)
      .toList();
}

/// A related product, in the same flattened shape the other screens parse.
class _Related {
  final int id;
  final String name;
  final String slug;
  final String image;
  final String priceLabel;
  final String? wasPriceLabel;
  final int discountPercent;

  const _Related({
    required this.id,
    required this.name,
    required this.slug,
    required this.image,
    required this.priceLabel,
    required this.wasPriceLabel,
    required this.discountPercent,
  });

  factory _Related.fromJson(Map<String, dynamic> j) => _Related(
        id: _toInt(j['id']),
        name: (j['name'] ?? '').toString(),
        slug: (j['slug'] ?? '').toString(),
        image: (j['image'] ?? '').toString(),
        priceLabel: (j['priceLabel'] ?? '').toString(),
        wasPriceLabel: j['wasPriceLabel']?.toString(),
        discountPercent: _toInt(j['discountPercent']),
      );
}

class _Attribute {
  final String name;
  final List<String> values;
  const _Attribute({required this.name, required this.values});

  factory _Attribute.fromJson(Map<String, dynamic> j) => _Attribute(
        name: (j['name'] ?? '').toString(),
        values: _toStrings(j['values']),
      );
}

class _Review {
  final String author;
  final int rating;
  final String body;
  final bool verified;

  const _Review({
    required this.author,
    required this.rating,
    required this.body,
    required this.verified,
  });

  factory _Review.fromJson(Map<String, dynamic> j) => _Review(
        author: (j['author'] ?? '').toString(),
        rating: _toInt(j['rating']),
        body: (j['body'] ?? '').toString(),
        verified: j['verified'] == true,
      );
}

/// Everything the page needs, from one request.
class _Detail {
  final int id;
  final String name;
  final String slug;
  final String url;
  final List<String> images;
  final String priceLabel;
  final String? wasPriceLabel;
  final String? savingLabel;
  final int discountPercent;
  final bool inStock;
  final int? stockQuantity;
  final double rating;
  final int ratingCount;
  final int totalSales;
  final String? categoryName;
  final String? sellerName;
  final String description;
  final List<_Attribute> attributes;

  final List<_Review> reviews;
  final List<_Related> related;

  /// From the shop's own settings, so the page cannot promise terms the
  /// checkout will not honour.
  final int returnsDays;
  final double freeDeliveryFrom;

  const _Detail({
    required this.id,
    required this.name,
    required this.slug,
    required this.url,
    required this.images,
    required this.priceLabel,
    required this.wasPriceLabel,
    required this.savingLabel,
    required this.discountPercent,
    required this.inStock,
    required this.stockQuantity,
    required this.rating,
    required this.ratingCount,
    required this.totalSales,
    required this.categoryName,
    required this.sellerName,
    required this.description,
    required this.attributes,
    required this.reviews,
    required this.related,
    required this.returnsDays,
    required this.freeDeliveryFrom,
  });

  factory _Detail.fromJson(Map<String, dynamic> json) {
    final p = Map<String, dynamic>.from((json['product'] as Map?) ?? const {});
    final r = Map<String, dynamic>.from((json['reviews'] as Map?) ?? const {});
    final c = Map<String, dynamic>.from((json['commerce'] as Map?) ?? const {});

    List<T> list<T>(dynamic raw, T Function(Map<String, dynamic>) make) {
      if (raw is! List) return const [];
      return raw
          .whereType<Map>()
          .map((e) => make(Map<String, dynamic>.from(e)))
          .toList();
    }

    // `images` is the full set from the detail endpoint; `image` is the single
    // tile shot. Falling back to the latter means a product whose gallery
    // failed to serialise still shows its main photograph rather than a blank
    // frame.
    final images = _toStrings(p['images']);

    return _Detail(
      id: _toInt(p['id']),
      name: (p['name'] ?? '').toString(),
      slug: (p['slug'] ?? '').toString(),
      url: (p['url'] ?? '').toString(),
      images: images.isNotEmpty
          ? images
          : _toStrings([p['image']]),
      priceLabel: (p['priceLabel'] ?? '').toString(),
      wasPriceLabel: p['wasPriceLabel']?.toString(),
      savingLabel: p['savingLabel']?.toString(),
      discountPercent: _toInt(p['discountPercent']),
      inStock: p['inStock'] != false,
      stockQuantity:
          p['stockQuantity'] == null ? null : _toInt(p['stockQuantity']),
      rating: _toDouble(p['rating']),
      ratingCount: _toInt(p['ratingCount']),
      totalSales: _toInt(p['totalSales']),
      categoryName: p['categoryName']?.toString(),
      sellerName: (p['seller'] is Map)
          ? (p['seller']['name'] ?? '').toString()
          : p['sellerName']?.toString(),
      // Stripped here as well as on the server: a description pasted straight
      // from a supplier can carry markup the server's own strip missed, and a
      // page printing raw tags reads as broken.
      description: (p['description'] ?? '')
          .toString()
          .replaceAll(RegExp(r'<[^>]*>'), ' ')
          .replaceAll(RegExp(r'&nbsp;'), ' ')
          .replaceAll(RegExp(r'\s+'), ' ')
          .trim(),
      attributes: list(p['attributes'], _Attribute.fromJson),
      reviews: list(r['latest'], _Review.fromJson),
      related: list(json['related'], _Related.fromJson),
      returnsDays: _toInt(c['returnsDays']),
      freeDeliveryFrom: _toDouble(c['freeDeliveryFrom']),
    );
  }
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
      onTapDown: (_) => setState(() => _down = true),
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

class ProductDetailWidget extends StatefulWidget {
  const ProductDetailWidget({
    super.key,
    this.width,
    this.height,
    required this.productId,
    this.cartRoute,
    this.onAddToCart,
  });

  final double? width;
  final double? height;

  /// The slug or the numeric id. Both work — see the header note.
  final String productId;

  /// Where the cart icon goes. Falls back to the constant above.
  final String? cartRoute;

  /// Called when "Add to cart" is tapped.
  ///
  /// An Action rather than a cart implementation, because this widget has no
  /// business owning one: the cart is state the whole app shares, and
  /// FlutterFlow already has somewhere to keep it. v2 wrote to
  /// SharedPreferences from inside the page, which meant the count in the
  /// header could disagree with every other screen.
  ///
  /// Wire it in FlutterFlow to "Add to cart" / an App State update. Unset, the
  /// button still gives its confirmation but nothing is stored — which is
  /// visible in testing rather than silent.
  final Future Function(int productId, String name, String priceLabel)?
      onAddToCart;

  @override
  State<ProductDetailWidget> createState() => _ProductDetailWidgetState();
}

class _ProductDetailWidgetState extends State<ProductDetailWidget> {
  static const double _pad = 16.0;
  static const double _radius = 10.0;

  final ScrollController _scroll = ScrollController();
  final PageController _gallery = PageController();

  _Detail? _detail;
  bool _loading = true;
  String? _error;

  int _imageIndex = 0;
  bool _wishlisted = false;
  bool _descExpanded = false;

  /// True once the gallery has scrolled past, which is when the compact header
  /// takes over from the floating back button.
  bool _stuck = false;

  @override
  void initState() {
    super.initState();
    _scroll.addListener(_onScroll);
    _load();
  }

  @override
  void dispose() {
    _scroll.removeListener(_onScroll);
    _scroll.dispose();
    _gallery.dispose();
    super.dispose();
  }

  void _onScroll() {
    // The gallery is square, so its height is the screen width.
    final threshold = MediaQuery.of(context).size.width - 70;
    final stuck = _scroll.offset > threshold;
    if (stuck != _stuck) setState(() => _stuck = stuck);
  }

  String get _base => _kApiBaseUrl.replaceAll(RegExp(r'/+$'), '');

  Future<void> _load() async {
    if (!mounted) return;
    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final response = await http.get(
        Uri.parse(
          '$_base/api/app/product/${Uri.encodeComponent(widget.productId)}',
        ),
        headers: const {'Accept': 'application/json'},
      ).timeout(const Duration(seconds: 20));

      if (response.statusCode == 404) {
        throw const FormatException('That product is no longer available.');
      }
      if (response.statusCode != 200) {
        throw FormatException('Server returned ${response.statusCode}');
      }

      final decoded = jsonDecode(utf8.decode(response.bodyBytes));
      if (decoded is! Map) throw const FormatException('Unexpected payload');

      final detail = _Detail.fromJson(Map<String, dynamic>.from(decoded));
      if (!mounted) return;
      setState(() {
        _detail = detail;
        _loading = false;
      });
    } catch (e) {
      debugPrint('Kandi product load failed: $e');
      if (!mounted) return;
      setState(() {
        _loading = false;
        // Deliberately not the raw exception: a shopper cannot act on
        // "SocketException: Failed host lookup".
        _error = e is FormatException && e.message.contains('available')
            ? e.message
            : 'Could not reach the shop. Check your connection.';
      });
    }
  }

  void _go(String routeName, {Map<String, String> params = const {}}) {
    if (routeName.isEmpty) return;
    HapticFeedback.lightImpact();

    // Query first, then path — FlutterFlow declares page parameters either way
    // and `pushNamed` throws on the wrong kind. Same guard as the other two
    // widgets; see the note there.
    try {
      context.pushNamed(routeName, queryParameters: params);
      return;
    } catch (_) {}

    try {
      context.pushNamed(routeName, pathParameters: params);
    } catch (e) {
      debugPrint('Kandi: could not open page "$routeName" ($e)');
    }
  }

  String get _cartRoute =>
      (widget.cartRoute != null && widget.cartRoute!.trim().isNotEmpty)
          ? widget.cartRoute!.trim()
          : _kCartRoute;

  /// Opens another product on this same screen.
  ///
  /// `pushNamed` onto the same route rather than replacing it, so the back
  /// button walks a shopper back through the products they looked at — which is
  /// how they expect to return to the one they were comparing against.
  void _openRelated(_Related r) => _go(
        _kProductRoute,
        params: {
          'productId': r.slug.isNotEmpty ? r.slug : r.id.toString(),
          'slug': r.slug,
        },
      );

  void _addToCart(_Detail d) {
    HapticFeedback.mediumImpact();
    widget.onAddToCart?.call(d.id, d.name, d.priceLabel);

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          'Added to cart',
          style: _text(size: 13.5, color: _kWhite, weight: FontWeight.w600),
        ),
        backgroundColor: _kInk,
        behavior: SnackBarBehavior.floating,
        duration: const Duration(seconds: 2),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(_radius),
        ),
        action: SnackBarAction(
          label: 'View cart',
          textColor: _kPrimary,
          onPressed: () => _go(_cartRoute),
        ),
      ),
    );
  }

  /// Five dark stars, filled to the rating — the website's treatment.
  Widget _stars(double rating, {double size = 14}) {
    final filled = rating.round();
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: List.generate(
        5,
        (i) => Icon(
          Icons.star_rounded,
          size: size,
          color: i < filled ? _kInk : _kLine,
        ),
      ),
    );
  }

  String _compactSold(int value) {
    if (value >= 1000000) return '${(value / 1000000).toStringAsFixed(1)}M';
    if (value >= 1000) return '${(value / 1000).toStringAsFixed(1)}K';
    return '$value';
  }

  // ============================================================
  // BUILD
  // ============================================================
  @override
  Widget build(BuildContext context) {
    return Container(
      width: widget.width ?? double.infinity,
      height: widget.height ?? double.infinity,
      color: _kPage,
      child: _loading
          ? _skeleton()
          : _error != null
              ? _errorState()
              : _content(_detail!),
    );
  }

  Widget _content(_Detail d) {
    return Stack(
      children: [
        Positioned.fill(
          child: Column(
            children: [
              Expanded(
                child: RefreshIndicator(
                  onRefresh: _load,
                  color: _kPrimary,
                  backgroundColor: _kWhite,
                  child: CustomScrollView(
                    controller: _scroll,
                    physics: const AlwaysScrollableScrollPhysics(
                      parent: BouncingScrollPhysics(),
                    ),
                    slivers: [
                      SliverToBoxAdapter(child: _galleryBlock(d)),
                      SliverToBoxAdapter(child: _buyBlock(d)),
                      SliverToBoxAdapter(child: _termsBlock(d)),
                      if (d.description.isNotEmpty)
                        SliverToBoxAdapter(child: _descriptionBlock(d)),
                      if (d.attributes.isNotEmpty)
                        SliverToBoxAdapter(child: _specsBlock(d)),
                      if (d.ratingCount > 0)
                        SliverToBoxAdapter(child: _reviewsBlock(d)),
                      if (d.related.isNotEmpty)
                        SliverToBoxAdapter(child: _relatedBlock(d)),
                      const SliverToBoxAdapter(child: SizedBox(height: 24)),
                    ],
                  ),
                ),
              ),
              _buyBar(d),
            ],
          ),
        ),

        // The floating controls over the photograph, and the compact header
        // that replaces them once it has scrolled away. Only one is ever on
        // screen, so the back button is never lost.
        if (_stuck) _compactHeader(d) else _floatingControls(),
      ],
    );
  }

  // ---------- Gallery ----------

  Widget _galleryBlock(_Detail d) {
    final width = MediaQuery.of(context).size.width;
    final images = d.images;

    return SizedBox(
      height: width,
      child: Stack(
        children: [
          if (images.isEmpty)
            const ColoredBox(
              color: _kHairline,
              child: Center(
                child: Icon(Icons.image_not_supported_outlined,
                    size: 40, color: _kFaint),
              ),
            )
          else
            PageView.builder(
              controller: _gallery,
              itemCount: images.length,
              onPageChanged: (i) => setState(() => _imageIndex = i),
              itemBuilder: (_, i) => CachedNetworkImage(
                imageUrl: images[i],
                fit: BoxFit.cover,
                // Decoded at roughly the size it is drawn. A 2000px WooCommerce
                // photograph decoded at full resolution is how a mid-range
                // Android runs out of memory.
                memCacheWidth: 1000,
                fadeInDuration: const Duration(milliseconds: 180),
                placeholder: (_, __) => const ColoredBox(color: _kHairline),
                errorWidget: (_, __, ___) => const ColoredBox(
                  color: _kHairline,
                  child: Center(
                    child: Icon(Icons.broken_image_outlined,
                        size: 36, color: _kFaint),
                  ),
                ),
              ),
            ),

          // The discount flag, in sale red and never the brand orange — the
          // same rule the tiles follow.
          if (d.inStock && d.discountPercent > 0)
            Positioned(
              left: 12,
              bottom: 12,
              child: Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
                decoration: BoxDecoration(
                  color: _kSale,
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text(
                  '−${d.discountPercent}%',
                  style: _label(
                      size: 13, color: _kWhite, weight: FontWeight.w700),
                ),
              ),
            ),

          if (images.length > 1)
            Positioned(
              right: 12,
              bottom: 12,
              child: Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
                decoration: BoxDecoration(
                  color: _kInk.withOpacity(0.75),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Text(
                  '${_imageIndex + 1}/${images.length}',
                  style: _label(size: 11.5, color: _kWhite),
                ),
              ),
            ),
        ],
      ),
    );
  }

  Widget _floatingControls() => SafeArea(
        bottom: false,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          child: Row(
            children: [
              _circle(Icons.arrow_back_ios_new_rounded, _back),
              const Spacer(),
              _circle(
                _wishlisted
                    ? Icons.favorite_rounded
                    : Icons.favorite_border_rounded,
                () {
                  HapticFeedback.lightImpact();
                  setState(() => _wishlisted = !_wishlisted);
                },
                tint: _wishlisted ? _kSale : _kInk,
              ),
              const SizedBox(width: 8),
              _circle(Icons.shopping_bag_outlined, () => _go(_cartRoute)),
            ],
          ),
        ),
      );

  Widget _compactHeader(_Detail d) => Container(
        color: _kWhite,
        child: SafeArea(
          bottom: false,
          child: Container(
            height: 54,
            padding: const EdgeInsets.symmetric(horizontal: 12),
            decoration: const BoxDecoration(
              border: Border(bottom: BorderSide(color: _kLine)),
            ),
            child: Row(
              children: [
                _circle(Icons.arrow_back_ios_new_rounded, _back),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    d.name,
                    style: _text(
                        size: 14, color: _kInk, weight: FontWeight.w600),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
                const SizedBox(width: 8),
                _circle(Icons.shopping_bag_outlined, () => _go(_cartRoute)),
              ],
            ),
          ),
        ),
      );

  Widget _circle(IconData icon, VoidCallback onTap, {Color tint = _kInk}) =>
      _Press(
        onTap: onTap,
        child: Container(
          width: 38,
          height: 38,
          decoration: BoxDecoration(
            color: _kWhite.withOpacity(0.94),
            shape: BoxShape.circle,
            border: Border.all(color: _kLine),
          ),
          child: Icon(icon, size: 18, color: tint),
        ),
      );

  void _back() {
    HapticFeedback.lightImpact();
    Navigator.of(context).maybePop();
  }

  // ---------- Buy box ----------

  Widget _buyBlock(_Detail d) {
    final soldOut = !d.inStock;
    final lowStock = !soldOut &&
        d.stockQuantity != null &&
        d.stockQuantity! <= _kLowStockAt;

    return Padding(
      padding: const EdgeInsets.fromLTRB(_pad, 14, _pad, 4),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Sold by, and units sold — the two credentials the website prints
          // above the name. Each disappears when there is nothing behind it.
          if (d.sellerName != null && d.sellerName!.isNotEmpty ||
              d.totalSales > 0) ...[
            Row(
              children: [
                if (d.sellerName != null && d.sellerName!.isNotEmpty)
                  Flexible(
                    child: Text(
                      'Sold by ${d.sellerName}',
                      style: _label(
                          size: 12.5, color: _kBody, weight: FontWeight.w600),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                if ((d.sellerName ?? '').isNotEmpty && d.totalSales > 0)
                  Text('  ·  ', style: _label(size: 12.5)),
                if (d.totalSales > 0)
                  Text(
                    '${_compactSold(d.totalSales)} sold',
                    style: _label(size: 12.5),
                  ),
              ],
            ),
            const SizedBox(height: 6),
          ],

          // The name at the interface weight, not the display one. A supplier's
          // 90-character title set bold is a wall, and the shopper arrived from
          // a photograph and already knows what it is.
          Text(
            d.name,
            style: _text(
                size: 17, color: _kInk, weight: FontWeight.w400, height: 1.35),
          ),

          const SizedBox(height: 10),

          // The money.
          Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                d.priceLabel,
                style: _price(
                  size: 26,
                  color: soldOut
                      ? _kMuted
                      : (d.discountPercent > 0 ? _kSale : _kInk),
                ),
              ),
              if (!soldOut && d.wasPriceLabel != null) ...[
                const SizedBox(width: 8),
                Padding(
                  padding: const EdgeInsets.only(bottom: 2),
                  child: Text(d.wasPriceLabel!, style: _struck(size: 15)),
                ),
              ],
            ],
          ),

          // The saving in money, not just a percentage. "Save 30%" is an
          // abstraction; "You save UGX 55,000" is the number a shopper weighs.
          if (!soldOut && d.savingLabel != null) ...[
            const SizedBox(height: 5),
            Text(
              'You save ${d.savingLabel}',
              style: _label(
                  size: 13.5, color: _kSuccess, weight: FontWeight.w700),
            ),
          ],

          const SizedBox(height: 10),

          // Stock, in descending order of how much it changes what happens next.
          if (soldOut)
            _pill(
              'Out of stock',
              background: _kHairline,
              foreground: _kInk,
              icon: Icons.remove_circle_outline_rounded,
            )
          else if (lowStock)
            _pill(
              'Only ${d.stockQuantity} left',
              background: const Color(0xFFFEF2F2),
              foreground: _kSale,
              icon: Icons.local_fire_department_rounded,
            )
          else
            _pill(
              'In stock',
              background: _kSuccessBg,
              foreground: _kSuccess,
              icon: Icons.check_circle_outline_rounded,
            ),

          if (d.ratingCount > 0) ...[
            const SizedBox(height: 12),
            Row(
              children: [
                _stars(d.rating),
                const SizedBox(width: 6),
                Text(
                  d.rating.toStringAsFixed(1),
                  style: _label(
                      size: 13, color: _kInk, weight: FontWeight.w700),
                ),
                const SizedBox(width: 5),
                Text(
                  '(${d.ratingCount} ${d.ratingCount == 1 ? 'review' : 'reviews'})',
                  style: _label(size: 12.5),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }

  Widget _pill(
    String text, {
    required Color background,
    required Color foreground,
    required IconData icon,
  }) =>
      Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        decoration: BoxDecoration(
          color: background,
          borderRadius: BorderRadius.circular(6),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 14, color: foreground),
            const SizedBox(width: 5),
            Text(
              text,
              style: _label(
                  size: 12.5, color: foreground, weight: FontWeight.w700),
            ),
          ],
        ),
      );

  // ---------- Terms ----------

  /// Delivery, payment and returns, every figure from the shop's settings.
  ///
  /// v2 printed "7-Day Returns" and "Free Shipping over UGX 100,000" as
  /// hardcoded badges. Both were invented — the shop's real returns window and
  /// free-delivery threshold live in wp-admin and can be changed there, and a
  /// page promising something the checkout refuses is the fastest way to lose a
  /// shopper at the last step.
  Widget _termsBlock(_Detail d) {
    final rows = <List<dynamic>>[
      [
        Icons.local_shipping_outlined,
        d.freeDeliveryFrom > 0
            ? 'Free delivery on orders over UGX ${_thousands(d.freeDeliveryFrom)}'
            : 'Delivery across Uganda in 1–3 business days',
      ],
      [Icons.payments_outlined, 'Pay on delivery — cash, MTN MoMo or Airtel'],
      if (d.returnsDays > 0)
        [
          Icons.assignment_return_outlined,
          '${d.returnsDays}-day returns, in original condition',
        ],
    ];

    return Container(
      margin: const EdgeInsets.fromLTRB(_pad, 12, _pad, 4),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: _kSurface,
        borderRadius: BorderRadius.circular(_radius),
      ),
      child: Column(
        children: [
          for (var i = 0; i < rows.length; i++) ...[
            if (i > 0) const SizedBox(height: 9),
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(rows[i][0] as IconData, size: 16, color: _kSuccess),
                const SizedBox(width: 9),
                Expanded(
                  child: Text(
                    rows[i][1] as String,
                    style: _text(size: 13, color: _kBody, height: 1.35),
                  ),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }

  /// UGX thousands separators, matching the server's own formatter.
  ///
  /// Only used for the free-delivery threshold, which arrives as a number
  /// rather than a label — every other figure on this page is formatted
  /// server-side precisely so the two cannot disagree about a separator.
  String _thousands(double value) {
    final digits = value.round().toString();
    final out = StringBuffer();
    for (var i = 0; i < digits.length; i++) {
      if (i > 0 && (digits.length - i) % 3 == 0) out.write(',');
      out.write(digits[i]);
    }
    return out.toString();
  }

  // ---------- Description ----------

  Widget _descriptionBlock(_Detail d) {
    // Collapsed at four lines. Imported supplier descriptions run to spec
    // tables and boilerplate, and at full height they push the reviews and the
    // related products off the screen entirely.
    const collapsed = 4;

    return Padding(
      padding: const EdgeInsets.fromLTRB(_pad, 16, _pad, 4),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Description', style: _heading(size: 17)),
          const SizedBox(height: 8),
          Text(
            d.description,
            style: _text(size: 14, color: _kBody, height: 1.55),
            maxLines: _descExpanded ? null : collapsed,
            overflow: _descExpanded ? null : TextOverflow.ellipsis,
          ),
          // The toggle only appears when there is something to reveal, so a
          // two-line description does not get a "Read more" that does nothing.
          if (d.description.length > 180) ...[
            const SizedBox(height: 6),
            _Press(
              onTap: () => setState(() => _descExpanded = !_descExpanded),
              child: Text(
                _descExpanded ? 'Show less' : 'Read more',
                style: _label(
                    size: 13, color: _kPrimaryInk, weight: FontWeight.w700),
              ),
            ),
          ],
        ],
      ),
    );
  }

  // ---------- Specs ----------

  Widget _specsBlock(_Detail d) => Padding(
        padding: const EdgeInsets.fromLTRB(_pad, 16, _pad, 4),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Details', style: _heading(size: 17)),
            const SizedBox(height: 8),
            // The seller's own WooCommerce attributes, and nothing else. The
            // website's spec table used to add "Care: Machine washable" and
            // "Occasion: Casual" to every listing including chargers and
            // blenders; one obviously invented row makes a shopper doubt the
            // real ones beside it.
            for (final a in d.attributes)
              Container(
                padding: const EdgeInsets.symmetric(vertical: 9),
                decoration: const BoxDecoration(
                  border: Border(bottom: BorderSide(color: _kHairline)),
                ),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    SizedBox(
                      width: 110,
                      child: Text(a.name, style: _label(size: 13)),
                    ),
                    Expanded(
                      child: Text(
                        a.values.join(', '),
                        style: _text(size: 13.5, color: _kBody),
                      ),
                    ),
                  ],
                ),
              ),
          ],
        ),
      );

  // ---------- Reviews ----------

  Widget _reviewsBlock(_Detail d) => Padding(
        padding: const EdgeInsets.fromLTRB(_pad, 16, _pad, 4),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Text('Reviews', style: _heading(size: 17)),
                const SizedBox(width: 8),
                Text('(${d.ratingCount})', style: _label(size: 13)),
              ],
            ),
            const SizedBox(height: 10),
            for (final review in d.reviews)
              Container(
                margin: const EdgeInsets.only(bottom: 10),
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: _kSurface,
                  borderRadius: BorderRadius.circular(_radius),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        _stars(review.rating.toDouble(), size: 12),
                        const SizedBox(width: 7),
                        Flexible(
                          child: Text(
                            review.author,
                            style: _label(
                                size: 12.5,
                                color: _kInk,
                                weight: FontWeight.w700),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                        // Only shown when WooCommerce says the reviewer
                        // actually bought it. A "verified" badge on every
                        // review is worth nothing to the ones that earned it.
                        if (review.verified) ...[
                          const SizedBox(width: 6),
                          const Icon(Icons.verified_rounded,
                              size: 13, color: _kSuccess),
                        ],
                      ],
                    ),
                    if (review.body.isNotEmpty) ...[
                      const SizedBox(height: 6),
                      Text(
                        review.body,
                        style: _text(size: 13.5, color: _kBody, height: 1.5),
                      ),
                    ],
                  ],
                ),
              ),
          ],
        ),
      );

  // ---------- Related ----------

  Widget _relatedBlock(_Detail d) => Padding(
        padding: const EdgeInsets.only(top: 16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: _pad),
              child: Text('You may also like', style: _heading(size: 17)),
            ),
            const SizedBox(height: 10),
            SizedBox(
              // The tile is a square photograph plus a fixed text block, the
              // same arithmetic the home and category grids use.
              height: 140 + 66,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(horizontal: _pad),
                itemCount: d.related.length,
                separatorBuilder: (_, __) => const SizedBox(width: 10),
                itemBuilder: (_, i) {
                  final r = d.related[i];
                  return _Press(
                    onTap: () => _openRelated(r),
                    child: SizedBox(
                      width: 140,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          ClipRRect(
                            borderRadius: BorderRadius.circular(_radius),
                            child: SizedBox(
                              width: 140,
                              height: 140,
                              child: r.image.isEmpty
                                  ? const ColoredBox(color: _kHairline)
                                  : CachedNetworkImage(
                                      imageUrl: r.image,
                                      fit: BoxFit.cover,
                                      memCacheWidth: 400,
                                      placeholder: (_, __) =>
                                          const ColoredBox(color: _kHairline),
                                      errorWidget: (_, __, ___) =>
                                          const ColoredBox(color: _kHairline),
                                    ),
                            ),
                          ),
                          const SizedBox(height: 6),
                          SizedBox(
                            height: 36,
                            child: Text(
                              r.name,
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                              style: _text(
                                size: 12.5,
                                color: _kInk,
                                weight: FontWeight.w400,
                                height: 18 / 12.5,
                              ),
                            ),
                          ),
                          Text(
                            r.priceLabel,
                            style: _price(
                              size: 14,
                              color:
                                  r.discountPercent > 0 ? _kSale : _kInk,
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ],
                      ),
                    ),
                  );
                },
              ),
            ),
          ],
        ),
      );

  // ---------- The buy bar ----------

  /// Pinned to the foot of the screen, never scrolled.
  ///
  /// The one control the whole page exists to deliver a shopper to. v2 put it
  /// at the bottom of a Column outside the scroll view, which is right; this
  /// keeps that and adds the state the button has to be able to express — a
  /// sold-out product must not offer a cart button that works.
  Widget _buyBar(_Detail d) {
    final soldOut = !d.inStock;

    return Container(
      decoration: const BoxDecoration(
        color: _kWhite,
        border: Border(top: BorderSide(color: _kLine)),
      ),
      child: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(_pad, 10, _pad, 10),
          child: Row(
            children: [
              _Press(
                onTap: () {
                  HapticFeedback.lightImpact();
                  setState(() => _wishlisted = !_wishlisted);
                },
                child: Container(
                  width: 48,
                  height: 48,
                  decoration: BoxDecoration(
                    color: _kWhite,
                    borderRadius: BorderRadius.circular(_radius),
                    border: Border.all(
                        color: _wishlisted ? _kSale : _kLine),
                  ),
                  child: Icon(
                    _wishlisted
                        ? Icons.favorite_rounded
                        : Icons.favorite_border_rounded,
                    size: 21,
                    color: _wishlisted ? _kSale : _kBody,
                  ),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _Press(
                  onTap: soldOut ? null : () => _addToCart(d),
                  child: Container(
                    height: 48,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      // Grey rather than orange when there is nothing to buy:
                      // a full-colour primary button on a sold-out product is
                      // an invitation to a dead end.
                      color: soldOut ? _kHairline : _kPrimary,
                      borderRadius: BorderRadius.circular(_radius),
                    ),
                    child: Text(
                      soldOut ? 'Out of stock' : 'Add to cart',
                      style: _text(
                        size: 15,
                        color: soldOut ? _kMuted : _kWhite,
                        weight: FontWeight.w700,
                      ),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  // ---------- Skeleton and error ----------

  Widget _skeleton() {
    final width = MediaQuery.of(context).size.width;

    Widget bar(double w, double h) => Container(
          width: w,
          height: h,
          margin: const EdgeInsets.only(bottom: 10),
          decoration: BoxDecoration(
            color: _kHairline,
            borderRadius: BorderRadius.circular(6),
          ),
        );

    return SingleChildScrollView(
      physics: const NeverScrollableScrollPhysics(),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // The same square as the real gallery, so the page does not jump
          // when the photograph lands.
          Container(width: width, height: width, color: _kHairline),
          Padding(
            padding: const EdgeInsets.all(_pad),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                bar(140, 12),
                bar(width - 60, 18),
                bar(width - 140, 18),
                const SizedBox(height: 6),
                bar(120, 26),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _errorState() => Center(
        child: Padding(
          padding: const EdgeInsets.all(28),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.wifi_off_rounded, size: 40, color: _kFaint),
              const SizedBox(height: 14),
              Text(
                'Cannot open this product',
                style: _heading(size: 17),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 6),
              Text(
                _error ?? '',
                style: _text(size: 13.5, color: _kMuted),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 18),
              _Press(
                onTap: _load,
                child: Container(
                  padding: const EdgeInsets.symmetric(
                      horizontal: 26, vertical: 12),
                  decoration: BoxDecoration(
                    color: _kPrimary,
                    borderRadius: BorderRadius.circular(_radius),
                  ),
                  child: Text(
                    'Try again',
                    style: _text(
                        size: 14, color: _kWhite, weight: FontWeight.w700),
                  ),
                ),
              ),
              const SizedBox(height: 10),
              _Press(
                onTap: _back,
                child: Text(
                  'Go back',
                  style: _label(
                      size: 13, color: _kBody, weight: FontWeight.w600),
                ),
              ),
            ],
          ),
        ),
      );
}
