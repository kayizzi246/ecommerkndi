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
//  • Custom Widget name:  ProductDetailPage   (must match the class)
//  • Dependencies (Settings ▸ Pubspec):
//        http: ^1.2.0
//        cached_network_image: ^3.3.1
//        google_fonts: ^6.1.0
//        shared_preferences: ^2.2.2
//  • Paste order does not matter. The basket and the saved list
//    are reached through statics on the other widget classes —
//    `ShoppingCartPage.addToCart(...)`,
//    `WishlistPage.toggleSaved(...)` — because FlutterFlow's
//    index.dart exports each custom widget file with
//    `show <WidgetName>`, so the widget class is the only symbol
//    that crosses a file boundary.
//  • Parameters:
//        productId     String   REQUIRED — the slug or numeric id
//        onBackTap     Action   optional
//        onCartTap     Action   optional
//        onProductTap  Action   optional — receives productId, slug
//        onAddToCart   Action   optional — receives id, name, price
//
//    Only `productId` is needed. The other four now have working
//    in-code behaviour behind them: back pops, the cart icon
//    pushes ShoppingCartPage, the related rail pushes this page
//    again, and "Add to cart" writes to KandiCart whether or not
//    an Action is wired. `onAddToCart` fires ALONGSIDE that write
//    rather than instead of it — v2 made it the only thing the
//    button did, so an unwired project showed "Added to cart"
//    over an empty basket.
//
//  THE BUY BAR: PRICE, ADD TO CART, BUY NOW
//  -----------------------------------------------------------
//  The pinned bar carries the price it is charging — on a page
//  this long the buy box has scrolled away, and a button that
//  commits a shopper to a number they can no longer see is the
//  wrong way round. Beside it, two buttons: "Add to cart" for the
//  shopper still browsing, "Buy now" for the one who has decided.
//
//  "Buy now" is the same basket write plus the navigation that
//  shopper was about to do — deliberately NOT a separate express
//  checkout, because a second path to an order is a second place
//  for the delivery quote and the stock check to be got wrong.
//
//    `productId` is a STRING even though WooCommerce ids are
//    numbers, and that is deliberate: the home and category
//    screens pass a slug when they have one, because a slug is
//    what the website's own URLs use. The endpoint accepts either.
//
//  NAVIGATION IS ACTIONS, NOT PAGE NAMES
//  -----------------------------------------------------------
//  Every tap that leaves this screen is an ACTION parameter you
//  wire in FlutterFlow's action editor, not a page name typed as
//  a String.
//
//  That is a deliberate reversal of the earlier approach and it
//  is the better one for three reasons:
//
//    • FlutterFlow does the navigating, so it knows whether a
//      page takes its parameters as path or query. Passing page
//      names meant this file had to guess — it tried query
//      parameters, caught the throw, then tried path parameters —
//      and a page that took neither shape failed silently.
//    • Page names are typed strings with no validation. Rename a
//      page in FlutterFlow and a String parameter still holds the
//      old name; the tap goes dead and nothing says why. An
//      Action is a real reference and moves with the page.
//    • An Action can do more than navigate. "Add to cart" can
//      update App State, show a custom dialog or call an API
//      before it moves, and none of that is expressible as a
//      route name.
//
//  Every Action is optional. Leave one unwired and that control
//  simply does nothing — visible in testing rather than a crash.
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

// No page-name constants. Every destination is an Action parameter — see the
// NAVIGATION note in the header.

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
      // The press tick, on the way down and only for a live control — the same
      // `selectionClick` the other four screens use, so a press feels identical
      // across the app. Silent for a disabled button: a sold-out "Add to cart"
      // that buzzes has told the finger it worked.
      onTapDown: (_) {
        if (widget.onTap != null) HapticFeedback.selectionClick();
        setState(() => _down = true);
      },
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

/// The class name is `ProductDetailPage`, and it must stay that.
///
/// FlutterFlow generates the call site from the Custom Widget's NAME —
/// `custom_widgets.ProductDetailPage(...)` — so the class in this file has to
/// match the name in the FlutterFlow panel exactly. Renaming it here without
/// renaming it there produces:
///
///     Error: Method not found: 'ProductDetailPage'.
///
/// which is a compile failure of the whole web build, not a runtime problem, so
/// it takes the entire app down rather than one screen.
class ProductDetailPage extends StatefulWidget {
  const ProductDetailPage({
    super.key,
    this.width,
    this.height,
    required this.productId,
    this.onBackTap,
    this.onCartTap,
    this.onProductTap,
    this.onAddToCart,
  });

