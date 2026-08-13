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
//     The storefront is orange (#ff6a00) with Plus Jakarta Sans,
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
const Color _kTitle = Color(0xFF334155); // product names
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

// ============================================================
// TYPE — Plus Jakarta Sans, one face for everything
// ============================================================

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
    GoogleFonts.plusJakartaSans(
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
    GoogleFonts.plusJakartaSans(
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
TextStyle _subtitle({double size = 13.5}) => GoogleFonts.plusJakartaSans(
      fontSize: size,
      fontWeight: FontWeight.w600,
      color: _kBody,
      height: 1.4,
      letterSpacing: size * -0.006,
    );

/// Prices. Bold, barely tightened, tabular so digits line up in a grid.
TextStyle _price({double size = 15, Color color = _kInk}) =>
    GoogleFonts.plusJakartaSans(
      fontSize: size,
      fontWeight: FontWeight.w700,
      color: color,
      height: 1.1,
      letterSpacing: size * -0.008,
      fontFeatures: const [ui.FontFeature.tabularFigures()],
    );

/// The struck-through was-price.
TextStyle _struck({double size = 12}) => GoogleFonts.plusJakartaSans(
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
    GoogleFonts.plusJakartaSans(
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

  String _soldLabel(_Product p) {
    // Real sales only. v3 generated a plausible-looking number from the product
    // id, which is a fabricated social proof signal — the sort of small lie
    // that teaches shoppers to distrust everything else on the screen.
    if (p.totalSales <= 0) return '';
    if (p.totalSales >= 1000) {
      return '${(p.totalSales / 1000).toStringAsFixed(1)}k sold';
    }
    return '${p.totalSales} sold';
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
            padding: const EdgeInsets.fromLTRB(_pad, 20, _pad, 10),
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
        padding: const EdgeInsets.fromLTRB(_pad, 0, _pad, 10),
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
      padding: const EdgeInsets.only(top: 18),
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
            height: 236,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: _pad),
              itemCount: rail.products.length,
              separatorBuilder: (_, __) => const SizedBox(width: 8),
              itemBuilder: (_, i) => SizedBox(
                width: 148,
                child: _card(rail.products[i]),
              ),
            ),
          ),
        ],
      ),
    );
  }

  // ---------- Grid ----------
  Widget _grid(List<_Product> products) => SliverPadding(
        padding: const EdgeInsets.symmetric(horizontal: 8),
        sliver: SliverGrid(
          gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: 2,
            mainAxisSpacing: 8,
            crossAxisSpacing: 8,
            childAspectRatio: 0.60,
          ),
          delegate: SliverChildBuilderDelegate(
            (_, i) => _card(products[i]),
            childCount: products.length,
            addAutomaticKeepAlives: false,
          ),
        ),
      );

  // ---------- Product card ----------
  Widget _card(_Product p) {
    final wished = _wishlisted.contains(p.id);
    final sold = _soldLabel(p);

    return RepaintBoundary(
      child: _Press(
        onTap: () => _openProduct(p),
        child: Container(
          decoration: BoxDecoration(
            color: _kWhite,
            borderRadius: BorderRadius.circular(_radius),
            border: Border.all(color: _kLine),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              AspectRatio(
                aspectRatio: 1,
                child: Stack(
                  fit: StackFit.expand,
                  children: [
                    ClipRRect(
                      borderRadius: const BorderRadius.vertical(
                        top: Radius.circular(_radius),
                      ),
                      child: _image(p.image),
                    ),
                    if (p.discountPercent > 0)
                      Positioned(
                        top: 0,
                        left: 0,
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 6,
                            vertical: 3,
                          ),
                          decoration: const BoxDecoration(
                            // Red, because this is a discount. It is the only
                            // thing on the screen allowed to be red.
                            color: _kSale,
                            borderRadius: BorderRadius.only(
                              topLeft: Radius.circular(_radius),
                              bottomRight: Radius.circular(8),
                            ),
                          ),
                          child: Text(
                            '-${p.discountPercent}%',
                            style: _label(
                              size: 10,
                              color: _kWhite,
                              weight: FontWeight.w800,
                            ),
                          ),
                        ),
                      ),
                    if (!p.inStock)
                      Container(
                        // `withOpacity`, not `withValues`, throughout this
                        // file — deliberately, and not an oversight to tidy
                        // up. The analyser marks it deprecated on a current
                        // SDK, but `withValues` did not exist before Flutter
                        // 3.27 and is a hard compile error on anything older.
                        // A deprecation notice builds everywhere; the
                        // replacement does not. Swap them once you know the
                        // FlutterFlow build image is on 3.27+.
                        color: _kWhite.withOpacity(0.72),
                        alignment: Alignment.center,
                        child: Text(
                          'Sold out',
                          style: _label(
                            size: 12,
                            color: _kInk,
                            weight: FontWeight.w800,
                          ),
                        ),
                      ),
                    Positioned(
                      top: 4,
                      right: 4,
                      child: _Press(
                        onTap: () => _toggleWishlist(p),
                        child: Container(
                          width: 28,
                          height: 28,
                          decoration: BoxDecoration(
                            color: _kWhite.withOpacity(0.92),
                            shape: BoxShape.circle,
                          ),
                          child: Icon(
                            wished
                                ? Icons.favorite_rounded
                                : Icons.favorite_border_rounded,
                            size: 15,
                            color: wished ? _kSale : _kMuted,
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(8, 7, 8, 7),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // The name takes the plain weight. A supplier's
                      // 90-character title set bold is a wall.
                      Text(
                        p.name,
                        style: _text(
                          size: 12.5,
                          color: _kTitle,
                          weight: FontWeight.w400,
                          height: 1.3,
                        ),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                      const Spacer(),
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.end,
                        children: [
                          Flexible(
                            child: Text(
                              p.priceLabel,
                              style: _price(
                                size: 14,
                                color: p.discountPercent > 0 ? _kSale : _kInk,
                              ),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                          if (p.wasPriceLabel != null) ...[
                            const SizedBox(width: 5),
                            Flexible(
                              child: Text(
                                p.wasPriceLabel!,
                                style: _struck(size: 11),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                          ],
                        ],
                      ),
                      if (sold.isNotEmpty) ...[
                        const SizedBox(height: 3),
                        Text(sold, style: _label(size: 10, color: _kMuted)),
                      ],
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
            SizedBox(
              height: 236,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                itemCount: 4,
                separatorBuilder: (_, __) => const SizedBox(width: 8),
                itemBuilder: (_, __) => _Shimmer(
                  child: Container(
                    width: 148,
                    decoration: BoxDecoration(
                      color: _kHairline,
                      borderRadius: BorderRadius.circular(_radius),
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
