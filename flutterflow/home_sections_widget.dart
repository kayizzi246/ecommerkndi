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
import 'dart:ui' as ui;

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:http/http.dart' as http;

// ============================================================
//  KANDI — HOME  (v4)
//
//  WHAT CHANGED FROM v3, AND WHY
//  -----------------------------------------------------------
//  1. DATA SOURCE. v3 read Supabase directly: ProductsTable(),
//     ProductsRow, a `products` table. The website reads
//     WooCommerce. Those are two different databases, so the app
//     and the site could never show the same catalogue however
//     carefully each was written.
//
//     This version reads ONE endpoint on the website itself:
//
//         GET {_kApiBaseUrl}/api/app/home
//
//     WooCommerce is now the only source of truth. A price edited
//     in wp-admin reaches the app on its next refresh, with no
//     sync job to fall behind and nothing to reconcile.
//
//  2. THE RAILS ARE NOT HARD-CODED. v3 decided for itself what
//     "deals" and "new arrivals" meant. The server now sends a
//     `rails` array — id, title, subtitle, products — composed by
//     the same code that builds the website's homepage
//     (lib/home-feed.ts). This screen renders whatever it is
//     given, in the order given.
//
//     The consequence worth understanding: reordering the rails
//     on the website reorders them here too, on the next launch,
//     with NO app-store release. Merchandising stops being a
//     thing you have to remember to do twice.
//
//  3. BRAND. v3 was AliExpress red (#FF0033) with Poppins/Inter.
//     The storefront is orange (#ff6a00) with Inter,
//     and reserves red strictly for discounts. Matched here, so
//     the two read as one shop.
//
//  4. PRICES ARE FORMATTED SERVER-SIDE. v3 formatted UGX in Dart.
//     Two implementations of currency formatting is two chances
//     to disagree about a thousands separator, in the one place a
//     shopper will notice. The API sends `priceLabel` already
//     formatted by the site's own formatter.
//
//  5. NO PARAMETERS. Nothing is passed in from FlutterFlow. The
//     shop name, logo, delivery terms, departments and every
//     product all arrive from the API at runtime, so there was
//     never anything for a parameter to usefully say. The only
//     things a human has to choose live in the CONFIG block
//     below, in this file, as plain constants.
//
//     `width` and `height` remain because FlutterFlow generates
//     those two on every custom widget itself and re-adds them if
//     removed — they are its scaffolding, not configuration.
//
//  SETUP  (FlutterFlow)
//  -----------------------------------------------------------
//  • Custom Widget name:  HomeSectionsWidget
//  • Dependencies (Settings ▸ Pubspec):
//        http: ^1.2.0
//        cached_network_image: ^3.3.1
//        google_fonts: ^6.1.0
//  • Parameters to add: NONE. Drop the widget on the page and it
//    works. Edit the CONFIG constants below to point it at your
//    storefront and to name your FlutterFlow pages.
//
//  NOTE ON THE SUPABASE IMPORT ABOVE: FlutterFlow writes that
//  header itself and rewrites it on every save, so it stays.
//  Nothing in this file uses Supabase any more.
//
//  NOTE ON THE WISHLIST: kept in memory for the session, which
//  mirrors the website (its wishlist is per-device localStorage,
//  not a server record). To persist it across launches, lift
//  `_wishlisted` into FFAppState — that is FlutterFlow's job, not
//  a custom widget's.
// ============================================================

// ============================================================
// CONFIG — the only things to edit. Everything else is data.
// ============================================================

/// The live storefront origin. No trailing slash.
///
/// This is the single most important line in the file: it is where the app
/// gets its catalogue, and it must be the same origin the website runs on or
/// the two are not the same shop. A trailing slash is stripped defensively at
/// use, because `https://kandiug.com//api/app/home` 404s in a way that looks
/// like an outage rather than a typo.
const String _kApiBaseUrl = 'https://kandiug.com';

/// Shown only until the API answers, then replaced by the real brand name.
const String _kFallbackShopName = 'Kandi';

/// Names of the FlutterFlow pages to open on tap.
///
/// Set any of these to an empty string to make that tap do nothing. A name
/// that does not match a real page is caught and ignored rather than crashing
/// the screen — see `_go`. That is deliberate: a mistyped route should cost a
/// dead button, not a shopper's whole session.
const String _kProductRoute = 'ProductDetail';
const String _kCategoryRoute = 'CategoryProducts';
const String _kSearchRoute = 'Search';
const String _kCartRoute = 'Cart';
const String _kWishlistRoute = 'Wishlist';
const String _kShopRoute = 'Shop';
const String _kProfileRoute = 'Profile';
// ============================================================

// ============================================================
// BRAND — matched to app/globals.css
// ============================================================

/// Brand orange. Fills, active state, prices at display size.
const Color _kPrimary = Color(0xFFFF6A00);

/// The tint behind an active or selected row.
const Color _kPrimarySoft = Color(0xFFFFF3E8);

/// Darkened orange that clears 4.6:1 with white text on it.
///
/// White on #ff6a00 is 2.9:1 and fails AA, so any *small* label sitting on an
/// orange fill uses this instead. The web has the same token for the same
/// reason — a button caption nobody with low vision can read is not a brand
/// decision, it is a bug.
const Color _kPrimaryInk = Color(0xFFB34A00);

/// Discounts only. Never a resting price.
const Color _kSale = Color(0xFFE53935);

const Color _kInk = Color(0xFF171717); // headings
const Color _kBody = Color(0xFF475569); // paragraph text, subtitles
const Color _kMuted = Color(0xFF64748B); // ratings, sold counts
const Color _kFaint = Color(0xFF94A3B8); // struck-through was-prices
const Color _kLine = Color(0xFFE5E7EB);
const Color _kHairline = Color(0xFFF3F4F6);
const Color _kSurface = Color(0xFFFAFAFA);
const Color _kSearchBg = Color(0xFFF3F4F6);
const Color _kSuccess = Color(0xFF16A34A);
const Color _kWhite = Colors.white;

/// The page is white, like the website. The old build ran on a grey tint,
/// which put every product photo — most of them shot on white — inside a
/// visible grey box.
const Color _kPage = Colors.white;

/// At or below this many units the card says how few are left.
/// The same threshold as the website's LOW_STOCK_AT.
const int _kLowStockAt = 5;

// ============================================================
// CARD METRICS
// ============================================================
//
// The product tile is a square photograph with a text block of FIXED height
// underneath it. Both halves are pinned deliberately, and these constants are
// what let the grid and the rails work out a tile's exact height rather than
// guessing at an aspect ratio:
//
//     tile height = tile width (the square image) + _kCardTextHeight
//
// Every row below is a `SizedBox`, not a `Spacer` — see `_card` for the full
// argument, but in short: a rail stretches every tile to the tallest one, so a
// single product with an extra line of metadata used to add that much dead
// space to the bottom of every other tile in the row.
//
// Change a row height here and the grid, the rails and the skeletons all follow
// together. That is the point of them being constants: they were three separate
// magic numbers that had to be kept in agreement by hand.