  /// Opens a product page.
  ///
  /// ---- Why this is a static on the widget class ----
  ///
  /// It used to be a top-level `kandiOpenProduct(context, id)` in the cart
  /// file, and every other screen called it. That failed the whole web build:
  ///
  ///     Error: The method 'kandiOpenProduct' isn't defined for the type
  ///     '_HomeSectionsWidgetState'.
  ///
  /// FlutterFlow generates custom_code/widgets/index.dart with one line per
  /// widget — `export 'product_detail_page.dart' show ProductDetailPage;` —
  /// and that `show` clause is exhaustive. The widget class is the only symbol
  /// that crosses a file boundary, so anything the other screens need has to
  /// hang off it.
  ///
  /// Takes the slug when there is one, because that is what the website's own
  /// URLs use; the endpoint accepts either.
  static Future<void> open(BuildContext context, String idOrSlug) {
    if (idOrSlug.isEmpty) return Future<void>.value();
    return Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => ProductDetailPage(productId: idOrSlug),
      ),
    );
  }

  final double? width;
  final double? height;

  /// The slug or the numeric id. Both work — see the header note.
  ///
  /// The one parameter that carries data, and it cannot be avoided: this page
  /// is *about* a product, so something has to say which. Every caller in this
  /// project passes it as a typed Dart argument through `kandiOpenProduct`
  /// rather than through a FlutterFlow panel row.
  final String productId;

  /// ---- These four are optional and mostly unnecessary now ----
  ///
  /// The page no longer needs any of them. Back pops the navigator, the cart
  /// icon pushes `ShoppingCartPage`, the related rail pushes another
  /// `ProductDetailPage`, and "Add to cart" writes to `KandiCart` — all in
  /// code, all in this file's control.
  ///
  /// They stay because a project that wired them should not have them break,
  /// and because `onAddToCart` is a genuine hook: an Action there can log an
  /// event or update something in FlutterFlow *in addition to* the basket
  /// write, which now always happens either way.
  ///
  /// What changed is that a null one is no longer a dead control. Every one of
  /// them has a working in-code default behind it.
  final Future Function()? onBackTap;

  /// Opening the cart. Falls back to pushing `ShoppingCartPage`.
  final Future Function()? onCartTap;

  /// Opening another product from the "You may also like" rail. Falls back to
  /// pushing this page again for that product.
  final Future Function(String productId, String slug)? onProductTap;

  /// Fired *in addition to* the basket write, not instead of it.
  ///
  /// v2 made this the only thing "Add to cart" did, which meant an unwired
  /// project had a button that showed a confirmation and stored nothing. The
  /// line now always goes into `KandiCart` — the basket every screen reads —
  /// and this Action runs alongside for projects that want to hang something
  /// else off the tap.
  final Future Function(int productId, String name, String priceLabel)?
      onAddToCart;

  @override
  State<ProductDetailPage> createState() => _ProductDetailPageState();
}

class _ProductDetailPageState extends State<ProductDetailPage> {
  static const double _pad = 16.0;
  static const double _radius = 10.0;

  final ScrollController _scroll = ScrollController();
  final PageController _gallery = PageController();

  _Detail? _detail;
  bool _loading = true;
  String? _error;

  int _imageIndex = 0;

  /// Whether this product is in the shared saved-items list.
  ///
  /// It was a plain bool toggled in place, which meant the heart here and the
  /// saved-items screen were two different opinions about the same product.
  /// Read from `KandiWishlist` on load now, and written through it on tap.
  bool _wishlisted = false;

  /// Badge on the cart icon, from the shared basket.
  int _cartCount = 0;

  bool _descExpanded = false;

  /// True once the gallery has scrolled past, which is when the compact header
  /// takes over from the floating back button.
  bool _stuck = false;

  /// What the shopper has picked, attribute name → value.
  ///
  /// Empty for a product with nothing to choose, which is most of this
  /// catalogue. Shared between the pickers in the page and the bottom sheet on
  /// purpose: they are two views of ONE decision, so a shopper who chose 42 at
  /// the top of the page is not asked again by the sheet at the bottom of it.
  /// That is the whole reason this lives on the state rather than inside
  /// either widget.
  final Map<String, String> _chosen = <String, String>{};

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

      // The shared stores, read once the product is known — the heart cannot be
      // resolved before there is an id to look up. Through the other widget
      // classes, which are the only symbols that cross a FlutterFlow file
      // boundary.
      final saved = await WishlistPage.savedIds();
      final count = await ShoppingCartPage.loadCount();

