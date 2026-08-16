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
//  KANDI — SHOP / CATEGORY  (v3)
//
//  Sibling of home_sections_widget.dart. Same brand, same models,
//  same API, no parameters.
//
//  WHAT CHANGED FROM v2 (GOLDLINE), AND WHY
//  -----------------------------------------------------------
//  1. THE DEPARTMENTS ARE REAL NOW. v2 shipped a hard-coded tab
//     list — Women, Men, Kids, Beauty, Shoes, Home Decor — each
//     with a hard-coded subcategory list, and matched products by
//     hunting for substrings in the category name
//     (category.contains('dress'), gender == 'female', and so on).
//
//     That fails in both directions. It offers departments the
//     shop does not stock, so tapping "Beauty" on a shop with no
//     beauty products gives a blank screen that reads as broken.
//     And it hides departments the shop DOES have, because a
//     category the owner created in wp-admin that happens not to
//     contain an expected word is invisible to the app entirely.
//
//     Tabs and subcategory chips now come from the shop's own
//     WooCommerce terms, sent by the API with product counts, and
//     filtering is by slug rather than by guesswork. Create a
//     category on the website and it appears here; delete one and
//     it goes. No app release either way.
//
//  2. FILTERING AND SORTING MOVED TO THE SERVER. v2 pulled the
//     ENTIRE products table into memory on every visit
//     (`queryRows` with no limit) and filtered in Dart. That is a
//     download that grows without bound as the catalogue does, on
//     phones and connections that can least afford it.
//
//     The server now returns one page of 24, already filtered and
//     sorted by the same `sortProducts`/`filterProducts` the
//     website's own category page uses — so "Price: low to high"
//     cannot mean one thing in the app and another on the web.
//
//  3. SUPABASE IS GONE. v2 read Supabase (`ProductsTable`,
//     `ProductsRow`, the `wishlist` table); the website reads
//     WooCommerce. Two databases meant the app and the site could
//     never show the same catalogue. WooCommerce is now the only
//     source of truth.
//
//  4. NO PARAMETERS. Everything is in the CONFIG block below.
//     `width` and `height` remain only because FlutterFlow
//     generates those two itself and re-adds them if removed.
//
//     The one thing lost with `initialCategory` is deep-linking
//     into a department. It is read from the page's route instead
//     — see `_readInitialCategory`.
//
//  5. BRAND. v2 mixed the brand orange with Poppins/Inter, a grey
//     page and a red `_goldDeep`. Matched to the storefront:
//     Inter, white page, orange #ff6a00, and red
//     reserved strictly for discounts.
//
//  SETUP  (FlutterFlow)
//  -----------------------------------------------------------
//  • Custom Widget name:  CategoryNavigationMenu
//  • Dependencies (Settings ▸ Pubspec):
//        http: ^1.2.0
//        cached_network_image: ^3.3.1
//        google_fonts: ^6.1.0
//  • Parameters to add: NONE.
//
//  NOTE ON THE SUPABASE IMPORT ABOVE: FlutterFlow writes that
//  header itself and rewrites it on every save, so it stays.
//  Nothing in this file uses Supabase any more.
//
//  NOTE ON THE WISHLIST: session-only, mirroring the website
//  (whose wishlist is per-device localStorage, not a server
//  record). Lift `_wishlisted` into FFAppState to persist it.
// ============================================================

// ============================================================
// CONFIG — keep identical to home_sections_widget.dart
// ============================================================

/// The live storefront origin. No trailing slash.
const String _kApiBaseUrl = 'https://kandiug.com';

// No page-name constants. Every destination is a FlutterFlow Action parameter
// on the widget — see the note on the constructor.

// ============================================================
// BRAND — matched to app/globals.css
// ============================================================

const Color _kPrimary = Color(0xFFFF6A00);
const Color _kPrimarySoft = Color(0xFFFFF3E8);

/// Darkened orange that clears 4.6:1 with white text.
///
/// White on #ff6a00 is only 2.9:1, so small labels on an orange fill use this.
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

/// The search field ground — same token as the home screen.
const Color _kSearchBg = Color(0xFFF3F4F6);

/// Delivery and fulfilment only, never a brand accent.
const Color _kSuccess = Color(0xFF16A34A);

const Color _kWhite = Colors.white;
const Color _kPage = Colors.white;

/// At or below this many units the card says how few are left.
/// The same threshold as the website's LOW_STOCK_AT.
const int _kLowStockAt = 5;

// ============================================================
// CARD METRICS
// ============================================================
//
// Kept deliberately identical to the block of the same name in
// `home_sections_widget.dart`, because these two custom widgets render the
// same product tile on two different screens and a shopper moving between
// them must not be able to tell.
//
// FlutterFlow gives custom widgets no shared library to import from — each is
// a standalone paste — so the duplication is forced rather than chosen. If you
// change a number here, change it there too.
//
// The tile is a square photograph with a text block of FIXED height under it,
// so its height is arithmetic rather than a guessed aspect ratio:
//
//     tile height = tile width (the square image) + _kCardTextHeight

/// The tile's corner radius. 10 rather than the app's usual 8, matching the
/// website.
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

/// One logical pixel of slack, so a tile is never a hair shorter than its own
/// content and Flutter never paints its overflow hazard bar across the bottom
/// of it. See the note in `home_sections_widget.dart`.
const double _kCardSlack = 1;

/// Everything below the photograph, which is the figure the grid needs.
const double _kCardTextHeight = _kCardGap +
    _kCardNameHeight +
    _kCardPriceHeight +
    _kCardMetaHeight + // rating and units sold
    _kCardMetaHeight + // the delivery promise
    _kCardSlack;

// ============================================================
// TYPE — Inter, matching the website (see home_sections_widget.dart)
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

/// Section subtitle — 600 in the body colour, matching the website.
TextStyle _subtitle({double size = 13.5}) => GoogleFonts.inter(
      fontSize: size,
      fontWeight: FontWeight.w600,
      color: _kBody,
      height: 1.4,
      letterSpacing: size * -0.006,
    );

TextStyle _price({double size = 15, Color color = _kInk}) =>
    GoogleFonts.inter(
      fontSize: size,
      fontWeight: FontWeight.w700,
      color: color,
      height: 1.1,
      letterSpacing: size * -0.008,
      fontFeatures: const [ui.FontFeature.tabularFigures()],
    );

TextStyle _struck({double size = 12}) => GoogleFonts.inter(
      fontSize: size,
      fontWeight: FontWeight.w500,
      color: _kFaint,
      decoration: TextDecoration.lineThrough,
      decorationColor: _kFaint,
      fontFeatures: const [ui.FontFeature.tabularFigures()],
    );

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
// MODELS — mirror app/api/app/products/route.ts
// ============================================================