/// The tile's corner radius. 10 rather than the app's usual 8, matching the
/// website — big enough to read as a made object on a 150px phone tile, small
/// enough that a large tile does not turn into a lozenge.
const double _kCardRadius = 10;

/// Between the photograph and the first line of text.
const double _kCardGap = 4;

/// Two lines at the website's 20px leading. Fixed rather than fit-to-content so
/// a one-line name still reserves its second line.
const double _kCardNameHeight = 40;

/// The price row.
const double _kCardPriceHeight = 20;

/// The rating row and the delivery row, which are the same height as each other.
const double _kCardMetaHeight = 16;

/// How wide one tile is in a horizontal rail. The rail's own height is derived
/// from it, since the photograph is square.
const double _kRailTileWidth = 152;

/// One logical pixel of slack, so a tile is never a hair shorter than its own
/// content.
///
/// The grid derives its height back out of a ratio — `width / (width + text)`
/// on the way in, multiplied out again by the delegate on the way back — and
/// double arithmetic does not always round-trip to the same number. Landing a
/// fraction of a pixel short costs a Flutter overflow, which is not a subtle
/// failure: it paints a yellow-and-black hazard bar across the bottom of the
/// tile. Landing a fraction long costs nothing anybody can see.
const double _kCardSlack = 1;

/// Everything below the photograph, which is the figure the grid needs.
const double _kCardTextHeight = _kCardGap +
    _kCardNameHeight +
    _kCardPriceHeight +
    _kCardMetaHeight + // rating and units sold
    _kCardMetaHeight + // the delivery promise
    _kCardSlack;

// ============================================================
// TYPE — Inter, one face for everything
// ============================================================
//
// Follows the website, which is set in Inter on the AliExpress scale —
// see the type scale written out at the head of `app/globals.css`. (This
// file has been through Plus Jakarta Sans and a brief run on Inter to get
// here; the face is whatever the storefront's is, and that is the only rule
// that matters.)
//
// Matching the face matters more here than anywhere else in the app. A
// shopper who taps through from the site to the app is looking at the same
// products, the same orange and the same photographs; type is the one
// remaining thing that would tell them they had arrived somewhere else.
//
// `_price` asks for tabular figures, which Inter genuinely ships — so a
// column of prices lines up on the decimal rather than being faked by the
// renderer.

/// Heading face. 800 with the tracking pulled in, as on the web.
///
/// `letterSpacing` is logical pixels in Flutter but em on the web, so the web's
/// -0.018em is converted per size rather than copied as a constant.
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

/// UI/body face. 400–500, spaced for reading.
TextStyle _text({
  double size = 14,
  Color color = _kBody,
  FontWeight weight = FontWeight.w500,
  double? height,
  TextDecoration? decoration,
  Color? decorationColor,
}) =>
    GoogleFonts.inter(
      fontSize: size,
      fontWeight: weight,
      color: color,
      height: height ?? 1.45,
      letterSpacing: size * 0.004,
      decoration: decoration,
      decorationColor: decorationColor,
    );

/// Section subtitle — 600 in the body colour.
///
/// This is the treatment added to the website: at 400 in the muted grey these
/// lines were the faintest text on a page full of photography, so they read as
/// captions the eye skips. They are in fact the line doing the selling.
TextStyle _subtitle({double size = 13.5}) => GoogleFonts.inter(
      fontSize: size,
      fontWeight: FontWeight.w600,
      color: _kBody,
      height: 1.4,
      letterSpacing: size * -0.006,
    );

/// Prices. Bold, barely tightened, tabular so digits line up in a grid.
TextStyle _price({double size = 15, Color color = _kInk}) =>
    GoogleFonts.inter(
      fontSize: size,
      fontWeight: FontWeight.w700,
      color: color,
      height: 1.1,
      letterSpacing: size * -0.008,
      fontFeatures: const [ui.FontFeature.tabularFigures()],
    );

/// The struck-through was-price.
TextStyle _struck({double size = 12}) => GoogleFonts.inter(
      fontSize: size,
      fontWeight: FontWeight.w500,
      color: _kFaint,
      decoration: TextDecoration.lineThrough,
      decorationColor: _kFaint,
      fontFeatures: const [ui.FontFeature.tabularFigures()],
    );

/// Small caps-ish label — badges, counts.
TextStyle _label({
  double size = 11,
  Color color = _kMuted,
  FontWeight weight = FontWeight.w600,
  double spacing = 0.2,
}) =>
    GoogleFonts.inter(
      fontSize: size,
      fontWeight: weight,
      color: color,
      letterSpacing: spacing,
      height: 1.2,
    );

// ============================================================
// MODELS — mirror app/api/app/home/route.ts
// ============================================================

/// A product exactly as the API sends it.
///
/// Every field is read defensively. A storefront whose backend is briefly
/// misconfigured should give the shopper a screen with gaps in it, not a red
/// error box — a thrown exception in a `fromJson` takes down the whole home
/// screen over one bad row.
class _Product {
  final int id;
  final String name;
  final String slug;
  final String url;
  final String image;
  final double price;
  final double? wasPrice;
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
  final bool isNew;

  const _Product({
    required this.id,
    required this.name,
    required this.slug,
    required this.url,
    required this.image,
    required this.price,
    required this.wasPrice,
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
    required this.isNew,
  });

  static double _toDouble(dynamic v) {
    if (v is num) return v.toDouble();
    if (v is String) return double.tryParse(v) ?? 0;
    return 0;
  }

  static int _toInt(dynamic v) {
    if (v is num) return v.toInt();
    if (v is String) return int.tryParse(v) ?? 0;
    return 0;
  }

  factory _Product.fromJson(Map<String, dynamic> j) {
    final was = j['wasPrice'];
    return _Product(
      id: _toInt(j['id']),
      name: (j['name'] ?? '').toString(),
      slug: (j['slug'] ?? '').toString(),
      url: (j['url'] ?? '').toString(),
      image: (j['image'] ?? '').toString(),
      price: _toDouble(j['price']),
      wasPrice: was == null ? null : _toDouble(was),
      priceLabel: (j['priceLabel'] ?? '').toString(),
      wasPriceLabel: j['wasPriceLabel']?.toString(),
      savingLabel: j['savingLabel']?.toString(),
      discountPercent: _toInt(j['discountPercent']),
      inStock: j['inStock'] != false,
      stockQuantity:
          j['stockQuantity'] == null ? null : _toInt(j['stockQuantity']),
      rating: _toDouble(j['rating']),
      ratingCount: _toInt(j['ratingCount']),
      totalSales: _toInt(j['totalSales']),
      categoryName: j['categoryName']?.toString(),
      sellerName: j['sellerName']?.toString(),
      isNew: j['isNew'] == true,
    );
  }
}