      if (!mounted) return;
      setState(() {
        _detail = detail;
        _wishlisted = saved.contains(detail.id);
        _cartCount = count;
        _loading = false;
        // Cleared on every load, including a pull-to-refresh of the SAME
        // product. Attribute values can change under a listing — a seller
        // sells out of 42 and edits the size list — and a selection kept
        // across a reload can be a value that is no longer offered, which then
        // travels all the way to the order.
        _chosen.clear();
        // The one-value attributes choose themselves. "Material: Cotton" is
        // not a decision, it is a fact about the product, and asking somebody
        // to tap the only option before they can buy is a step that exists
        // purely because the data has a list in it. Pre-selecting means it
        // still reaches the order line and wp-admin without ever being a
        // question. `_pickable` below is what decides which ones remain a
        // question.
        for (final attribute in detail.attributes) {
          if (attribute.values.length == 1) {
            _chosen[attribute.name] = attribute.values.first;
          }
        }
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

  /// Runs one of the navigation Actions.
  ///
  /// The whole of this widget's navigation, in four lines. It replaced a
  /// `pushNamed` that had to try query parameters, catch the throw, and then
  /// try path parameters, because a page name gives no way to know which shape
  /// the destination declared. FlutterFlow knows, so FlutterFlow does it.
  ///
  /// A null Action is a control the project chose not to wire, and does
  /// nothing — deliberately silent rather than a crash, and visible the first
  /// time it is tapped in testing.
  void _run(Future Function()? action) {
    if (action == null) return;
    HapticFeedback.lightImpact();
    action();
  }

  /// Opens the basket — the project's Action if it wired one, this app's own
  /// cart screen otherwise.
  void _openCart() {
    HapticFeedback.lightImpact();
    if (widget.onCartTap != null) {
      widget.onCartTap!();
      return;
    }
    Navigator.of(context)
        .push(MaterialPageRoute<void>(builder: (_) => const ShoppingCartPage()))
        .then((_) => _syncStores());
  }

  /// Opens another product from the related rail.
  void _openRelated(_Related r) {
    HapticFeedback.lightImpact();
    final id = r.slug.isNotEmpty ? r.slug : r.id.toString();

    final action = widget.onProductTap;
    if (action != null) {
      action(id, r.slug);
      return;
    }
    ProductDetailPage.open(context, id).then((_) => _syncStores());
  }

  /// Reads the shared basket and saved list, so the header count and the heart
  /// are right on open and right again after coming back from the cart.
  Future<void> _syncStores() async {
    final saved = await WishlistPage.savedIds();
    final count = await ShoppingCartPage.loadCount();
    if (!mounted) return;
    setState(() {
      _wishlisted = saved.contains(_detail?.id ?? 0);
      _cartCount = count;
    });
  }

  /// Puts the line in the basket every screen reads.
  ///
  /// v2 called an Action and stored nothing itself, so an unwired project
  /// showed "Added to cart" over an empty basket. The write happens here now,
  /// and `onAddToCart` runs alongside it rather than instead of it.
  Future<void> _addToCart(
    _Detail d, {
    bool silent = false,
    int quantity = 1,
  }) async {
    HapticFeedback.mediumImpact();

    await ShoppingCartPage.addToCart(
      productId: d.id,
      name: d.name,
      price: ShoppingCartPage.priceFromLabel(d.priceLabel),
      image: d.images.isNotEmpty ? d.images.first : '',
      slug: d.slug,
      quantity: quantity,
      // The size and colour, carried on the line. Without them the basket
      // merges two sizes of one shoe into a single line and the order reaches
      // wp-admin with nothing to pack against — see the note on
      // `ShoppingCartPage.addToCart`, which had been dropping them silently.
      options: _chosen.isEmpty ? null : Map<String, String>.from(_chosen),
    );
    widget.onAddToCart?.call(d.id, d.name, d.priceLabel);

    final count = await ShoppingCartPage.loadCount();
    if (!mounted) return;
    setState(() => _cartCount = count);
    if (silent) return;

    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(
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
            onPressed: _openCart,
          ),
        ),
      );
  }

  /// Add, then go straight to the basket.
  ///
  /// "Buy now" is the same write as "Add to cart" plus the navigation the
  /// shopper was going to do next, and it is deliberately NOT a separate
  /// express checkout: a second path to an order is a second place for the
  /// delivery fee and the stock check to be got wrong. The confirmation
  /// snackbar is suppressed because the basket appearing IS the confirmation.
  Future<void> _buyNow(_Detail d, {int quantity = 1}) async {
    await _addToCart(d, silent: true, quantity: quantity);
    if (!mounted) return;
    _openCart();
  }

  // ============================================================
  // CHOICES — SIZE, COLOUR, AND WHATEVER ELSE THE SELLER SET
  // ============================================================

  /// The attributes that are a QUESTION, as opposed to a fact.
  ///
  /// Two or more values. A one-value attribute is a specification, not a
  /// choice — it is answered for the shopper on load (see `_load`) and stays
  /// in the Details table below, where a fact belongs.
  ///
  /// ---- What these used to be ----
  ///
  /// Nothing but a row in that table: "Size — 40, 42, 43, 44" as a comma
  /// string, three quarters of the way down the page, with no way to act on
  /// it. So the app could not tell the shop which size somebody wanted. The
  /// basket line went out with no options, the order arrived in wp-admin
  /// without a size on it, and the difference between the website and the app
  /// was that the website could take the order and this could not.
  ///
  /// ---- On combinations that do not exist ----
  ///
  /// The website greys out the red one when red is not made in 42, because it
  /// has `product.variations` and can check. `GET /api/app/product/:id` sends
  /// `attributes` only — names and values, flattened — so this screen has no
  /// way to know which pairs are real, and every option here is offered.
  ///
  /// That is a known gap and it is bounded rather than dangerous: the order is
  /// still placed against WooCommerce, which is the thing that actually knows.
  /// Closing it properly means the endpoint sending `variations`; doing it
  /// with a guess would mean hiding combinations that DO exist, which costs
  /// sales rather than preventing mistakes.
  List<_Attribute> _pickable(_Detail d) =>
      d.attributes.where((a) => a.values.length > 1).toList();