/// A product exactly as the API sends it.
///
/// Read defensively throughout: a thrown exception in `fromJson` would take
/// down the whole grid over one malformed row, and a screen with a gap in it
/// is better than a red error box.
class _Product {
  final int id;
  final String name;
  final String slug;
  final String image;
  final String priceLabel;
  final String? wasPriceLabel;
  final String? savingLabel;
  final int? stockQuantity;
  final String? categoryName;
  final bool isNew;
  final int discountPercent;
  final bool inStock;
  final double rating;
  final int ratingCount;
  final int totalSales;

  const _Product({
    required this.id,
    required this.name,
    required this.slug,
    required this.image,
    required this.priceLabel,
    required this.wasPriceLabel,
    required this.savingLabel,
    required this.stockQuantity,
    required this.categoryName,
    required this.isNew,
    required this.discountPercent,
    required this.inStock,
    required this.rating,
    required this.ratingCount,
    required this.totalSales,
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

  factory _Product.fromJson(Map<String, dynamic> j) => _Product(
        id: _toInt(j['id']),
        name: (j['name'] ?? '').toString(),
        slug: (j['slug'] ?? '').toString(),
        image: (j['image'] ?? '').toString(),
        priceLabel: (j['priceLabel'] ?? '').toString(),
        wasPriceLabel: j['wasPriceLabel']?.toString(),
        savingLabel: j['savingLabel']?.toString(),
        stockQuantity:
            j['stockQuantity'] == null ? null : _toInt(j['stockQuantity']),
        categoryName: j['categoryName']?.toString(),
        isNew: j['isNew'] == true,
        discountPercent: _toInt(j['discountPercent']),
        inStock: j['inStock'] != false,
        rating: _toDouble(j['rating']),
        ratingCount: _toInt(j['ratingCount']),
        totalSales: _toInt(j['totalSales']),
      );
}

/// A child category, for the subcategory chip row.
class _Subcategory {
  final String name;
  final String slug;
  final int count;

  const _Subcategory({
    required this.name,
    required this.slug,
    required this.count,
  });

  factory _Subcategory.fromJson(Map<String, dynamic> j) => _Subcategory(
        name: (j['name'] ?? '').toString(),
        slug: (j['slug'] ?? '').toString(),
        count: _Product._toInt(j['count']),
      );
}

/// A real department from the shop's catalogue, with its children.
class _Department {
  final String name;
  final String slug;
  final int count;
  final List<_Subcategory> children;

  const _Department({
    required this.name,
    required this.slug,
    required this.count,
    required this.children,
  });

  factory _Department.fromJson(Map<String, dynamic> j) {
    final raw = j['children'];
    return _Department(
      name: (j['name'] ?? '').toString(),
      slug: (j['slug'] ?? '').toString(),
      count: _Product._toInt(j['count']),
      children: raw is List
          ? raw
              .whereType<Map>()
              .map((e) =>
                  _Subcategory.fromJson(Map<String, dynamic>.from(e)))
              .toList()
          : const [],
    );
  }
}

/// One page of the catalogue.
class _Catalogue {
  final List<_Department> departments;
  final List<_Product> products;
  final int total;
  final int totalPages;
  final int page;

  /// Returns window, for the trust strip. Straight from the shop's settings so
  /// it can never contradict the checkout — same value the home screen shows.
  final int returnsDays;

  const _Catalogue({
    required this.departments,
    required this.products,
    required this.total,
    required this.totalPages,
    required this.page,
    required this.returnsDays,
  });

  static List<T> _list<T>(dynamic raw, T Function(Map<String, dynamic>) make) {
    if (raw is! List) return const [];
    return raw
        .whereType<Map>()
        .map((e) => make(Map<String, dynamic>.from(e)))
        .toList();
  }

  factory _Catalogue.fromJson(Map<String, dynamic> j) {
    final commerce = (j['commerce'] as Map?) ?? const {};
    return _Catalogue(
      departments: _list(j['departments'], _Department.fromJson),
      products: _list(j['products'], _Product.fromJson),
      total: _Product._toInt(j['total']),
      totalPages: _Product._toInt(j['totalPages']),
      page: _Product._toInt(j['page']),
      returnsDays: _Product._toInt(commerce['returnsDays']),
    );
  }
}

// ============================================================
// SHIMMER / PRESS
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

class _Press extends StatefulWidget {
  final Widget child;
  final VoidCallback? onTap;
  const _Press({required this.child, this.onTap});

  /// Every press on this screen depresses by the same amount.
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
      // The press tick, on the way down — see the long note on the home
      // screen's `_Press`. Here rather than in each handler because this is the
      // one place that catches every control on the page, including the ones
      // added after somebody stops remembering to add haptics by hand.
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

class CategoryNavigationMenu extends StatefulWidget {
  /// ---- Navigation is Actions ----
  ///
  /// Every destination is a FlutterFlow ACTION parameter wired in the action
  /// editor, not a page name typed as a String. FlutterFlow knows whether a
  /// page takes path or query parameters and a string does not carry that; a
  /// renamed page silently kills a string parameter and cannot kill an Action;
  /// and an Action can update App State or show a dialog on the way, which a
  /// route name can never do.
  ///
  /// All optional. A null Action is a control this project chose not to wire,
  /// and does nothing — quiet rather than crashing.
  const CategoryNavigationMenu({
    super.key,
    this.width,
    this.height,
    this.initialDepartment,
    this.initialSort,
    this.initialSaleOnly = false,
    this.initialMaxPrice,
    this.initialMinDiscount,
    this.initialTitle,
    this.onProductTap,
    this.onHomeTap,
    this.onSearchTap,
    this.onCartTap,
    this.onWishlistTap,
    this.onProfileTap,
  });

  final double? width;
  final double? height;

  /// ---- The opening filter, set in code and not in FlutterFlow ----
  ///
  /// These six are NOT parameters to declare in the Custom Widget panel. They
  /// exist because the home screen pushes this page itself —
  /// `CategoryNavigationMenu(initialSaleOnly: true, initialMinDiscount: 50)` —
  /// and a typed Dart argument is the whole point of doing it that way: it
  /// cannot be misspelled, it cannot drift from a page parameter declared
  /// somewhere else, and the compiler checks it.
  ///
  /// All are optional and all fall back to what this screen has always done:
  /// the whole catalogue, newest first. A deep link through the route still
  /// works and still wins where it says something — see `_readInitialCategory`.
  ///
  /// Department slug, e.g. `mens-fashion`. Empty or null means everything.
  final String? initialDepartment;

  /// `newest` | `price_asc` | `price_desc` | `discount` | `popular`.
  final String? initialSort;

  /// Restricts to reduced products.
  final bool initialSaleOnly;

  /// A ceiling in shillings — what "Under UGX 50,000" sends.
  final double? initialMaxPrice;

  /// Whole percent. What the "50% off" entry point sends, and deliberately not
  /// `initialSaleOnly`: "reduced at all" is a different promise from "half
  /// price", and only one of them is written on the button.
  final int? initialMinDiscount;

  /// What to call this view at the top of the screen — "Promotions", "Under
  /// UGX 50,000". Null falls back to the department name, as before.
  final String? initialTitle;

  /// Opening a product. Receives the slug when there is one — what the
  /// website's own URLs use — and the numeric id, so either can be passed on.
  ///
  /// Left in place for projects that wired it, but no longer how this screen
  /// opens a product: when it is null the page pushes `ProductDetailPage`
  /// itself, which is what the home screen and the basket now do too.
  final Future Function(String productId, String slug)? onProductTap;

  final Future Function()? onHomeTap;
  final Future Function()? onSearchTap;
  final Future Function()? onCartTap;
  final Future Function()? onWishlistTap;
  final Future Function()? onProfileTap;

  @override
  State<CategoryNavigationMenu> createState() => _CategoryNavigationMenuState();
}

class _CategoryNavigationMenuState extends State<CategoryNavigationMenu> {
  // Identical to the home screen, so the two pages share a gutter and a corner
  // radius rather than being a pixel or two apart everywhere.
  static const double _pad = 12.0;
  static const double _radius = 8.0;

  final ScrollController _scroll = ScrollController();

  /// Back-to-top, same as home.
  bool _showTop = false;

  /// The rotating placeholder in the search pill — the same list home uses, so
  /// the two screens' search fields behave identically.
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

  _Catalogue? _catalogue;
  bool _loading = true;
  bool _loadingMore = false;
  String? _error;

  /// Empty means "All".
  String _department = '';
  String? _subcategory;
  String _sort = 'newest';
  bool _saleOnly = false;
  bool _inStockOnly = false;
  bool _showFilters = false;

  /// The two narrowings the home screen's quick picks arrive with. Null means
  /// unrestricted, and both can be cleared from the banner the page draws when
  /// either is set — a filtered listing that gives no way back out reads as an
  /// empty catalogue rather than a filtered one.
  double? _maxPrice;
  int? _minDiscount;

  int _page = 1;
  final List<_Product> _products = [];

  /// The saved-items list, shared with every other screen.
  ///
  /// It was a `Set<int>` living for the length of this screen's life, which
  /// meant a heart tapped here was forgotten the moment the shopper went back —
  /// and disagreed with the saved-items page while they were both open. The
  /// store is the one in `cart_widget.dart`, on the website's own storage key.
  Set<int> _wishlisted = <int>{};

  /// Badge on the cart icon, read live from the shared basket.
  int _cartCount = 0;

  /// Guards against a slow response for a tab the shopper has already left.
  int _requestToken = 0;

  /// `didChangeDependencies` runs on every dependency change; the route only
  /// needs reading once.
  bool _routeRead = false;

  @override
  void initState() {
    super.initState();
    _scroll.addListener(_onScroll);

    // The opening filter, from whoever pushed this page. Applied before the
    // first fetch so the screen never shows the whole catalogue for a frame and
    // then narrows — which reads as the filter having failed and then caught
    // up.
    final department = widget.initialDepartment;
    if (department != null && department.isNotEmpty && department != 'all') {
      _department = department;
    }
    final sort = widget.initialSort;
    if (sort != null && sort.isNotEmpty) _sort = sort;
    _saleOnly = widget.initialSaleOnly;
    _maxPrice = widget.initialMaxPrice;
    _minDiscount = widget.initialMinDiscount;

    _syncStores();

    _hintTimer = Timer.periodic(const Duration(seconds: 2), (_) {
      if (mounted) {
        setState(() => _hintIndex = (_hintIndex + 1) % _hints.length);
      }
    });
    // The first load is kicked off from didChangeDependencies, not here — see
    // the note there. Starting it in initState would fetch "all products"
    // before the route had been read, then fetch again, showing the wrong
    // department for a beat.
  }

  /// Reads the route, then starts the first load.
  ///
  /// This has to happen here rather than in `initState`. `GoRouterState.of`
  /// performs an inherited-widget lookup, which Flutter forbids during
  /// `initState` — it throws, and because the call is wrapped in a `try` the
  /// throw was silently swallowed. The visible symptom was that deep-linking
  /// never worked at all: every route into this page opened on "All" whatever
  /// category was passed, which defeats the entire point of reading the route
  /// instead of taking a parameter.
  ///
  /// `didChangeDependencies` is the first callback where inherited widgets are
  /// safe to read, and it always runs before the first build.
  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_routeRead) return;
    _routeRead = true;

    _readInitialCategory();
    _load(reset: true);
  }

  @override
  void dispose() {
    _scroll.removeListener(_onScroll);
    _scroll.dispose();
    _hintTimer?.cancel();
    super.dispose();
  }

  /// Replaces the old `initialCategory` parameter.
  ///
  /// Read from the page's own route parameters instead, so deep-linking into a
  /// department still works without the widget taking a parameter. Add a
  /// `category` (and optionally `sub`) page parameter in FlutterFlow and pass
  /// the slug when navigating here.
  ///
  /// Both spellings are accepted for each: FlutterFlow passes page parameters
  /// as path or query depending on how the route is declared, and a deep link
  /// that silently opens the wrong department is worse than a slightly wider
  /// net here.
  void _readInitialCategory() {
    try {
      final state = GoRouterState.of(context);

      String? read(String key) =>
          state.pathParameters[key] ?? state.uri.queryParameters[key];

      final category = read('category') ?? read('slug');
      final sub = read('sub') ?? read('subcategory');

      // An explicit `initialDepartment` wins. When this page was pushed in code
      // with a department, that is the more specific instruction — the route
      // underneath it is whatever page happened to be showing, and letting it
      // overwrite the argument would send a tap on "Men" to wherever the
      // shopper already was.
      final pushed = widget.initialDepartment;
      final pushedDepartment =
          pushed != null && pushed.isNotEmpty && pushed != 'all';

      if (!pushedDepartment &&
          category != null &&
          category.isNotEmpty &&
          category != 'all') {
        _department = category;
      }
      if (sub != null && sub.isNotEmpty) _subcategory = sub;
    } catch (e) {
      // No router in the tree — the widget is being previewed in isolation, or
      // the page declares no such parameter. Opening on "All" is the right
      // default. Logged rather than swallowed, because this silently hiding a
      // real failure is exactly what went wrong before.
      debugPrint('Kandi: no route parameters to read ($e)');
    }
  }

  void _onScroll() {
    final show = _scroll.offset > 500;
    if (show != _showTop) setState(() => _showTop = show);

    if (_loadingMore || _loading) return;
    final c = _catalogue;
    if (c == null || _page >= c.totalPages) return;

    // 600px of runway, so the next page is usually already in hand by the time
    // the shopper reaches the bottom.
    if (_scroll.position.pixels >= _scroll.position.maxScrollExtent - 600) {
      _loadMore();
    }
  }

  void _toTop() {
    HapticFeedback.mediumImpact();
    _scroll.animateTo(
      0,
      duration: const Duration(milliseconds: 400),
      curve: Curves.easeOut,
    );
  }

  // ---------- Data ----------

  String get _base => _kApiBaseUrl.replaceAll(RegExp(r'/+$'), '');

  Uri _endpoint(int page) {
    final params = <String, String>{
      'page': '$page',
      'sort': _sort,
      // The subcategory is the narrower of the two, so it wins when set.
      'category': _subcategory ?? (_department.isEmpty ? 'all' : _department),
    };
    if (_saleOnly) params['sale'] = '1';
    if (_inStockOnly) params['stock'] = '1';
    // Whole shillings: the endpoint parses these with `Number`, and "50000.0"
    // is a needless way to find out whether it copes.
    if (_maxPrice != null && _maxPrice! > 0) {
      params['max_price'] = _maxPrice!.round().toString();
    }
    // Not the same as `sale=1`, and deliberately so — see `initialMinDiscount`.
    if (_minDiscount != null && _minDiscount! > 0) {
      params['min_discount'] = '${_minDiscount!}';
    }

    return Uri.parse('$_base/api/app/products')
        .replace(queryParameters: params);
  }

  Future<Map<String, dynamic>> _fetch(int page) async {
    final response = await http
        .get(_endpoint(page), headers: const {'Accept': 'application/json'})
        .timeout(const Duration(seconds: 20));

    if (response.statusCode != 200) {
      throw _HttpFailure('Server returned ${response.statusCode}');
    }

    final decoded = jsonDecode(utf8.decode(response.bodyBytes));
    if (decoded is! Map) throw const FormatException('Unexpected payload');
    return Map<String, dynamic>.from(decoded);
  }

  Future<void> _load({bool reset = false}) async {
    if (!mounted) return;

    // Every load takes a ticket. A response whose ticket is no longer the
    // current one is discarded: without this, tapping three tabs quickly can
    // leave the grid showing whichever request happened to finish last rather
    // than the tab actually selected.
    final token = ++_requestToken;

    setState(() {
      _loading = true;
      _error = null;
      // The grid is about to be replaced by the shimmer, which starts at the
      // top — so a back-to-top button left over from the previous scroll
      // position would be floating over content that cannot scroll.
      _showTop = false;
      if (reset) {
        _page = 1;
        _products.clear();
      }
    });

    try {
      final data = await _fetch(1);
      if (!mounted || token != _requestToken) return;

      final catalogue = _Catalogue.fromJson(data);
      setState(() {
        _catalogue = catalogue;
        _products
          ..clear()
          ..addAll(catalogue.products);
        _page = 1;
        _loading = false;
      });
    } catch (e) {
      debugPrint('Kandi catalogue load failed: $e');
      if (!mounted || token != _requestToken) return;
      setState(() {
        _loading = false;
        _error = 'Could not reach the shop. Check your connection.';
      });
    }
  }

  Future<void> _loadMore() async {
    final c = _catalogue;
    if (c == null || _loadingMore || _page >= c.totalPages) return;

    final token = _requestToken;
    setState(() => _loadingMore = true);

    try {
      final data = await _fetch(_page + 1);
      if (!mounted || token != _requestToken) return;

      final next = _Catalogue.fromJson(data);
      setState(() {
        _products.addAll(next.products);
        _page += 1;
        _loadingMore = false;
      });
    } catch (e) {
      debugPrint('Kandi page $_page load failed: $e');
      if (!mounted || token != _requestToken) return;
      setState(() => _loadingMore = false);
    }
  }

  // ---------- Navigation ----------

  /// Runs one of the navigation Actions.
  ///
  /// v2 took action callbacks; v3 replaced them with page names and had to
  /// guess whether a page wanted path or query parameters — catching a throw
  /// and retrying. This is back to Actions, which is where it should have
  /// stayed: FlutterFlow does the navigating and already knows the answer.
  void _run(Future Function()? action) {
    if (action == null) return;
    HapticFeedback.lightImpact();
    action();
  }

  /// Opens a product — in code, unless the project wired the old Action.
  ///
  /// `kandiOpenProduct` lives in `cart_widget.dart` and pushes
  /// `ProductDetailPage` directly, wiring its related rail and its cart icon on
  /// the way. The id is a typed Dart argument rather than a string that has to
  /// be declared on a destination page, spelled the same in the action editor
  /// and kept in step with this file — three places to get one string wrong,
  /// and the failure mode is a blank product page rather than a compile error.
  void _openProduct(_Product p) {
    HapticFeedback.lightImpact();
    final id = p.slug.isNotEmpty ? p.slug : p.id.toString();

    final action = widget.onProductTap;
    if (action != null) {
      action(id, p.slug);
      return;
    }
    kandiOpenProduct(context, id);
  }

  /// The basket, in code, falling back to the tab's Action when one is wired.
  void _openCart() {
    HapticFeedback.lightImpact();
    if (widget.onCartTap != null) {
      widget.onCartTap!();
      return;
    }
    Navigator.of(context).push(
      MaterialPageRoute<void>(builder: (_) => const ShoppingCartPage()),
    );
  }

  /// Saved items, the same way.
  void _openWishlist() {
    HapticFeedback.lightImpact();
    if (widget.onWishlistTap != null) {
      widget.onWishlistTap!();
      return;
    }
    Navigator.of(context)
        .push(MaterialPageRoute<void>(builder: (_) => const WishlistPage()))
        .then((_) => _syncStores());
  }

  /// Re-reads the shared basket and saved list.
  ///
  /// Called on open and again whenever this screen comes back from one of
  /// them, because both can be changed while it is off screen and a stale
  /// heart or badge is the visible half of the bug that had this screen
  /// keeping its own private wishlist.
  Future<void> _syncStores() async {
    final saved = await KandiWishlist.load(force: true);
    await KandiCart.load(force: true);
    if (!mounted) return;
    setState(() {
      _wishlisted = saved.map((i) => i.productId).toSet();
      _cartCount = KandiCart.itemCount;
    });
  }

  Future<void> _toggleWishlist(_Product p) async {
    HapticFeedback.lightImpact();
    final nowSaved = await KandiWishlist.toggle(KandiWishlistItem(
      productId: p.id,
      name: p.name,
      image: p.image,
      // The tile only ever carries the formatted label — every price on this
      // screen is formatted server-side so the app and the site cannot disagree
      // about a separator — so the digits are read back out of it. The saved
      // list re-prices itself from the shop on open in any case.
      price: kandiPriceFromLabel(p.priceLabel),
      slug: p.slug,
    ));
    if (!mounted) return;
    setState(() {
      if (nowSaved) {
        _wishlisted.add(p.id);
      } else {
        _wishlisted.remove(p.id);
      }
    });
  }

  // ---------- Selection ----------

  void _selectDepartment(String slug) {
    if (slug == _department && _subcategory == null) return;
    HapticFeedback.selectionClick();
    setState(() {
      _department = slug;
      _subcategory = null;
    });
    _load(reset: true);
  }

  void _selectSubcategory(String? slug) {
    if (slug == _subcategory) return;
    HapticFeedback.selectionClick();
    setState(() => _subcategory = slug);
    _load(reset: true);
  }

  void _clearFilters() {
    setState(() {
      _sort = 'newest';
      _saleOnly = false;
      _inStockOnly = false;
      _subcategory = null;
    });
    _load(reset: true);
  }

  bool get _hasActiveFilters =>
      _sort != 'newest' || _saleOnly || _inStockOnly || _subcategory != null;

  List<_Subcategory> get _currentSubcategories {
    final c = _catalogue;
    if (c == null || _department.isEmpty) return const [];
    for (final d in c.departments) {
      if (d.slug == _department) return d.children;
    }
    return const [];
  }

  /// True while one of the narrowings this page was pushed with is still on.
  ///
  /// It stops being true the moment the shopper clears it from the banner, and
  /// the title falls back to the department — because "50% off" over a listing
  /// that is no longer restricted to half price would be a label describing the
  /// button that was tapped rather than the products on screen.
  bool get _hasPushedFilter =>
      (_maxPrice != null && _maxPrice! > 0) ||
      (_minDiscount != null && _minDiscount! > 0) ||
      (_saleOnly && widget.initialSaleOnly);

  /// The label for the narrowing, in the shopper's words.
  String? get _pushedFilterLabel {
    if (_minDiscount != null && _minDiscount! > 0) {
      return '${_minDiscount!}% off or more';
    }
    if (_maxPrice != null && _maxPrice! > 0) {
      return 'Under ${_ugx(_maxPrice!)}';
    }
    if (_saleOnly && widget.initialSaleOnly) return 'Reduced items only';
    return null;
  }

  /// `UGX 50,000`, matching the server's formatter.
  ///
  /// The only figure this screen formats itself: every price on a tile arrives
  /// already formatted, but a ceiling the app was handed as a number has to be
  /// written out here.
  String _ugx(double amount) {
    final digits = amount.round().toString();
    final out = StringBuffer();
    for (var i = 0; i < digits.length; i++) {
      if (i > 0 && (digits.length - i) % 3 == 0) out.write(',');
      out.write(digits[i]);
    }
    return 'UGX $out';
  }

  /// Clears whatever this page was opened with, and reloads.
  ///
  /// The way back out. A filtered listing with no visible filter and no way to
  /// widen it reads as a shop with four products in it, and the shopper's next
  /// move is to close the app rather than to look further.
  void _clearPushedFilter() {
    HapticFeedback.lightImpact();
    setState(() {
      _maxPrice = null;
      _minDiscount = null;
      if (widget.initialSaleOnly) _saleOnly = false;
    });
    _load(reset: true);
  }

  String get _title {
    // What the screen was opened as, when it was opened as something — "50%
    // off", "Under UGX 50,000". A page reached from a button should say the
    // words that were on the button; "Shop" over a half-price listing loses
    // the shopper's place.
    final pushed = widget.initialTitle;
    if (pushed != null && pushed.isNotEmpty && _hasPushedFilter) return pushed;

    if (_department.isEmpty) return 'Shop';
    final c = _catalogue;
    if (c != null) {
      for (final d in c.departments) {
        if (d.slug == _department) return d.name;
      }
    }
    // Falls back to the slug made readable, for the moment before the first
    // response lands.
    return _department.replaceAll('-', ' ');
  }

  String get _sortLabel {
    switch (_sort) {
      case 'price_asc':
        return 'Price ↑';
      case 'price_desc':
        return 'Price ↓';
      case 'discount':
        return 'Biggest saving';
      default:
        return 'Newest';
    }
  }

  /// "2.2K sold" — the compact form the website prints beside a price.
  ///
  /// Real sales only; neither screen invents social proof.
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
  // has been removed along with it, matching the website tile and the home
  // screen: prefixed to a name row that is now a fixed two lines, it ate about
  // six characters of a title that was already being ellipsised.

  // ============================================================
  // BUILD
  // ============================================================
  @override
  Widget build(BuildContext context) {
    // Laid out in the same order as the home screen — masthead, search pill,
    // departments, trust strip, then the merchandise — so moving between the
    // two pages does not feel like moving between two apps. The one structural
    // difference is deliberate: the tabs, chips and toolbar stay pinned above
    // the grid rather than scrolling away, because on a category page they are
    // the controls the shopper came to use.
    return Container(
      width: widget.width ?? double.infinity,
      height: widget.height ?? double.infinity,
      color: _kPage,
      child: Stack(
        children: [
          Positioned.fill(
            child: Column(
              children: [
                _header(),
                _searchArea(),
                // Only present when this page was opened as "50% off" or
                // "Under UGX 50,000" — and it is the way back out of that.
                if (_hasPushedFilter) _pushedFilterBanner(),
                _departmentTabs(),
                if (_currentSubcategories.isNotEmpty) _subcategoryChips(),
                _trustStrip(),
                if (_showFilters) _filterPanel(),
                _toolbar(),
                Expanded(
                  child: _error != null
                      ? _errorState()
                      : _loading
                          ? _shimmerGrid()
                          : _productGrid(),
                ),
                _bottomNav(),
              ],
            ),
          ),
          if (_showTop)
            Positioned(
              right: _pad,
              bottom: 94,
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
        ],
      ),
    );
  }

  // ---------- Header ----------
  Widget _header() => SafeArea(
        bottom: false,
        child: SizedBox(
          height: 56,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: _pad),
            child: Row(
              children: [
                _Press(
                  onTap: () {
                    HapticFeedback.lightImpact();
                    if (Navigator.of(context).canPop()) {
                      Navigator.of(context).pop();
                    } else {
                      _run(widget.onHomeTap);
                    }
                  },
                  child: Container(
                    width: 38,
                    height: 38,
                    decoration: BoxDecoration(
                      color: _kWhite,
                      shape: BoxShape.circle,
                      border: Border.all(color: _kLine),
                    ),
                    child: const Icon(Icons.arrow_back_ios_new_rounded,
                        color: _kInk, size: 15),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    _title,
                    style: _heading(size: 20),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
                // The same two badged icons the home screen carries, in the
                // same order. Search moved out of here and into the pill
                // below, which is where it lives on home.
                _circleIcon(
                  icon: Icons.favorite_border_rounded,
                  badge: _wishlisted.length,
                  onTap: _openWishlist,
                ),
                const SizedBox(width: 8),
                _circleIcon(
                  icon: Icons.shopping_bag_outlined,
                  badge: _cartCount,
                  onTap: _openCart,
                ),
              ],
            ),
          ),
        ),
      );

  /// The narrowing this page was opened with, and a way to drop it.
  Widget _pushedFilterBanner() {
    final label = _pushedFilterLabel;
    if (label == null) return const SizedBox.shrink();

    return Padding(
      padding: const EdgeInsets.fromLTRB(_pad, 0, _pad, 8),
      child: Container(
        padding: const EdgeInsets.fromLTRB(11, 7, 7, 7),
        decoration: BoxDecoration(
          color: _kPrimarySoft,
          borderRadius: BorderRadius.circular(_radius),
        ),
        child: Row(
          children: [
            const Icon(Icons.filter_alt_rounded, size: 15, color: _kPrimaryInk),
            const SizedBox(width: 7),
            Expanded(
              child: Text(
                'Showing $label',
                style: _label(
                  size: 12.5,
                  color: _kPrimaryInk,
                  weight: FontWeight.w700,
                ),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ),
            _Press(
              onTap: _clearPushedFilter,
              child: Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
                decoration: BoxDecoration(
                  color: _kWhite,
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      'Clear',
                      style: _label(
                        size: 12,
                        color: _kInk,
                        weight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(width: 3),
                    const Icon(Icons.close_rounded, size: 13, color: _kInk),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  /// Badged circle icon — identical to the home screen's.
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

  /// The same pill the home screen uses, down to the rotating placeholder.
  ///
  /// It is a button rather than a field on both screens: tapping it opens the
  /// dedicated search page, so there is one search experience rather than two
  /// half-implementations.
  Widget _searchArea() => Padding(
        padding: const EdgeInsets.fromLTRB(_pad, 0, _pad, 8),
        child: GestureDetector(
          onTap: () => _run(widget.onSearchTap),
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

  // ---------- Trust ----------

  /// The same three promises the home screen makes, in the same order.
  ///
  /// The returns figure comes from the shop's settings rather than being typed
  /// here, so the app cannot promise a window the checkout will not honour.
  /// Hidden until the first response, rather than briefly showing "0-day
  /// returns".
  Widget _trustStrip() {
    final days = _catalogue?.returnsDays ?? 0;
    if (days <= 0) return const SizedBox.shrink();

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
      margin: const EdgeInsets.fromLTRB(_pad, 6, _pad, 6),
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
          item(Icons.assignment_return_outlined, '$days-day returns'),
        ],
      ),
    );
  }

  // ---------- Section heading ----------

  /// Title over bold subtitle — the treatment the website added and the home
  /// screen carries. A subtitle at the body weight reads as a caption the eye
  /// skips; at 600 it reads as the line it is.
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

  // ---------- Department tabs ----------
  Widget _departmentTabs() {
    final departments = _catalogue?.departments ?? const <_Department>[];

    // Nothing to show until the first response. An empty strip is better than
    // a row of invented department names that may not exist.
    if (departments.isEmpty) {
      return const SizedBox(height: 1, child: ColoredBox(color: _kLine));
    }

    return Container(
      height: 44,
      decoration: const BoxDecoration(
        border: Border(bottom: BorderSide(color: _kLine)),
      ),
      child: ListView.builder(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 6),
        itemCount: departments.length + 1,
        itemBuilder: (_, i) {
          final isAll = i == 0;
          final slug = isAll ? '' : departments[i - 1].slug;
          final name = isAll ? 'All' : departments[i - 1].name;
          final active = slug == _department;

          return GestureDetector(
            onTap: () => _selectDepartment(slug),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 14),
              alignment: Alignment.center,
              decoration: BoxDecoration(
                border: Border(
                  bottom: BorderSide(
                    color: active ? _kPrimary : Colors.transparent,
                    width: 2.5,
                  ),
                ),
              ),
              child: Text(
                name,
                style: _text(
                  size: 13.5,
                  weight: active ? FontWeight.w700 : FontWeight.w500,
                  color: active ? _kInk : _kMuted,
                ),
              ),
            ),
          );
        },
      ),
    );
  }

  // ---------- Subcategory chips ----------
  Widget _subcategoryChips() {
    final subs = _currentSubcategories;

    return Container(
      height: 46,
      decoration: const BoxDecoration(
        border: Border(bottom: BorderSide(color: _kLine)),
      ),
      child: ListView.builder(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.fromLTRB(10, 8, 10, 8),
        itemCount: subs.length + 1,
        itemBuilder: (_, i) {
          if (i == 0) {
            return Padding(
              padding: const EdgeInsets.only(right: 7),
              child: _chip(
                label: 'All $_title',
                active: _subcategory == null,
                onTap: () => _selectSubcategory(null),
              ),
            );
          }

          final sub = subs[i - 1];
          return Padding(
            padding: const EdgeInsets.only(right: 7),
            child: _chip(
              label: sub.name,
              active: _subcategory == sub.slug,
              onTap: () => _selectSubcategory(sub.slug),
            ),
          );
        },
      ),
    );
  }

  Widget _chip({
    required String label,
    required bool active,
    required VoidCallback onTap,
  }) =>
      GestureDetector(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 14),
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: active ? _kPrimarySoft : _kWhite,
            borderRadius: BorderRadius.circular(18),
            border: Border.all(color: active ? _kPrimary : _kLine),
          ),
          child: Text(
            label,
            style: _text(
              size: 12.5,
              weight: active ? FontWeight.w700 : FontWeight.w500,
              // The darkened orange, because this is a small label on a tint.
              color: active ? _kPrimaryInk : _kBody,
            ),
          ),
        ),
      );

  // ---------- Toolbar ----------
  Widget _toolbar() {
    final total = _catalogue?.total ?? 0;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: _pad, vertical: 7),
      decoration: const BoxDecoration(
        border: Border(bottom: BorderSide(color: _kLine)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          // The home screen's title-over-bold-subtitle treatment, so the
          // results header on this page reads the same as a rail heading
          // there rather than as a bare line of grey text.
          Expanded(
            child: _sectionHeading(
              _department.isEmpty ? 'All products' : _title,
              _loading
                  ? 'Loading…'
                  : '$total ${total == 1 ? 'item' : 'items'}'
                      '${_hasActiveFilters ? ' · filtered' : ''}',
            ),
          ),
          const SizedBox(width: 8),
          _toolbarButton(
            icon: Icons.sort_rounded,
            label: _sortLabel,
            active: _sort != 'newest',
            onTap: _showSortSheet,
            trailing: Icons.keyboard_arrow_down_rounded,
          ),
          const SizedBox(width: 8),
          _toolbarButton(
            icon: Icons.tune_rounded,
            label: 'Filter',
            active: _hasActiveFilters,
            onTap: () => setState(() => _showFilters = !_showFilters),
          ),
        ],
      ),
    );
  }

  Widget _toolbarButton({
    required IconData icon,
    required String label,
    required bool active,
    required VoidCallback onTap,
    IconData? trailing,
  }) =>
      GestureDetector(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
          decoration: BoxDecoration(
            color: active ? _kPrimarySoft : _kWhite,
            border: Border.all(color: active ? _kPrimary : _kLine),
            borderRadius: BorderRadius.circular(_radius),
          ),
          child: Row(
            children: [
              Icon(icon, size: 14, color: active ? _kPrimaryInk : _kBody),
              const SizedBox(width: 5),
              Text(
                label,
                style: _label(
                  size: 11.5,
                  color: active ? _kPrimaryInk : _kInk,
                  weight: FontWeight.w700,
                ),
              ),
              if (trailing != null)
                Icon(trailing, size: 14, color: _kMuted),
            ],
          ),
        ),
      );

  // ---------- Filter panel ----------
  Widget _filterPanel() => Container(
        padding: const EdgeInsets.all(14),
        decoration: const BoxDecoration(
          color: _kSurface,
          border: Border(bottom: BorderSide(color: _kLine)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text('Filters', style: _heading(size: 16)),
                GestureDetector(
                  onTap: _clearFilters,
                  child: Text(
                    'Clear all',
                    style: _label(
                      size: 12.5,
                      color: _kPrimaryInk,
                      weight: FontWeight.w700,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 10),
            _switchRow(
              icon: Icons.local_offer_outlined,
              label: 'Reduced items only',
              value: _saleOnly,
              onChanged: (v) {
                setState(() => _saleOnly = v);
                _load(reset: true);
              },
            ),
            const SizedBox(height: 8),
            _switchRow(
              icon: Icons.inventory_2_outlined,
              label: 'In stock only',
              value: _inStockOnly,
              onChanged: (v) {
                setState(() => _inStockOnly = v);
                _load(reset: true);
              },
            ),
            const SizedBox(height: 12),
            _Press(
              onTap: () => setState(() => _showFilters = false),
              child: Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(vertical: 13),
                decoration: BoxDecoration(
                  color: _kPrimary,
                  borderRadius: BorderRadius.circular(_radius),
                ),
                child: Center(
                  child: Text(
                    'Done',
                    style: _label(
                      size: 13.5,
                      color: _kWhite,
                      weight: FontWeight.w800,
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
      );

  Widget _switchRow({
    required IconData icon,
    required String label,
    required bool value,
    required ValueChanged<bool> onChanged,
  }) =>
      Container(
        padding: const EdgeInsets.symmetric(horizontal: 12),
        decoration: BoxDecoration(
          color: _kWhite,
          borderRadius: BorderRadius.circular(_radius),
          border: Border.all(color: _kLine),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Row(
              children: [
                Icon(icon, size: 16, color: _kPrimaryInk),
                const SizedBox(width: 8),
                Text(label, style: _text(size: 13.5, color: _kInk)),
              ],
            ),
            Transform.scale(
              scale: 0.85,
              child: Switch(
                value: value,
                onChanged: onChanged,
                activeThumbColor: _kWhite,
                activeTrackColor: _kPrimary,
              ),
            ),
          ],
        ),
      );

  // ---------- Sort sheet ----------
  void _showSortSheet() {
    showModalBottomSheet<void>(
      context: context,
      backgroundColor: _kWhite,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(18)),
      ),
      builder: (_) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 10),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 36,
                height: 4,
                margin: const EdgeInsets.only(bottom: 14),
                decoration: BoxDecoration(
                  color: _kLine,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              Text('Sort by', style: _heading(size: 17)),
              const SizedBox(height: 6),
              // Values match the website's own sort parameter exactly, so a
              // shopper who sorts in the app and then opens the site sees the
              // same order.
              _sortOption('Newest', 'newest', Icons.fiber_new_rounded),
              _sortOption('Price: low to high', 'price_asc',
                  Icons.arrow_upward_rounded),
              _sortOption('Price: high to low', 'price_desc',
                  Icons.arrow_downward_rounded),
              _sortOption('Biggest saving', 'discount',
                  Icons.local_offer_outlined),
              const SizedBox(height: 8),
            ],
          ),
        ),
      ),
    );
  }

  Widget _sortOption(String label, String value, IconData icon) {
    final active = _sort == value;
    return ListTile(
      dense: true,
      onTap: () {
        HapticFeedback.selectionClick();
        Navigator.pop(context);
        if (value == _sort) return;
        setState(() => _sort = value);
        _load(reset: true);
      },
      leading: Icon(icon, size: 20, color: active ? _kPrimaryInk : _kMuted),
      title: Text(
        label,
        style: _text(
          size: 13.5,
          weight: active ? FontWeight.w700 : FontWeight.w500,
          color: active ? _kInk : _kBody,
        ),
      ),
      trailing: active
          ? const Icon(Icons.check_rounded, color: _kPrimaryInk, size: 20)
          : null,
    );
  }

  // ---------- Grid ----------
  /// Two columns, with the aspect ratio *computed* rather than typed.
  ///
  /// It used to be `childAspectRatio: 0.50`, a number that had to be re-guessed
  /// whenever the card changed and was wrong on any screen it was not tuned
  /// against — too tall and every tile carried a band of dead space, too short
  /// and Flutter painted its overflow stripes across the bottom row.
  ///
  /// The photograph is square, so it is exactly as tall as the tile is wide,
  /// and everything under it is a known `_kCardTextHeight`. The tile's true
  /// height is therefore arithmetic and the ratio falls out of it — right on a
  /// 360px phone and on a tablet, and right again the next time a row height
  /// changes, because it is derived from the constants the card lays itself out
  /// with.
  Widget _productGrid() {
    if (_products.isEmpty) return _emptyState();

    const gutter = 8.0;
    final tileWidth = (MediaQuery.of(context).size.width - gutter * 3) / 2;
    final tileHeight = tileWidth + _kCardTextHeight;

    return RefreshIndicator(
      onRefresh: () => _load(reset: true),
      color: _kPrimary,
      backgroundColor: _kWhite,
      child: GridView.builder(
        controller: _scroll,
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(gutter, gutter, gutter, 20),
        gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
          crossAxisCount: 2,
          crossAxisSpacing: gutter,
          mainAxisSpacing: gutter,
          childAspectRatio: tileWidth / tileHeight,
        ),
        // One extra cell at the end while another page is loading.
        itemCount: _products.length + (_loadingMore ? 2 : 0),
        itemBuilder: (_, i) {
          if (i >= _products.length) {
            return _Shimmer(
              child: Container(
                decoration: BoxDecoration(
                  color: _kHairline,
                  borderRadius: BorderRadius.circular(_kCardRadius),
                ),
              ),
            );
          }
          return _card(_products[i]);
        },
      ),
    );
  }

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
  /// FOUR text rows, and always the same four, each a fixed-height `SizedBox`
  /// rather than a `Spacer`. The full argument for that — and for the square
  /// photograph and the corner flag — is written out over the same method in
  /// `home_sections_widget.dart`; in short, the conditional rows this used to
  /// render meant no two tiles were the same height, and in a grid of two
  /// columns that is a text block starting at two different places in every
  /// row.
  ///
  /// Colour is rationed as on the web: a resting price is near-black and only a
  /// discounted one turns red, green is delivery and nothing else.
  Widget _card(_Product p) {
    final wished = _wishlisted.contains(p.id);
    final soldOut = !p.inStock;
    final lowStock =
        !soldOut && p.stockQuantity != null && p.stockQuantity! <= _kLowStockAt;

    /// The website drops the struck-through original and the percentage beside
    /// the price below its `sm` breakpoint (640px). Same rule, same number, so
    /// a phone shows what the website shows on a phone.
    final wide = MediaQuery.of(context).size.width >= 640;

    return RepaintBoundary(
      child: _Press(
        onTap: () => _openProduct(p),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Square, down from 4:5. The 4:5 crop assumed a fashion catalogue;
            // this shop sells wardrobes, air pumps, curtains and milk, most of
            // it photographed square, so the taller frame was 25% empty space
            // by construction. Square also puts more rows on a phone screen,
            // and rows are the product.
            AspectRatio(
              aspectRatio: 1,
              child: Stack(
                fit: StackFit.expand,
                children: [
                  ClipRRect(
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

                  // The discount flag. Top left, opposite the always-visible
                  // heart, and it cannot collide with "Sold out" in the same
                  // corner because a sold-out product never renders a discount.
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
                          size: 15,
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
            // Exactly two lines, always — the box is a fixed 40, two times the
            // 20px leading, so a short name reserves its second line instead of
            // letting the price ride up under it.
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
                  height: 20 / 14,
                ),
              ),
            ),

            // ---- Row 2: the money ----
            // A `Row` that cannot wrap, not the `Wrap` this used to be: in a
            // fixed-height row a wrapped price is a price cut in half. On
            // narrow screens the was-price and the percentage are dropped
            // rather than squeezed, which is what the website does below `sm` —
            // the reduction is on the photograph as a flag either way.
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
            // Rendered even when empty. A product with no reviews and no sales
            // is exactly the one that would otherwise render a shorter tile
            // than its neighbours.
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
      // Decoded at roughly the size it is drawn. A 2000px WooCommerce photo
      // decoded at full resolution into a 180px box, twenty at a time, is how
      // a mid-range Android runs out of memory.
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

  // ---------- Shimmer grid ----------
  /// The placeholder grid, laid out from the same arithmetic as the real one.
  ///
  /// It has to be, or it defeats its own purpose: a skeleton that is not the
  /// size of the thing it stands in for makes the page jump the moment the
  /// products land, which is precisely the flicker a skeleton exists to
  /// prevent. This carried its own copy of the hardcoded 0.50 and so would have
  /// quietly gone on standing in for a tile shape that no longer exists.
  Widget _shimmerGrid() {
    const gutter = 8.0;
    final tileWidth = (MediaQuery.of(context).size.width - gutter * 3) / 2;
    final tileHeight = tileWidth + _kCardTextHeight;

    return GridView.builder(
      padding: const EdgeInsets.fromLTRB(gutter, gutter, gutter, 20),
      gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 2,
        crossAxisSpacing: gutter,
        mainAxisSpacing: gutter,
        childAspectRatio: tileWidth / tileHeight,
      ),
      itemCount: 6,
      itemBuilder: (_, __) => _Shimmer(
        child: Container(
          decoration: BoxDecoration(
            color: _kHairline,
            borderRadius: BorderRadius.circular(_kCardRadius),
          ),
        ),
      ),
    );
  }

  // ---------- Empty ----------
  Widget _emptyState() => Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Container(
                width: 62,
                height: 62,
                decoration: BoxDecoration(
                  color: _kHairline,
                  borderRadius: BorderRadius.circular(18),
                ),
                child: const Icon(Icons.search_off_rounded,
                    size: 28, color: _kMuted),
              ),
              const SizedBox(height: 14),
              Text('Nothing here yet', style: _heading(size: 18)),
              const SizedBox(height: 6),
              Text(
                _hasActiveFilters
                    ? 'No products match these filters.'
                    : 'This department has no products at the moment.',
                style: _subtitle(size: 13),
                textAlign: TextAlign.center,
              ),
              if (_hasActiveFilters) ...[
                const SizedBox(height: 16),
                _Press(
                  onTap: _clearFilters,
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 24, vertical: 11),
                    decoration: BoxDecoration(
                      color: _kPrimary,
                      borderRadius: BorderRadius.circular(_radius),
                    ),
                    child: Text(
                      'Clear filters',
                      style: _label(
                        size: 13,
                        color: _kWhite,
                        weight: FontWeight.w800,
                      ),
                    ),
                  ),
                ),
              ],
            ],
          ),
        ),
      );

  // ---------- Error ----------
  Widget _errorState() => Center(
        child: Padding(
          padding: const EdgeInsets.all(28),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.wifi_off_rounded, size: 40, color: _kFaint),
              const SizedBox(height: 14),
              Text('Cannot load the shop',
                  style: _heading(size: 17), textAlign: TextAlign.center),
              const SizedBox(height: 6),
              Text(
                _error ?? '',
                style: _text(size: 13.5, color: _kMuted),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 18),
              _Press(
                onTap: () => _load(reset: true),
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
        ),
      );

  // ---------- Bottom nav ----------
  Widget _bottomNav() {
    // Shop is index 1 and already on screen, so its route is empty — `_go`
    // treats that as "do nothing".
    // Saved and Cart do not run an Action directly any more — they call the
    // two helpers, which use the tab's Action when the project wired one and
    // push the sibling widget in code when it did not. A tab that does nothing
    // until somebody remembers to wire it is the failure this removes.
    final items = <_NavItem>[
      _NavItem(Icons.home_rounded, 'Home', () => _run(widget.onHomeTap)),
      const _NavItem(Icons.grid_view_rounded, 'Shop', null),
      _NavItem(Icons.favorite_border_rounded, 'Saved', _openWishlist),
      _NavItem(Icons.shopping_bag_outlined, 'Cart', _openCart),
      _NavItem(Icons.person_outline_rounded, 'Me', () => _run(widget.onProfileTap)),
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
                  // No haptic fired here: every callback behind these tabs
                  // fires its own, and two on one tap reads as a stutter.
                  onTap: items[i].onTap,
                  child: Padding(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 10, vertical: 4),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(
                          items[i].icon,
                          size: 21,
                          color: i == 1 ? _kPrimary : _kMuted,
                        ),
                        const SizedBox(height: 3),
                        Text(
                          items[i].label,
                          style: _label(
                            size: 10,
                            color: i == 1 ? _kPrimary : _kMuted,
                            weight:
                                i == 1 ? FontWeight.w800 : FontWeight.w600,
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

/// One entry in the bottom bar. Carries a page name, not a callback.
class _NavItem {
  final IconData icon;
  final String label;

  /// What the tab does.
  ///
  /// A plain callback rather than the FlutterFlow Action it used to hold, so a
  /// tab can decide for itself between running an Action and pushing a sibling
  /// screen in code. Null for the tab already on screen — tapping it is a
  /// no-op rather than a push of this page onto itself.
  final VoidCallback? onTap;

  const _NavItem(this.icon, this.label, this.onTap);
}

/// Thrown for a non-200.
///
/// Named distinctly rather than reusing `dart:io`'s `HttpException`, which is
/// unavailable on Flutter web and would break a web build.
class _HttpFailure implements Exception {
  final String message;
  const _HttpFailure(this.message);
  @override
  String toString() => '_HttpFailure: $message';
}