/// One horizontal rail, with the heading copy the website prints above it.
class _Rail {
  final String id;
  final String title;
  final String? subtitle;
  final List<_Product> products;

  const _Rail({
    required this.id,
    required this.title,
    required this.subtitle,
    required this.products,
  });

  factory _Rail.fromJson(Map<String, dynamic> j) {
    final raw = j['products'];
    return _Rail(
      id: (j['id'] ?? '').toString(),
      title: (j['title'] ?? '').toString(),
      subtitle: j['subtitle']?.toString(),
      products: raw is List
          ? raw
              .whereType<Map>()
              .map((e) => _Product.fromJson(Map<String, dynamic>.from(e)))
              .toList()
          : const [],
    );
  }
}

/// A real department from the shop's own catalogue.
class _Department {
  final int id;
  final String name;
  final String slug;
  final int count;

  const _Department({
    required this.id,
    required this.name,
    required this.slug,
    required this.count,
  });

  factory _Department.fromJson(Map<String, dynamic> j) => _Department(
        id: _Product._toInt(j['id']),
        name: (j['name'] ?? '').toString(),
        slug: (j['slug'] ?? '').toString(),
        count: _Product._toInt(j['count']),
      );
}

/// The whole payload.
class _HomeFeed {
  final String brandName;
  final String? logoUrl;
  final int freeDeliveryFrom;
  final int returnsDays;
  final List<_Department> departments;
  final List<_Rail> rails;
  final List<_Product> pickedForYou;

  const _HomeFeed({
    required this.brandName,
    required this.logoUrl,
    required this.freeDeliveryFrom,
    required this.returnsDays,
    required this.departments,
    required this.rails,
    required this.pickedForYou,
  });

  static List<T> _list<T>(dynamic raw, T Function(Map<String, dynamic>) make) {
    if (raw is! List) return const [];
    return raw
        .whereType<Map>()
        .map((e) => make(Map<String, dynamic>.from(e)))
        .toList();
  }

  factory _HomeFeed.fromJson(Map<String, dynamic> j) {
    final brand = (j['brand'] as Map?) ?? const {};
    final commerce = (j['commerce'] as Map?) ?? const {};

    return _HomeFeed(
      brandName: (brand['name'] ?? 'Kandi').toString(),
      logoUrl: brand['logoUrl']?.toString(),
      freeDeliveryFrom: _Product._toInt(commerce['freeDeliveryFrom']),
      returnsDays: _Product._toInt(commerce['returnsDays']),
      departments: _list(j['departments'], _Department.fromJson),
      rails: _list(j['rails'], _Rail.fromJson),
      pickedForYou: _list(j['pickedForYou'], _Product.fromJson),
    );
  }
}

// ============================================================
// SHIMMER
// ============================================================

class _Shimmer extends StatefulWidget {
  final Widget child;
  const _Shimmer({required this.child});

  @override
  State<_Shimmer> createState() => _ShimmerState();
}

class _ShimmerState extends State<_Shimmer>
    with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(
    duration: const Duration(milliseconds: 1400),
    vsync: this,
  )..repeat();

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _c,
      child: widget.child,
      builder: (context, child) {
        final t = _c.value * 4 - 2;
        return ShaderMask(
          blendMode: BlendMode.srcATop,
          shaderCallback: (bounds) => LinearGradient(
            begin: Alignment.centerLeft,
            end: Alignment.centerRight,
            colors: const [_kHairline, _kWhite, _kHairline],
            stops: const [0.35, 0.5, 0.65],
            transform: _SlideX(t),
          ).createShader(bounds),
          child: child,
        );
      },
    );
  }
}

class _SlideX extends GradientTransform {
  final double slide;
  const _SlideX(this.slide);

  @override
  Matrix4? transform(Rect bounds, {ui.TextDirection? textDirection}) =>
      Matrix4.translationValues(bounds.width * slide, 0.0, 0.0);
}

// ============================================================
// PRESS
// ============================================================

class _Press extends StatefulWidget {
  final Widget child;
  final VoidCallback? onTap;
  const _Press({required this.child, this.onTap});

  /// How far a tap depresses its target. Every press on this screen uses the
  /// same amount, so it is a constant rather than a parameter nobody passes.
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

class HomeSectionsWidget extends StatefulWidget {
  /// `width` and `height` only — FlutterFlow adds those two to every custom
  /// widget and will put them back if they are deleted. There is nothing else
  /// to pass: the shop name, logo, terms, departments and products all come
  /// from the API, and the handful of real choices are constants at the top of
  /// this file.
  const HomeSectionsWidget({
    super.key,
    this.width,
    this.height,
  });

  final double? width;
  final double? height;