  /// The first choice still outstanding, or null when everything is answered.
  _Attribute? _missing(_Detail d) {
    for (final attribute in _pickable(d)) {
      if ((_chosen[attribute.name] ?? '').isEmpty) return attribute;
    }
    return null;
  }

  /// Add to cart, or bring the choices to the thumb first.
  ///
  /// This is the rule the website's `StickyBuyBar` settled on, and it is worth
  /// restating because the two obvious alternatives are both worse.
  ///
  /// SCROLLING BACK UP to the pickers is safe and rude: the shopper pressed a
  /// buy button and was given a scroll, on the screen where they had already
  /// decided. That is where people leave.
  ///
  /// PICKING A DEFAULT for them is worse than rude. The wrong size is a
  /// return, a refund, a courier leg paid twice and, most of the time, the
  /// customer.
  ///
  /// So a product with nothing outstanding goes straight into the bag, and a
  /// product with a size or a colour still unanswered opens the sheet where
  /// the thumb already is. A shopper who chose at the top of the page is not
  /// asked twice, because both views write to the same `_chosen`.
  void _requestPurchase(_Detail d, {required bool buyNow}) {
    if (!d.inStock) return;

    if (_missing(d) != null) {
      _openChoiceSheet(d, buyNow: buyNow);
      return;
    }

    if (buyNow) {
      _buyNow(d);
    } else {
      _addToCart(d);
    }
  }

  /// Saves or unsaves, in the list the whole app shares.
  Future<void> _toggleWishlist(_Detail d) async {
    HapticFeedback.lightImpact();
    final nowSaved = await WishlistPage.toggleSaved(
      productId: d.id,
      name: d.name,
      image: d.images.isNotEmpty ? d.images.first : '',
      price: ShoppingCartPage.priceFromLabel(d.priceLabel),
      slug: d.slug,
    );
    if (!mounted) return;
    setState(() => _wishlisted = nowSaved);
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
    return _screen(
      child: _loading
          ? _skeleton()
          : _error != null
              ? _errorState()
              : _content(_detail!),
    );
  }

  /// ---- The wrapper that killed the yellow underlines ----
  ///
  /// Every word on this screen was rendering with a double yellow underline
  /// under it, on the phone, in production. It is not a style anybody wrote —
  /// it is Flutter's `_kDefaultTextStyle`, the deliberately hideous fallback
  /// used when a `Text` has NO `Material` ancestor above it. Red text, double
  /// yellow underline, on purpose: it is meant to be impossible to miss.
  ///
  /// The reason only the underline showed and not the red is that every string
  /// here goes through `_text`, `_heading`, `_price` or `_label`, and all four
  /// set an explicit colour. `Text` MERGES its style onto the inherited default
  /// rather than replacing it, so the colour was overridden and the
  /// `decoration` — which none of those helpers mention — was inherited
  /// straight through. Hence text in the right font, the right size and the
  /// right colour, with a debug underline under it.
  ///
  /// This screen returned a bare `Container` at its root. A `Container` is not
  /// a `Material`, and in FlutterFlow a custom widget is dropped into a page
  /// whose own tree does not necessarily put one above it, so there was nothing
  /// between these `Text`s and the framework default.
  ///
  /// Two layers, and both earn their place:
  ///
  ///   • `Material` is the real fix. It establishes the ancestor Flutter was
  ///     looking for, and it is also what lets `showModalBottomSheet`,
  ///     `ScaffoldMessenger` and ink effects behave normally on this screen.
  ///
  ///   • `DefaultTextStyle` with an explicit `decoration: TextDecoration.none`
  ///     is the belt to that pair of braces. `Material` alone hands over
  ///     whatever `Theme.of(context).textTheme.bodyMedium` happens to be, which
  ///     in a FlutterFlow project is whatever the project theme says — fine
  ///     today, and not something this file controls. Stating the base style
  ///     outright means the answer cannot change underneath us.
  ///
  /// The same wrapper is on the cart, wishlist, home and category screens,
  /// which all had the identical bare-`Container` root and the identical
  /// underlines. The checkout, search and address screens already returned a
  /// `Scaffold` — which contains a `Material` — which is exactly why those
  /// three were the ones that always looked right.
  Widget _screen({required Widget child}) {
    return Material(
      color: _kPage,
      child: DefaultTextStyle(
        style: _text(size: 14, color: _kInk).copyWith(
          decoration: TextDecoration.none,
        ),
        child: SizedBox(
          width: widget.width ?? double.infinity,
          height: widget.height ?? double.infinity,
          child: child,
        ),
      ),
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
                      // Directly under the price, which is where the website
                      // puts them and where the decision is actually made. A
                      // size list below the description is a size list nobody
                      // reaches before they have already left.
                      if (_pickable(d).isNotEmpty)
                        SliverToBoxAdapter(child: _choicesBlock(d)),
                      SliverToBoxAdapter(child: _termsBlock(d)),
                      if (d.description.isNotEmpty)
                        SliverToBoxAdapter(child: _descriptionBlock(d)),
                      if (_specs(d).isNotEmpty)
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
              // Saves to the shared list rather than to a local bool that the
              // saved-items screen knows nothing about.
              _circle(
                _wishlisted
                    ? Icons.favorite_rounded
                    : Icons.favorite_border_rounded,
                () {
                  final d = _detail;
                  if (d != null) _toggleWishlist(d);
                },
                tint: _wishlisted ? _kSale : _kInk,
              ),
              const SizedBox(width: 8),
              _circle(
                Icons.shopping_bag_outlined,
                _openCart,
                badge: _cartCount,
              ),
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
                _circle(
                  Icons.shopping_bag_outlined,
                  _openCart,
                  badge: _cartCount,
                ),
              ],
            ),
          ),
        ),
      );

  Widget _circle(
    IconData icon,
    VoidCallback onTap, {
    Color tint = _kInk,
    int badge = 0,
  }) =>
      _Press(
        onTap: onTap,
        child: Stack(
          clipBehavior: Clip.none,
          children: [
            Container(
              width: 38,
              height: 38,
              decoration: BoxDecoration(
                color: _kWhite.withOpacity(0.94),
                shape: BoxShape.circle,
                border: Border.all(color: _kLine),
              ),
              child: Icon(icon, size: 18, color: tint),
            ),
            // The live basket count, so adding a line here is visible without
            // leaving the page — the same badge the home and shop screens draw,
            // off the same store.
            if (badge > 0)
              Positioned(
                right: -3,
                top: -3,
                child: Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
                  constraints:
                      const BoxConstraints(minWidth: 17, minHeight: 17),
                  decoration: BoxDecoration(
                    color: _kPrimary,
                    borderRadius: BorderRadius.circular(9),
                    border: Border.all(color: _kPage, width: 1.5),
                  ),
                  child: Text(
                    badge > 99 ? '99+' : '$badge',
                    textAlign: TextAlign.center,
                    style: _label(
                      size: 9.5,
                      color: _kWhite,
                      weight: FontWeight.w800,
                    ),
                  ),
                ),
              ),
          ],
        ),
      );

  /// Leaving the screen.
  ///
  /// Falls back to popping the navigator when no Action is wired, which is the
  /// right default and the one case where a null Action must NOT be a no-op —
  /// a back button that does nothing traps the shopper on the page.
  void _back() {
    HapticFeedback.lightImpact();

    final action = widget.onBackTap;
    if (action != null) {
      action();
      return;
    }

    Navigator.of(context).maybePop();
  }

  // ---------- Choices ----------

  /// One option chip.
  ///
  /// Not a `ChoiceChip`: Material's chip carries its own theme, its own
  /// density and its own selected colour, none of which are this shop's, and
  /// styling one back to the palette is more code than drawing it. This is the
  /// same treatment as the website's option buttons — a hairline at rest, the
  /// brand orange with a tinted ground when chosen — so the two screens agree.
  ///
  /// 40px tall and 12px of side padding is the smallest this can be and still
  /// clear the 44px touch target once the 4px of `Wrap` spacing either side is
  /// counted. Size options are two characters wide; a chip sized to its text
  /// alone would be a 20px target.
  Widget _optionChip({
    required String label,
    required bool selected,
    required VoidCallback onTap,
  }) {
    return _Press(
      onTap: onTap,
      child: Container(
        height: 40,
        padding: const EdgeInsets.symmetric(horizontal: 14),
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: selected ? _kPrimary.withOpacity(0.07) : _kWhite,
          borderRadius: BorderRadius.circular(_radius),
          border: Border.all(
            color: selected ? _kPrimary : _kLine,
            width: selected ? 1.5 : 1,
          ),
        ),
        child: Text(
          label,
          style: _text(
            size: 13.5,
            color: selected ? _kPrimaryInk : _kBody,
            weight: selected ? FontWeight.w700 : FontWeight.w500,
          ),
        ),
      ),
    );
  }

  /// Every outstanding choice, as labelled rows of chips.
  ///
  /// `onPick` rather than writing straight to `_chosen` because the bottom
  /// sheet renders this same widget inside a `StatefulBuilder` and has to
  /// rebuild ITSELF as well as this screen — a sheet whose chips do not
  /// respond until it is closed and reopened reads as broken.
  ///
  /// The chosen value is printed beside the attribute name rather than only
  /// shown by the highlighted chip. On a colour list of eight that runs to
  /// three lines, "Color" alone at the top and a chip highlighted somewhere in
  /// the middle makes a shopper hunt for what they picked; "Color · Dark
  /// Brown" answers it where they are already looking.
  Widget _choiceRows(
    _Detail d, {
    required void Function(String attribute, String value) onPick,
    bool showError = false,
  }) {
    final pickable = _pickable(d);
    if (pickable.isEmpty) return const SizedBox.shrink();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        for (final attribute in pickable) ...[
          Row(
            children: [
              Text(attribute.name, style: _heading(size: 14)),
              if ((_chosen[attribute.name] ?? '').isNotEmpty) ...[
                Text('  ·  ', style: _label(size: 13, color: _kFaint)),
                Flexible(
                  child: Text(
                    _chosen[attribute.name]!,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: _text(size: 13, color: _kBody),
                  ),
                ),
              ] else if (showError) ...[
                const SizedBox(width: 8),
                Text(
                  'Choose one',
                  style: _label(
                    size: 12,
                    color: _kSale,
                    weight: FontWeight.w700,
                  ),
                ),
              ],
            ],
          ),
          const SizedBox(height: 9),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              for (final value in attribute.values)
                _optionChip(
                  label: value,
                  selected: _chosen[attribute.name] == value,
                  onTap: () => onPick(attribute.name, value),
                ),
            ],
          ),
          const SizedBox(height: 16),
        ],
      ],
    );
  }

  /// The pickers where they belong on a product page — under the price, above
  /// the delivery terms, in the flow of the page rather than behind a button.
  ///
  /// The sheet is the SECOND way to reach them, for the shopper who has
  /// scrolled past this to the reviews and decided down there. It is not the
  /// only way, and it should not be: making somebody open a sheet to see what
  /// sizes exist hides the answer to a question they are asking before they
  /// have decided to buy at all.
  Widget _choicesBlock(_Detail d) => Padding(
        padding: const EdgeInsets.fromLTRB(_pad, 6, _pad, 0),
        child: _choiceRows(
          d,
          onPick: (attribute, value) {
            HapticFeedback.selectionClick();
            setState(() => _chosen[attribute] = value);
          },
        ),
      );

  /// The choices, brought down to the thumb.
  ///
  /// Mirrors `components/VariantSheet.tsx`. The product identifies itself at
  /// the top — photograph, price, and what is chosen so far — because a sheet
  /// that slides up over a scrolled page with nothing but chips in it does not
  /// say which product it is about.
  ///
  /// `isScrollControlled` with a 0.85 cap: a product with three attributes and
  /// twelve colours is taller than the default half-screen sheet, and the cap
  /// keeps the page visible behind it so the sheet still reads as temporary.
  ///
  /// The quantity stepper lives here and only here. It is the one control the
  /// page did not have — the buy bar has always added exactly one — and the
  /// sheet is where it costs nothing, because it is already the "confirm what
  /// you are buying" surface.
  Future<void> _openChoiceSheet(_Detail d, {required bool buyNow}) async {
    HapticFeedback.selectionClick();

    var quantity = 1;
    var showError = false;

    await showModalBottomSheet<void>(
      context: context,
      backgroundColor: _kWhite,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(18)),
      ),
      builder: (rootSheetContext) {
        return StatefulBuilder(
          builder: (sheetContext, setSheetState) {
            void pick(String attribute, String value) {
              HapticFeedback.selectionClick();
              // Both, and both are needed: `setState` so the pickers in the
              // page behind agree with the sheet once it closes, and
              // `setSheetState` so the chip under the finger lights up now.
              setState(() => _chosen[attribute] = value);
              setSheetState(() => showError = false);
            }

            return SafeArea(
              top: false,
              child: ConstrainedBox(
                constraints: BoxConstraints(
                  maxHeight: MediaQuery.of(sheetContext).size.height * 0.85,
                ),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    // The drag handle. Not decoration — it is the only
                    // affordance saying this can be pulled away, and without
                    // one the tap-outside is the sole way out.
                    Container(
                      width: 36,
                      height: 4,
                      margin: const EdgeInsets.only(top: 10, bottom: 6),
                      decoration: BoxDecoration(
                        color: _kLine,
                        borderRadius: BorderRadius.circular(2),
                      ),
                    ),
                    Padding(
                      padding: const EdgeInsets.fromLTRB(_pad, 6, _pad, 10),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          ClipRRect(
                            borderRadius: BorderRadius.circular(_radius),
                            child: SizedBox(
                              width: 64,
                              height: 64,
                              child: d.images.isEmpty
                                  ? const ColoredBox(color: _kHairline)
                                  : CachedNetworkImage(
                                      imageUrl: d.images.first,
                                      fit: BoxFit.cover,
                                      placeholder: (_, __) =>
                                          const ColoredBox(color: _kHairline),
                                      errorWidget: (_, __, ___) =>
                                          const ColoredBox(color: _kHairline),
                                    ),
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  d.priceLabel,
                                  style: _price(
                                    size: 20,
                                    color: d.discountPercent > 0
                                        ? _kSale
                                        : _kInk,
                                  ),
                                ),
                                const SizedBox(height: 3),
                                Text(
                                  d.name,
                                  maxLines: 2,
                                  overflow: TextOverflow.ellipsis,
                                  style: _text(size: 12.5, color: _kMuted),
                                ),
                              ],
                            ),
                          ),
                          _Press(
                            onTap: () => Navigator.of(sheetContext).pop(),
                            child: const SizedBox(
                              width: 36,
                              height: 36,
                              child: Icon(Icons.close_rounded,
                                  size: 20, color: _kMuted),
                            ),
                          ),
                        ],
                      ),
                    ),
                    const Divider(height: 1, color: _kHairline),
                    Flexible(
                      child: SingleChildScrollView(
                        padding: const EdgeInsets.fromLTRB(_pad, 16, _pad, 4),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            _choiceRows(d, onPick: pick, showError: showError),
                            Text('Quantity', style: _heading(size: 14)),
                            const SizedBox(height: 9),
                            Row(
                              children: [
                                _stepButton(
                                  Icons.remove_rounded,
                                  enabled: quantity > 1,
                                  onTap: () =>
                                      setSheetState(() => quantity -= 1),
                                ),
                                SizedBox(
                                  width: 54,
                                  child: Text(
                                    '$quantity',
                                    textAlign: TextAlign.center,
                                    style: _heading(size: 16),
                                  ),
                                ),
                                _stepButton(
                                  Icons.add_rounded,
                                  // Capped at what the seller says is on the
                                  // shelf, when they said. A shopper allowed
                                  // to order nine of something with three left
                                  // finds out at the checkout, which is the
                                  // worst place to find out.
                                  enabled: d.stockQuantity == null ||
                                      quantity < d.stockQuantity!,
                                  onTap: () =>
                                      setSheetState(() => quantity += 1),
                                ),
                                if (d.stockQuantity != null &&
                                    d.stockQuantity! <= _kLowStockAt) ...[
                                  const SizedBox(width: 12),
                                  Text(
                                    'Only ${d.stockQuantity} left',
                                    style: _label(
                                      size: 12,
                                      color: _kSale,
                                      weight: FontWeight.w700,
                                    ),
                                  ),
                                ],
                              ],
                            ),
                            const SizedBox(height: 18),
                          ],
                        ),
                      ),
                    ),
                    Padding(
                      padding: const EdgeInsets.fromLTRB(_pad, 8, _pad, 12),
                      child: _Press(
                        onTap: () {
                          final missing = _missing(d);
                          if (missing != null) {
                            // Named, not "please complete your selection". On
                            // a product with a size AND a colour, a generic
                            // message leaves the shopper scanning both lists
                            // for the one they missed.
                            HapticFeedback.heavyImpact();
                            setSheetState(() => showError = true);
                            return;
                          }
                          Navigator.of(sheetContext).pop();
                          if (buyNow) {
                            _buyNow(d, quantity: quantity);
                          } else {
                            _addToCart(d, quantity: quantity);
                          }
                        },
                        child: Container(
                          height: 50,
                          alignment: Alignment.center,
                          decoration: BoxDecoration(
                            color: _kPrimary,
                            borderRadius: BorderRadius.circular(_radius),
                          ),
                          child: Text(
                            buyNow ? 'Buy now' : 'Add to cart',
                            style: _text(
                              size: 15,
                              color: _kWhite,
                              weight: FontWeight.w700,
                            ),
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            );
          },
        );
      },
    );
  }

  /// The − and + of the quantity stepper.
  Widget _stepButton(
    IconData icon, {
    required bool enabled,
    required VoidCallback onTap,
  }) {
    return _Press(
      onTap: enabled ? onTap : null,
      child: Container(
        width: 40,
        height: 40,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(_radius),
          border: Border.all(color: _kLine),
          color: enabled ? _kWhite : _kHairline,
        ),
        child: Icon(icon, size: 18, color: enabled ? _kInk : _kFaint),
      ),
    );
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

  /// The attributes that belong in the Details table — the facts, not the
  /// questions.
  ///
  /// The complement of `_pickable`. Size and colour used to be printed here as
  /// comma strings AND are now chips under the price; leaving them in both
  /// places would have the page state the same list twice, once where it can
  /// be acted on and once where it cannot, which reads as a bug rather than as
  /// thoroughness.
  ///
  /// A single-value attribute stays: "Material — Cotton" is exactly what this
  /// table is for.
  List<_Attribute> _specs(_Detail d) =>
      d.attributes.where((a) => a.values.length <= 1).toList();

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
            for (final a in _specs(d))
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
  /// ---- The price, then two buttons side by side ----
  ///
  /// The bar was a heart and one full-width "Add to cart". Two things were
  /// wrong with that.
  ///
  /// The price had scrolled away. This bar is pinned, so on a long page — the
  /// description, the specs, the reviews, the related rail — the shopper is
  /// looking at a button that commits them to a number they can no longer see.
  /// It now carries the figure it is charging, which is the same thing the
  /// checkout bar in the basket does.
  ///
  /// And "Add to cart" alone serves the shopper who is still browsing while
  /// making the one who has decided take an extra step: add, find the basket,
  /// open it. "Buy now" is that shopper's button. It is deliberately not a
  /// separate express checkout — it is the same basket write plus the
  /// navigation they were about to do, because a second path to an order is a
  /// second place for the delivery quote and the stock check to be got wrong.
  ///
  /// "Add to cart" is the outlined one and "Buy now" the filled one: the filled
  /// button should be the one that ends the journey, and orange twice over
  /// makes neither of them the answer.
  Widget _buyBar(_Detail d) {
    final soldOut = !d.inStock;

    Widget button({
      required String label,
      required IconData icon,
      required bool filled,
      VoidCallback? onTap,
    }) =>
        Expanded(
          child: _Press(
            onTap: onTap,
            child: Container(
              height: 46,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: onTap == null
                    ? _kHairline
                    : filled
                        ? _kPrimary
                        : _kWhite,
                borderRadius: BorderRadius.circular(_radius),
                border: Border.all(
                  color: onTap == null
                      ? _kHairline
                      : filled
                          ? _kPrimary
                          : _kPrimary,
                ),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(
                    icon,
                    size: 17,
                    color: onTap == null
                        ? _kMuted
                        : filled
                            ? _kWhite
                            : _kPrimaryInk,
                  ),
                  const SizedBox(width: 7),
                  Flexible(
                    child: Text(
                      label,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: _text(
                        size: 14.5,
                        color: onTap == null
                            ? _kMuted
                            : filled
                                ? _kWhite
                                : _kPrimaryInk,
                        weight: FontWeight.w700,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        );

    return Container(
      decoration: const BoxDecoration(
        color: _kWhite,
        border: Border(top: BorderSide(color: _kLine)),
      ),
      child: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(_pad, 8, _pad, 8),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              // The price, beside the saving when there is one. The whole
              // reason this row exists is that the buy box has scrolled away.
              Row(
                children: [
                  Text(
                    d.priceLabel,
                    style: _price(
                      size: 19,
                      color: soldOut
                          ? _kMuted
                          : (d.discountPercent > 0 ? _kSale : _kInk),
                    ),
                  ),
                  if (!soldOut && d.wasPriceLabel != null) ...[
                    const SizedBox(width: 7),
                    Text(d.wasPriceLabel!, style: _struck(size: 13)),
                  ],
                  const Spacer(),
                  if (!soldOut && d.savingLabel != null)
                    Text(
                      'You save ${d.savingLabel}',
                      style: _label(
                        size: 12,
                        color: _kSuccess,
                        weight: FontWeight.w700,
                      ),
                    ),
                ],
              ),
              const SizedBox(height: 8),
              Row(
                children: [
                  _Press(
                    onTap: () => _toggleWishlist(d),
                    child: Container(
                      width: 46,
                      height: 46,
                      decoration: BoxDecoration(
                        color: _kWhite,
                        borderRadius: BorderRadius.circular(_radius),
                        border:
                            Border.all(color: _wishlisted ? _kSale : _kLine),
                      ),
                      child: Icon(
                        _wishlisted
                            ? Icons.favorite_rounded
                            : Icons.favorite_border_rounded,
                        size: 20,
                        color: _wishlisted ? _kSale : _kBody,
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  // ---- Both buttons go through `_requestPurchase` now ----
                  //
                  // They used to call `_addToCart` and `_buyNow` directly,
                  // which meant a shoe with four sizes went into the basket
                  // with no size on it — silently, from the bar the shopper is
                  // most likely to use, because it is docked and the pickers
                  // are hundreds of pixels up the page.
                  //
                  // `_requestPurchase` adds straight away when there is
                  // nothing left to answer, and otherwise slides the choices
                  // up to the thumb. The argument for that rule, and against
                  // the two obvious alternatives, is on that method.
                  button(
                    label: soldOut ? 'Out of stock' : 'Add to cart',
                    icon: Icons.shopping_bag_outlined,
                    filled: false,
                    onTap: soldOut
                        ? null
                        : () => _requestPurchase(d, buyNow: false),
                  ),
                  if (!soldOut) ...[
                    const SizedBox(width: 8),
                    button(
                      label: 'Buy now',
                      icon: Icons.bolt_rounded,
                      filled: true,
                      onTap: () => _requestPurchase(d, buyNow: true),
                    ),
                  ],
                ],
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