  @override
  State<HomeSectionsWidget> createState() => _HomeSectionsWidgetState();
}

class _HomeSectionsWidgetState extends State<HomeSectionsWidget>
    with TickerProviderStateMixin {
  static const double _pad = 12.0;
  static const double _radius = 8.0;

  final ScrollController _scroll = ScrollController();
  late final AnimationController _fabAnim = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 180),
  );

  _HomeFeed? _feed;
  bool _loading = true;
  String? _error;
  bool _showTop = false;

  /// Session-only, mirroring the website's per-device wishlist.
  final Set<int> _wishlisted = {};

  /// Badge on the cart icon. Hidden while it is zero.
  ///
  /// Left at zero because this widget has no parameters and no cart of its
  /// own. If your project keeps a cart count in FFAppState, the one-line change
  /// is to read it here — e.g. `int get _cartCount => FFAppState().cartCount;`
  /// — rather than to add a parameter back.
  final int _cartCount = 0;

  int _hintIndex = 0;
  Timer? _hintTimer;
  static const List<String> _hints = [
    'Sneakers',
    'Handbags',
    'Dresses',
    'Watches',
    'Perfume',
    'Home decor',
  ];

  @override
  void initState() {
    super.initState();
    _scroll.addListener(_onScroll);
    _load();
    _hintTimer = Timer.periodic(const Duration(seconds: 2), (_) {
      if (mounted) {
        setState(() => _hintIndex = (_hintIndex + 1) % _hints.length);
      }
    });
  }

  @override
  void dispose() {
    _scroll.removeListener(_onScroll);
    _scroll.dispose();
    _fabAnim.dispose();
    _hintTimer?.cancel();
    super.dispose();
  }

  void _onScroll() {
    final show = _scroll.offset > 500;
    if (show != _showTop) {
      setState(() => _showTop = show);
      show ? _fabAnim.forward() : _fabAnim.reverse();
    }
  }

  // ---------- Data ----------

  /// Trailing slashes are stripped so `https://shop.com/` and `https://shop.com`
  /// both work — a double slash in the path is the single most common way this
  /// constant gets typed wrong, and it produces a 404 that looks like an
  /// outage rather than a typo.
  String get _base => _kApiBaseUrl.replaceAll(RegExp(r'/+$'), '');

  // ---------- Navigation ----------

  /// Opens a FlutterFlow page by name.
  ///
  /// Replaces the action callbacks the previous version took as parameters.
  /// Wrapped in a try/catch on purpose: `pushNamed` throws when the route does
  /// not exist, and an unrouted tap should cost a dead button rather than
  /// throwing the shopper out of the home screen. An empty name is treated as
  /// "deliberately disabled" and does nothing at all.
  void _go(String routeName, {Map<String, String> params = const {}}) {
    if (routeName.isEmpty) return;
    HapticFeedback.lightImpact();

    try {
      context.pushNamed(routeName, queryParameters: params);
    } catch (e) {
      debugPrint('Kandi: no FlutterFlow page named "$routeName" ($e)');
    }
  }

  Future<void> _load() async {
    if (!mounted) return;
    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final response = await http
          .get(
            Uri.parse('$_base/api/app/home'),
            headers: const {'Accept': 'application/json'},
          )
          // A shopper on a weak connection should be told the shop is slow,
          // not left watching a spinner forever.
          .timeout(const Duration(seconds: 20));

      if (response.statusCode != 200) {
        throw _HttpFailure('Server returned ${response.statusCode}');
      }

      final decoded = jsonDecode(utf8.decode(response.bodyBytes));
      if (decoded is! Map) throw const FormatException('Unexpected payload');

      final feed = _HomeFeed.fromJson(Map<String, dynamic>.from(decoded));
      if (!mounted) return;
      setState(() {
        _feed = feed;
        _loading = false;
      });
    } catch (e) {
      debugPrint('Kandi home load failed: $e');
      if (!mounted) return;
      setState(() {
        _loading = false;
        // Deliberately not the raw exception: a shopper cannot act on
        // "SocketException: Failed host lookup".
        _error = 'Could not reach the shop. Check your connection.';
      });
    }
  }

  void _toggleWishlist(_Product p) {
    HapticFeedback.lightImpact();
    setState(() {
      if (_wishlisted.contains(p.id)) {
        _wishlisted.remove(p.id);
      } else {
        _wishlisted.add(p.id);
      }
    });
  }

  /// Both the slug and the id are handed over: the slug is what the website's
  /// own product URLs use, so a page built from it opens the same product, and
  /// the id is there for any lookup that wants the numeric key.
  void _openProduct(_Product p) {
    _go(_kProductRoute, params: {
      'slug': p.slug,
      'productId': p.id.toString(),
    });
  }

  void _toTop() {
    HapticFeedback.mediumImpact();
    _scroll.animateTo(
      0,
      duration: const Duration(milliseconds: 400),
      curve: Curves.easeOut,
    );
  }

  String _greeting() {
    final h = DateTime.now().hour;
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  }

  /// "2.2K sold" — the compact form the website prints beside a price.
  ///
  /// Real sales only. An earlier version generated a plausible-looking number
  /// from the product id, which is fabricated social proof — the sort of small
  /// lie that teaches shoppers to distrust everything else on the screen.
  String _compactSold(int value) {
    if (value >= 1000000) return '${(value / 1000000).toStringAsFixed(1)}M';
    if (value >= 1000) return '${(value / 1000).toStringAsFixed(1)}K';
    return '$value';
  }

  /// Five dark stars, filled to the rating.
  ///
  /// Dark rather than gold, exactly as on the website: on a card this dense the
  /// stars are a measurement, not a decoration, and a row of gold pulls the eye
  /// off the price sitting directly above them.
  Widget _stars(double rating) {
    final filled = rating.round();
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: List.generate(
        5,
        (i) => Icon(
          Icons.star_rounded,
          size: 11,
          color: i < filled ? _kInk : _kLine,
        ),
      ),
    );
  }

  // The small green "Local" tag that used to run inline with the product name
  // has been removed along with it. The website's tile carries no such chip,
  // and the name row is now a fixed two lines: a chip prefixed to the first
  // line eats roughly six characters of a title that was already being
  // ellipsised, which costs more than the tag was telling anybody. "Ships from
  // Uganda" is still stated on the product page, where there is room to say it
  // properly.

  // ============================================================
  // BUILD
  // ============================================================
  @override
  Widget build(BuildContext context) {
    return Container(
      width: widget.width ?? double.infinity,
      height: widget.height ?? double.infinity,
      color: _kPage,
      child: Stack(
        children: [
          Positioned.fill(
            child: RefreshIndicator(
              onRefresh: _load,
              color: _kPrimary,
              backgroundColor: _kWhite,
              child: CustomScrollView(
                controller: _scroll,
                physics: const AlwaysScrollableScrollPhysics(
                  parent: BouncingScrollPhysics(),
                ),
                slivers: _slivers(),
              ),
            ),
          ),
          if (_showTop)
            Positioned(
              right: _pad,
              bottom: 94,
              child: ScaleTransition(
                scale: _fabAnim,
                child: _Press(
                  onTap: _toTop,
                  child: Container(
                    width: 42,
                    height: 42,
                    decoration: const BoxDecoration(
                      color: _kPrimary,
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(
                      Icons.keyboard_arrow_up_rounded,
                      color: _kWhite,
                      size: 23,
                    ),
                  ),
                ),
              ),
            ),
          Positioned(left: 0, right: 0, bottom: 0, child: _bottomNav()),
        ],
      ),
    );
  }

  List<Widget> _slivers() {
    if (_loading) {
      return [
        SliverToBoxAdapter(child: _appBar()),
        SliverToBoxAdapter(child: _searchArea()),
        SliverToBoxAdapter(child: _skeleton()),
      ];
    }

    if (_error != null) {
      return [
        SliverToBoxAdapter(child: _appBar()),
        SliverFillRemaining(hasScrollBody: false, child: _errorState()),
      ];
    }

    final feed = _feed;
    if (feed == null) return [SliverToBoxAdapter(child: _appBar())];

    return [
      SliverToBoxAdapter(child: _appBar()),
      SliverToBoxAdapter(child: _searchArea()),
      if (feed.departments.isNotEmpty)
        SliverToBoxAdapter(child: _departments(feed)),
      SliverToBoxAdapter(child: _trustStrip(feed)),

      // The rails, in the order the website decided. Nothing here knows or
      // cares what they are called.
      ...feed.rails.map(
        (r) => SliverToBoxAdapter(child: _rail(r)),
      ),

      if (feed.pickedForYou.isNotEmpty) ...[
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(_pad, 12, _pad, 8),
            child: _sectionHeading('Picked for you', null),
          ),
        ),
        _grid(feed.pickedForYou),
      ],

      const SliverToBoxAdapter(child: SizedBox(height: 96)),
    ];
  }

  // ---------- App bar ----------
  Widget _appBar() {
    final logo = _feed?.logoUrl;
    final hasLogo = logo != null && logo.isNotEmpty;

    return SafeArea(
      bottom: false,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(_pad, 6, _pad, 6),
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  if (hasLogo)
                    SizedBox(
                      height: 24,
                      child: CachedNetworkImage(
                        imageUrl: logo,
                        fit: BoxFit.contain,
                        alignment: Alignment.centerLeft,
                        errorWidget: (_, __, ___) => _logoText(),
                      ),
                    )
                  else
                    _logoText(),
                  const SizedBox(height: 1),
                  // No name: there is no parameter to carry one. A bare
                  // greeting is better than "Good morning, there".
                  Text(_greeting(), style: _label(size: 11, color: _kMuted)),
                ],
              ),
            ),
            _circleIcon(
              icon: Icons.favorite_border_rounded,
              badge: _wishlisted.length,
              onTap: () => _go(_kWishlistRoute),
            ),
            const SizedBox(width: 8),
            _circleIcon(
              icon: Icons.shopping_bag_outlined,
              badge: _cartCount,
              onTap: () => _go(_kCartRoute),
            ),
          ],
        ),
      ),
    );
  }

  Widget _logoText() => Text(
        _feed?.brandName ?? _kFallbackShopName,
        style: _heading(size: 21, color: _kPrimary),
      );

  Widget _circleIcon({
    required IconData icon,
    int badge = 0,
    required VoidCallback onTap,
  }) {
    return _Press(
      onTap: onTap,
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          Container(
            width: 38,
            height: 38,
            decoration: BoxDecoration(
              color: _kWhite,
              shape: BoxShape.circle,
              border: Border.all(color: _kLine),
            ),
            child: Icon(icon, color: _kInk, size: 19),
          ),
          if (badge > 0)
            Positioned(
              right: -3,
              top: -3,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
                constraints: const BoxConstraints(minWidth: 17, minHeight: 17),
                decoration: BoxDecoration(
                  color: _kPrimary,
                  borderRadius: BorderRadius.circular(9),
                  border: Border.all(color: _kPage, width: 1.5),
                ),
                child: Text(
                  '$badge',
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
  }

  // ---------- Search ----------
  Widget _searchArea() => Padding(
        padding: const EdgeInsets.fromLTRB(_pad, 0, _pad, 8),
        child: GestureDetector(
          onTap: () => _go(_kSearchRoute),
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
            decoration: BoxDecoration(
              color: _kSearchBg,
              borderRadius: BorderRadius.circular(22),
            ),
            child: Row(
              children: [
                const Icon(Icons.search_rounded, color: _kMuted, size: 19),
                const SizedBox(width: 8),
                Expanded(
                  child: AnimatedSwitcher(
                    duration: const Duration(milliseconds: 280),
                    child: Row(
                      key: ValueKey(_hintIndex),
                      children: [
                        Text('Search ', style: _text(size: 13, color: _kMuted)),
                        Flexible(
                          child: Text(
                            _hints[_hintIndex],
                            style: _text(
                              size: 13,
                              color: _kInk,
                              weight: FontWeight.w700,
                            ),
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                  decoration: BoxDecoration(
                    color: _kPrimary,
                    borderRadius: BorderRadius.circular(16),
                  ),
                  child: Text(
                    'Search',
                    // White on orange is 2.9:1, so the label carries weight to
                    // stay legible at this size.
                    style: _label(
                      size: 11.5,
                      color: _kWhite,
                      weight: FontWeight.w800,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      );

  // ---------- Departments ----------
  Widget _departments(_HomeFeed feed) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 4),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(_pad, 2, _pad, 10),
            child: _sectionHeading('Shop by department', null),
          ),
          SizedBox(
            height: 82,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: _pad),
              itemCount: feed.departments.length,
              separatorBuilder: (_, __) => const SizedBox(width: 14),
              itemBuilder: (_, i) {
                final d = feed.departments[i];
                return _Press(
                  onTap: () => _go(
                    _kCategoryRoute,
                    params: {'slug': d.slug, 'name': d.name},
                  ),
                  child: SizedBox(
                    width: 62,
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Container(
                          width: 54,
                          height: 54,
                          decoration: const BoxDecoration(
                            color: _kPrimarySoft,
                            shape: BoxShape.circle,
                          ),
                          child: const Icon(
                            Icons.category_rounded,
                            color: _kPrimaryInk,
                            size: 23,
                          ),
                        ),
                        const SizedBox(height: 6),
                        Text(
                          d.name,
                          style: _label(
                            size: 11,
                            color: _kInk,
                            weight: FontWeight.w600,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          textAlign: TextAlign.center,
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
  }

  // ---------- Trust ----------
  Widget _trustStrip(_HomeFeed feed) {
    Widget item(IconData icon, String text) => Expanded(
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(icon, size: 13, color: _kSuccess),
              const SizedBox(width: 5),
              Flexible(
                child: Text(
                  text,
                  style: _label(size: 10.5, color: _kBody),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ],
          ),
        );

    return Container(
      margin: const EdgeInsets.fromLTRB(_pad, 8, _pad, 0),
      padding: const EdgeInsets.symmetric(vertical: 9),
      decoration: const BoxDecoration(
        color: _kSurface,
        borderRadius: BorderRadius.all(Radius.circular(_radius)),
      ),
      child: Row(
        children: [
          item(Icons.local_shipping_outlined, 'Fast delivery'),
          Container(width: 1, height: 12, color: _kLine),
          item(Icons.payments_outlined, 'Pay on delivery'),
          Container(width: 1, height: 12, color: _kLine),
          // Straight from the shop's settings, so it can never contradict what
          // the checkout actually allows.
          item(Icons.assignment_return_outlined, '${feed.returnsDays}-day returns'),
        ],
      ),
    );
  }

  // ---------- Section heading ----------
  Widget _sectionHeading(String title, String? subtitle) => Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(title, style: _heading(size: 18)),
          if (subtitle != null && subtitle.isNotEmpty) ...[
            const SizedBox(height: 2),
            Text(subtitle, style: _subtitle()),
          ],
        ],
      );

  // ---------- Rail ----------
  Widget _rail(_Rail rail) {
    if (rail.products.isEmpty) return const SizedBox.shrink();

    return Padding(
      padding: const EdgeInsets.only(top: 10),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: _pad),
            child: Row(
              children: [
                Expanded(child: _sectionHeading(rail.title, rail.subtitle)),
                _Press(
                  onTap: () => _go(_kShopRoute),
                  child: Row(
                    children: [
                      Text(
                        'View all',
                        style: _label(
                          size: 12.5,
                          color: _kPrimaryInk,
                          weight: FontWeight.w700,
                        ),
                      ),
                      const Icon(
                        Icons.arrow_forward_ios_rounded,
                        size: 11,
                        color: _kPrimaryInk,
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 10),
          SizedBox(
            // Exactly as tall as a tile is, rather than the 330 that used to be
            // here. A rail's height was guesswork while the card could grow its
            // own extra rows; now that the text block is a known height, the
            // rail is the square photograph plus that and nothing else — so no
            // tile is stretched and there is no dead band under the row.
            height: _kRailTileWidth + _kCardTextHeight,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: _pad),
              itemCount: rail.products.length,
              separatorBuilder: (_, __) => const SizedBox(width: 8),
              itemBuilder: (_, i) => SizedBox(
                width: _kRailTileWidth,
                child: _card(rail.products[i]),
              ),
            ),
          ),
        ],
      ),
    );
  }

  // ---------- Grid ----------
  /// Two columns, with the aspect ratio *computed* rather than typed.
  ///
  /// It used to be `childAspectRatio: 0.50`, a number that had to be re-guessed
  /// by hand every time the card changed and was wrong on any screen it was not
  /// tuned against — too tall and every tile carried a band of dead space, too
  /// short and Flutter overflowed the bottom row with the yellow-and-black
  /// stripes.
  ///
  /// It does not need guessing any more. The photograph is square, so it is
  /// exactly as tall as the tile is wide, and everything under it is a known
  /// `_kCardTextHeight`. So the tile's true height is arithmetic, and the ratio
  /// falls out of it — correct on a 360px phone and on a tablet, and correct
  /// again the next time a row height changes, because it is derived from the
  /// same constants the card lays itself out with.
  Widget _grid(List<_Product> products) {
    const gutter = 8.0;
    final tileWidth =
        (MediaQuery.of(context).size.width - gutter * 3) / 2;
    final tileHeight = tileWidth + _kCardTextHeight;

    return SliverPadding(
      padding: const EdgeInsets.symmetric(horizontal: gutter),
      sliver: SliverGrid(
        gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
          crossAxisCount: 2,
          mainAxisSpacing: gutter,
          crossAxisSpacing: gutter,
          childAspectRatio: tileWidth / tileHeight,
        ),
        delegate: SliverChildBuilderDelegate(
          (_, i) => _card(products[i]),
          childCount: products.length,
          addAutomaticKeepAlives: false,
        ),
      ),
    );
  }

  // ---------- Product card ----------
  /// The product card, matched to the website's.
  ///
  /// Chrome-free: no border, no shadow, no card fill. The photograph sits
  /// directly on white and the detail beneath it is tight, so a grid of forty
  /// reads as a catalogue rather than forty floating panels — whitespace does
  /// the separating. That is the biggest change from the previous version,
  /// which drew a bordered white box around every tile.
  ///
  /// The information order is the website's, and it is an order of decreasing
  /// importance rather than a description of the product:
  ///
  ///   image -> name -> price, was-price and discount on one line ->
  ///   rating and units sold -> delivery promise.
  ///
  /// FOUR text rows, and always the same four. This is the part that changed,
  /// and it is the whole design of the block rather than a tidy-up.
  ///
  /// ---- Why every tile is now exactly the same height ----
  ///
  /// This card used to render up to six rows, most of them conditional: a
  /// "Save UGX 5,000" line only on discounted products, a rating row only on
  /// reviewed ones, a "Best Seller in Shoes" line only past 50 sales, and an
  /// `Expanded` + `Spacer` underneath to push the delivery promise down.
  /// Every one of those was a good line on its own.
  ///
  /// Together they meant no two tiles were the same height, and the text under
  /// a row of two products started at two different places. In the grid that is
  /// merely untidy. In a horizontal rail it is worse: every tile stretches to
  /// the tallest, so one product with three extra lines of metadata added that
  /// much dead space to the bottom of every other tile in the row. The extra
  /// information was being bought with the row's alignment — and on a home
  /// screen that is eight rails deep, the alignment is what makes it scannable.
  ///
  /// So the variable rows are gone and the four that survive are the four every
  /// product genuinely has: what it is, what it costs, how it is rated, and when
  /// it arrives. The rating row is rendered even when there is nothing to put in
  /// it — an empty 16px box costs less than a ragged row of baselines.
  ///
  /// Each row is a `SizedBox` of a fixed height rather than a `Spacer`, which is
  /// what lets `_grid` and `_rail` compute the tile height exactly: it is always
  /// the image (square, so the tile width) plus `_kCardTextHeight`.
  ///
  /// The saving line and the "Best Seller in X" line are not lost to the
  /// shopper — the reduction is on the tile twice over as the corner flag and
  /// the figure beside the price, and the sales count is in the rating row.
  ///
  /// Colour is rationed the same way as on the web: a resting price is
  /// near-black and only a discounted one turns red, green is delivery and
  /// nothing else.
  Widget _card(_Product p) {
    final wished = _wishlisted.contains(p.id);
    final soldOut = !p.inStock;
    final lowStock =
        !soldOut && p.stockQuantity != null && p.stockQuantity! <= _kLowStockAt;

    /// The website drops the struck-through original and the percentage beside
    /// the price below its `sm` breakpoint (640px), leaving the resting price
    /// the full width of a narrow tile. The same rule is applied here against
    /// the same number, so a phone shows what the website shows on a phone and
    /// a tablet shows what it shows on a tablet.
    ///
    /// Nothing is lost on the narrow layout: the reduction is on the photograph
    /// as a corner flag, which is the signal that stops a thumb mid-scroll.
    final wide = MediaQuery.of(context).size.width >= 640;

    return RepaintBoundary(
      child: _Press(
        onTap: () => _openProduct(p),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Square, down from 4:5 — a quarter shorter, and the website's
            // reasoning applies here with more force rather than less.
            //
            // The 4:5 crop was argued for on the grounds that clothes and shoes
            // are photographed standing up, so the extra height goes to the
            // garment rather than to floor and ceiling. That is true of a
            // fashion catalogue and false of this one: the shop sells
            // wardrobes, shoe racks, air pumps, curtains and milk, most of it
            // photographed square by the supplier, and a 4:5 frame around a
            // square photograph is 25% empty space by construction.
            //
            // Square is also what puts more rows on a screen, which on a phone
            // is the whole game — rows are the product.
            AspectRatio(
              aspectRatio: 1,
              child: Stack(
                fit: StackFit.expand,
                children: [
                  ClipRRect(
                    // 10px, not the 8 the rest of the app uses. This is the
                    // website's tile radius, and it is deliberate there: big
                    // enough to read as a made object on a 150px phone tile,
                    // small enough that it does not turn into a lozenge.
                    borderRadius: BorderRadius.circular(_kCardRadius),
                    child: Opacity(
                      opacity: soldOut ? 0.5 : 1,
                      child: _image(p.image),
                    ),
                  ),
                  if (soldOut)
                    Positioned(
                      left: 8,
                      top: 8,
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 8,
                          vertical: 2,
                        ),
                        decoration: BoxDecoration(
                          color: _kInk,
                          borderRadius: BorderRadius.circular(4),
                        ),
                        child: Text(
                          'Sold out',
                          style: _label(
                            size: 11,
                            color: _kWhite,
                            weight: FontWeight.w600,
                          ),
                        ),
                      ),
                    ),

                  // ---- The discount flag ----
                  //
                  // New here, and the reason it earns its place is the same one
                  // the website records. The percentage beside the price is
                  // where the number *means* most, sitting between what the item
                  // costs and what it cost — but the price block is the last
                  // thing read, and on a rail a thumb flicks past in under a
                  // second it is often not read at all. The discount is the
                  // single strongest reason to stop scrolling, and it had no
                  // presence in the part of the tile a shopper actually looks
                  // at.
                  //
                  // A corner flag, not the 56px orange medallion the web tile
                  // used to carry: 11px, sale red rather than the brand orange
                  // so the colour still means "reduced", and only on products
                  // with a genuine reduction.
                  //
                  // Top LEFT, where the website puts it top right. That is the
                  // one deliberate departure on this card, and it is forced by
                  // the heart. The website reveals its heart on hover, so the
                  // top-right corner is free; a phone has no hover, so the
                  // heart is always visible there. Putting the flag opposite it
                  // keeps both readable, and it cannot collide with the
                  // "Sold out" badge that shares this corner because the two
                  // are mutually exclusive by construction — a sold-out product
                  // never renders a discount.
                  if (!soldOut && p.discountPercent > 0)
                    Positioned(
                      left: 8,
                      top: 8,
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 6,
                          vertical: 3,
                        ),
                        decoration: BoxDecoration(
                          color: _kSale,
                          borderRadius: BorderRadius.circular(6),
                          boxShadow: [
                            BoxShadow(
                              color: Colors.black.withOpacity(0.15),
                              blurRadius: 3,
                              offset: const Offset(0, 1),
                            ),
                          ],
                        ),
                        child: Text(
                          '−${p.discountPercent}%',
                          style: _label(
                            size: 11,
                            color: _kWhite,
                            weight: FontWeight.w700,
                          ),
                        ),
                      ),
                    ),

                  // The website reveals the heart on hover. A phone has no
                  // hover, so it stays visible — hiding it would remove the
                  // feature rather than match the design.
                  Positioned(
                    right: 8,
                    top: 8,
                    child: _Press(
                      onTap: () => _toggleWishlist(p),
                      child: Container(
                        width: 28,
                        height: 28,
                        decoration: BoxDecoration(
                          color: _kWhite.withOpacity(0.9),
                          shape: BoxShape.circle,
                        ),
                        child: Icon(
                          wished
                              ? Icons.favorite_rounded
                              : Icons.favorite_border_rounded,
                          size: 16,
                          color: wished ? _kSale : _kBody,
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),

            const SizedBox(height: _kCardGap),

            // ---- Row 1: the name ----
            //
            // Exactly two lines, always. The box is a fixed 40 — two times the
            // 20px leading — rather than a `maxLines` that shrinks to fit,
            // because a short name has to *reserve* the second line instead of
            // letting the price ride up under it. This single box is the
            // biggest contributor to neighbouring tiles matching.
            //
            // Set at the interface weight, not bold: a supplier's
            // 90-character title in bold is a wall.
            SizedBox(
              height: _kCardNameHeight,
              width: double.infinity,
              child: Text(
                p.name,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: _text(
                  size: 14,
                  color: _kInk,
                  weight: FontWeight.w400,
                  // 20/14 — the website's `leading-[20px]` on `text-[14px]`,
                  // which is what makes two lines come to exactly 40.
                  height: 20 / 14,
                ),
              ),
            ),

            // ---- Row 2: the money ----
            //
            // What it costs, what it cost, and the reduction, on one line —
            // the three figures only mean anything read together.
            //
            // The row is a fixed height, which is what would have clipped it:
            // on a narrow tile "UGX 120,000  UGX 300,000  −10%" needs roughly
            // double the width available, and a `Wrap` (which is what this used
            // to be) would break it onto a second line that the fixed height
            // then cuts in half. So it is a `Row` that cannot wrap, and on
            // narrow screens the was-price and the percentage are dropped
            // rather than squeezed — exactly what the website does below `sm`.
            SizedBox(
              height: _kCardPriceHeight,
              width: double.infinity,
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  Flexible(
                    child: Text(
                      p.priceLabel,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      softWrap: false,
                      style: _price(
                        size: wide ? 15 : 13,
                        color: p.discountPercent > 0 ? _kSale : _kInk,
                      ),
                    ),
                  ),
                  if (wide && p.wasPriceLabel != null) ...[
                    const SizedBox(width: 6),
                    Text(p.wasPriceLabel!, style: _struck(size: 11.5)),
                  ],
                  if (wide && p.discountPercent > 0) ...[
                    const SizedBox(width: 6),
                    Text(
                      '−${p.discountPercent}%',
                      style: _label(
                        size: 11.5,
                        color: _kSale,
                        weight: FontWeight.w700,
                      ),
                    ),
                  ],
                ],
              ),
            ),

            // ---- Row 3: rating and units sold ----
            //
            // The two numbers a shopper uses to decide whether anyone else took
            // the risk first — and the row renders even with nothing in it.
            //
            // That is the point rather than an oversight. A product with no
            // reviews and no sales is exactly the one that would otherwise
            // render a shorter tile than its neighbours, and an empty 16px box
            // costs less than the ragged baselines that hiding it caused.
            SizedBox(
              height: _kCardMetaHeight,
              width: double.infinity,
              child: Row(
                children: [
                  if (p.ratingCount > 0) ...[
                    _stars(p.rating),
                    const SizedBox(width: 4),
                    Text(
                      p.rating.toStringAsFixed(1),
                      style: _label(
                        size: 11.5,
                        color: _kBody,
                        weight: FontWeight.w600,
                      ),
                    ),
                  ],
                  if (p.ratingCount > 0 && p.totalSales > 0)
                    const SizedBox(width: 8),
                  if (p.totalSales > 0)
                    Flexible(
                      child: Text(
                        '${_compactSold(p.totalSales)} sold',
                        style: _label(
                          size: 11.5,
                          color: _kMuted,
                          weight: FontWeight.w500,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                ],
              ),
            ),

            // ---- Row 4: the delivery promise ----
            //
            // Always last, always one line, always the same height. Ellipsised
            // rather than wrapped so a long stock message cannot undo the
            // matching heights above it.
            SizedBox(
              height: _kCardMetaHeight,
              width: double.infinity,
              child: soldOut
                  ? Text(
                      'Back in stock soon',
                      style: _label(
                        size: 11.5,
                        color: _kMuted,
                        weight: FontWeight.w500,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    )
                  : lowStock
                      ? Row(
                          children: [
                            Container(
                              width: 6,
                              height: 6,
                              decoration: const BoxDecoration(
                                color: _kSale,
                                shape: BoxShape.circle,
                              ),
                            ),
                            const SizedBox(width: 6),
                            Flexible(
                              child: Text(
                                'Only ${p.stockQuantity} left',
                                style: _label(
                                  size: 11.5,
                                  color: _kSale,
                                  weight: FontWeight.w600,
                                ),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                          ],
                        )
                      // Not "free delivery" — that depends on the basket total
                      // and a tile cannot know it. Promising it here would be a
                      // lie on most orders.
                      : Text(
                          'Fastest delivery: 1 business day',
                          style: _label(
                            size: 11.5,
                            color: _kSuccess,
                            weight: FontWeight.w600,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _image(String url) {
    if (url.isEmpty) return _imageFallback();

    return CachedNetworkImage(
      imageUrl: url,
      fit: BoxFit.cover,
      // Decoded at roughly the size it is drawn. Without this a 2000px
      // WooCommerce photo is decoded at full resolution into a 150px box, and
      // twenty of them on screen is how a mid-range Android runs out of memory.
      memCacheWidth: 500,
      fadeInDuration: const Duration(milliseconds: 180),
      placeholder: (_, __) => const _Shimmer(
        child: ColoredBox(color: _kHairline, child: SizedBox.expand()),
      ),
      errorWidget: (_, __, ___) => _imageFallback(),
    );
  }

  Widget _imageFallback() => const ColoredBox(
        color: _kHairline,
        child: Center(
          child: Icon(Icons.image_not_supported_outlined,
              color: _kFaint, size: 22),
        ),
      );

  // ---------- Skeleton ----------
  Widget _skeleton() => Padding(
        padding: const EdgeInsets.symmetric(horizontal: _pad),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _Shimmer(
              child: Container(
                height: 18,
                width: 150,
                decoration: BoxDecoration(
                  color: _kHairline,
                  borderRadius: BorderRadius.circular(4),
                ),
              ),
            ),
            const SizedBox(height: 14),
            // The same height and tile width as a real rail, off the same
            // constants. A skeleton that is not the size of the thing it stands
            // in for makes the page jump when the data lands, which is the one
            // job a skeleton exists to prevent.
            SizedBox(
              height: _kRailTileWidth + _kCardTextHeight,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                itemCount: 4,
                separatorBuilder: (_, __) => const SizedBox(width: 8),
                itemBuilder: (_, __) => _Shimmer(
                  child: Container(
                    width: _kRailTileWidth,
                    decoration: BoxDecoration(
                      color: _kHairline,
                      borderRadius: BorderRadius.circular(_kCardRadius),
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
      );

  // ---------- Error ----------
  Widget _errorState() => Padding(
        padding: const EdgeInsets.all(28),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.wifi_off_rounded, size: 40, color: _kFaint),
            const SizedBox(height: 14),
            Text(
              'Cannot load the shop',
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
                padding:
                    const EdgeInsets.symmetric(horizontal: 26, vertical: 12),
                decoration: BoxDecoration(
                  color: _kPrimary,
                  borderRadius: BorderRadius.circular(_radius),
                ),
                child: Text(
                  'Try again',
                  style: _label(
                    size: 13.5,
                    color: _kWhite,
                    weight: FontWeight.w800,
                  ),
                ),
              ),
            ),
          ],
        ),
      );

  // ---------- Bottom nav ----------
  Widget _bottomNav() {
    // A small class rather than a record tuple, so the file still compiles on
    // a FlutterFlow project pinned to a pre-Dart-3 SDK.
    //
    // Home is index 0 and already on screen, so its route is empty — `_go`
    // treats that as "do nothing" rather than pushing the page onto itself.
    final items = <_NavItem>[
      const _NavItem(Icons.home_rounded, 'Home', ''),
      const _NavItem(Icons.grid_view_rounded, 'Shop', _kShopRoute),
      const _NavItem(Icons.favorite_border_rounded, 'Saved', _kWishlistRoute),
      const _NavItem(Icons.shopping_bag_outlined, 'Cart', _kCartRoute),
      const _NavItem(Icons.person_outline_rounded, 'Me', _kProfileRoute),
    ];

    return Container(
      decoration: const BoxDecoration(
        color: _kWhite,
        border: Border(top: BorderSide(color: _kLine)),
      ),
      child: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 6),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceAround,
            children: [
              for (var i = 0; i < items.length; i++)
                _Press(
                  // No haptic here: `_go` fires one itself, and two on a
                  // single tap reads as a stutter.
                  onTap: () => _go(items[i].route),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 10,
                      vertical: 4,
                    ),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(
                          items[i].icon,
                          size: 21,
                          color: i == 0 ? _kPrimary : _kMuted,
                        ),
                        const SizedBox(height: 3),
                        Text(
                          items[i].label,
                          style: _label(
                            size: 10,
                            color: i == 0 ? _kPrimary : _kMuted,
                            weight: i == 0 ? FontWeight.w800 : FontWeight.w600,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

/// One entry in the bottom bar.
///
/// Carries the *name* of the page to open rather than a callback, since there
/// are no callbacks to pass any more. An empty name means the tap is a no-op.
class _NavItem {
  final IconData icon;
  final String label;
  final String route;
  const _NavItem(this.icon, this.label, this.route);
}

/// Thrown for a non-200 so the catch in `_load` has one thing to handle.
///
/// Named distinctly rather than reusing `dart:io`'s `HttpException`, which is
/// not available on Flutter web and would break a web build of the app.
class _HttpFailure implements Exception {
  final String message;
  const _HttpFailure(this.message);
  @override
  String toString() => '_HttpFailure: $message';
}
