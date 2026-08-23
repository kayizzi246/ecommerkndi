// Automatic FlutterFlow imports
// ---- Two boilerplate imports are deliberately absent ----
//
// FlutterFlow's generated header normally opens with
//
//     import '/backend/backend.dart';
//     import '/backend/supabase/supabase.dart';
//
// and this project has neither file. There is no Firestore backend and no
// Supabase: the shop's data comes from WordPress over the storefront's own
// API, and the session lives in SharedPreferences (see kandi_auth_page.dart).
// FlutterFlow only emits those lines for projects that HAVE those integrations
// — they arrived here by being pasted from an older project, and they are what
// broke the web build:
//
//     Error: Error when reading 'lib/backend/backend.dart':
//     No such file or directory
//
// dart2js and dart2wasm both refuse the whole build over it, in every custom
// widget at once, which is why it looked like nine broken files rather than
// one bad paste. Do not add them back.
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
// IMAGE DELIVERY
// ============================================================

/// The `Accept` header every photograph in this screen is fetched with.
///
/// ---- Why an app has to say this out loud ----
///
/// The API now hands back image URLs pointing at the storefront's image
/// optimiser (`/_next/image?...`) rather than at the raw WordPress upload, and
/// that endpoint picks its output format from the REQUEST: a client that says
/// it takes WebP gets WebP, and a client that says nothing gets the original
/// format back, resized.
///
/// Dart's HTTP client — which is what `cached_network_image` uses — sends no
/// `Accept` header at all. So without this line the app would collect the
/// resizing and the CDN delivery and silently leave the format conversion on
/// the table, which on this catalogue is about 45% of the bytes. Flutter
/// decodes WebP natively on both Android and iOS, so there is nothing to lose
/// by asking for it.
///
/// `image/*` after it is the fallback for any URL that is not going through
/// the optimiser — a seller avatar on another domain, say — where the server
/// should simply send whatever it has.
const Map<String, String> _kImageHeaders = <String, String>{
  'Accept': 'image/webp,image/*;q=0.8',
};


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
//  6. QUICK PICKS, AND DEPARTMENTS WITHOUT COUNTS. A row of four
//     entry points sits above the departments — Trending,
//     Promotions, 50% off, Under UGX 50,000 — and each one is a
//     query the API can actually answer, opening the shop screen
//     already narrowed. "50% off" sends `min_discount=50` and NOT
//     `sale=1`: "reduced at all" and "half price" are different
//     promises and only the second is on the button.
//
//     The department cards lost their "128 items" line and gained
//     an icon that differs per department. The count answered a
//     question nobody asks before tapping, and read badly on a
//     young shop; the icon is the thing the old row of six
//     identical grey circles never had.
//
//  SETUP  (FlutterFlow)
//  -----------------------------------------------------------
//  • Custom Widget name:  HomeSectionsWidget
//  • Dependencies (Settings ▸ Pubspec):
//        http: ^1.2.0
//        cached_network_image: ^3.3.1
//        google_fonts: ^6.1.0
//        shared_preferences: ^2.2.2
//  • Paste order does not matter. This screen reaches the basket
//    and the saved list through STATICS ON THE OTHER WIDGET
//    CLASSES — `ShoppingCartPage.loadCount()`,
//    `WishlistPage.toggleSaved(...)`, `ProductDetailPage.open(...)`
//    — because FlutterFlow's generated index.dart exports each
//    custom widget file with `show <WidgetName>`, making the
//    widget class the only symbol that crosses a file boundary.
//    An earlier version called top-level `KandiCart` /
//    `kandiOpenProduct` helpers declared in the cart file and the
//    whole web build failed with "isn't defined for the type".
//  • Parameters (all optional Actions):
//        onSearchTap   onShopTap   onCartTap
//        onWishlistTap onProfileTap onDeliverToTap
//
//    Nothing that carries an id. Products and departments are
//    opened by this file, in code — `ProductDetailPage(...)`,
//    `CategoryNavigationMenu(...)` — because an id passed as a
//    FlutterFlow parameter has to be declared on the destination,
//    spelled identically in the action editor and kept in step
//    with this file, and when it drifts the shopper gets a blank
//    page rather than a failed build.
//
//    `onCartTap` and `onWishlistTap` fall back to pushing this
//    project's own cart and saved-items screens when unwired, so
//    neither tab can be dead.
//
//  NOTE ON THE SUPABASE IMPORT ABOVE: FlutterFlow writes that
//  header itself and rewrites it on every save, so it stays.
//  Nothing in this file uses Supabase any more.
//
//  NOTE ON THE WISHLIST: no longer session-only. It is the shared
//  `KandiWishlist`, on the same per-device storage key the
//  website's own wishlist uses, so the heart here, the saved-items
//  screen and a wrapped webview all agree. The paragraph that used
//  to be here suggested lifting it into FFAppState — that would
//  have made the app disagree with the site instead.
//  anything else tempted into FFAppState: state two screens share
//  belongs where both can read it, and where the website already
//  keeps its copy.
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

// No page-name constants. Every destination is a FlutterFlow Action parameter
// on the widget — see the NAVIGATION note in the header.

/// The city shown in the masthead's "Deliver to" line.
///
/// A constant rather than something read from the API, because the API does not
/// know where this shopper is — and inventing a location from an IP lookup would
/// be worse than a sensible default that says something true about the shop: it
/// delivers from Kampala, and that is where most of its orders go.
///
/// The honest version of this line is the shopper's own saved address, which
/// lives in FlutterFlow rather than here. When your project has one, set
/// `onDeliverToTap` to your address page and read the saved city into this
/// widget — the one-line change is to make `_deliverTo` return
/// `FFAppState().deliveryCity` with this as the fallback.
const String _kDeliverToCity = 'Kampala';
// ============================================================

// ============================================================
// BRAND — matched to app/globals.css
// ============================================================

/// Brand orange. Fills, active state, prices at display size.
const Color _kPrimary = Color(0xFFFF6A00);

// `_kPrimarySoft` (#FFF3E8, the tint behind an active row) is no longer
// declared here. Its only use on this screen was the ground of the old circular
// department icons, and the same value now leads `_kDeptTints` below — keeping
// a second name for one colour is how a palette starts disagreeing with itself.
// The category screen still declares it, because it still has selected rows.

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
// DEPARTMENT CARDS
// ============================================================

/// One department card. Wide enough for a two-line name at 13px without
/// ellipsising the common ones ("Home & Living", "Phones & Tablets").
const double _kDeptCardWidth = 132;
const double _kDeptCardHeight = 62;
const double _kDeptGap = 8;

/// The card grounds, cycled so neighbouring departments never share one.
///
/// Every colour is a tint already defined in the storefront's palette — see the
/// "Marketing accents" block in `app/globals.css`. Nothing new is introduced:
/// this row is allowed to be colourful precisely because the product grid below
/// it is not, and the tints are pale enough that near-black text on them clears
/// AA comfortably.
const List<Color> _kDeptTints = [
  Color(0xFFFFF3E8), // orange
  Color(0xFFEAF0FF), // blue
  Color(0xFFF0FDF4), // green
  Color(0xFFF3ECFF), // violet
  Color(0xFFFEF2F2), // red
];

/// The matching saturated step, used only for the item count.
///
/// Paired by index with the tints above, so a card's count is a darker version
/// of its own ground rather than a colour borrowed from somewhere else.
const List<Color> _kDeptInks = [
  Color(0xFFB34A00), // orange, darkened until it clears 4.6:1
  Color(0xFF1A4FD6), // blue
  Color(0xFF16A34A), // green
  Color(0xFF6D28D9), // violet
  Color(0xFFE53935), // red
];

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

  /// Where the website's own "View all" for this rail points — `/sale`,
  /// `/search?sort=popular`, `/category/mens-fashion`.
  ///
  /// It was arriving in the payload and being dropped, so every "View all" on
  /// this screen went to the same undifferentiated shop: tapping it beside
  /// Daily Deals and beside Best sellers landed in identical places. The server
  /// already knows where each rail leads, which makes reading this the only way
  /// the two can't drift — see `_openRail`.
  final String? href;
  final List<_Product> products;

  const _Rail({
    required this.id,
    required this.title,
    required this.subtitle,
    required this.href,
    required this.products,
  });

  factory _Rail.fromJson(Map<String, dynamic> j) {
    final raw = j['products'];
    return _Rail(
      id: (j['id'] ?? '').toString(),
      title: (j['title'] ?? '').toString(),
      subtitle: j['subtitle']?.toString(),
      href: j['href']?.toString(),
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

  /// The press tick.
  ///
  /// ---- Why it lives here and not in the handlers ----
  ///
  /// Haptics were on about a third of this screen's controls: whichever ones
  /// somebody remembered to add `HapticFeedback` to. A tap on a product tile
  /// buzzed and a tap on a department did not, which does not read as a design
  /// decision — it reads as half the screen being dead.
  ///
  /// Every control on this page is already wrapped in `_Press`, so this is the
  /// one place that catches all of them, including any added later.
  ///
  /// ---- Why on press-DOWN, and why `selectionClick` ----
  ///
  /// Down, because that is when the finger is still on the glass and the tick
  /// is felt as the button yielding. Fired on tap-up it arrives after the
  /// screen has already begun changing and reads as a stutter.
  ///
  /// `selectionClick` rather than `lightImpact` because several handlers fire
  /// their own `lightImpact` or `mediumImpact` when the action lands, and two
  /// identical buzzes in a row feels like a fault. A crisp tick on the way down
  /// and a softer impact on the way out is the pairing native pickers use — it
  /// reads as one gesture with a beginning and an end. On Android
  /// `selectionClick` maps to the platform's own click effect, which is
  /// quieter than a light impact by design.
  void _tick() {
    if (widget.onTap == null) return; // Nothing will happen; say nothing.
    HapticFeedback.selectionClick();
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTapDown: (_) {
        _tick();
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

class HomeSectionsWidget extends StatefulWidget {
  /// ---- Navigation is Actions ----
  ///
  /// Every destination this screen can reach is a FlutterFlow ACTION parameter,
  /// wired in the action editor. None of them is a page name typed as a String.
  ///
  /// This narrows the file's original "NO PARAMETERS" rule rather than
  /// abandoning it. That rule was about DATA — the shop name, the logo, the
  /// terms, the products — all of which belong to the API and would be wrong to
  /// duplicate into a widget parameter. Navigation is not data; it is what the
  /// FlutterFlow project does when something is tapped, and an Action is
  /// precisely the thing FlutterFlow has for expressing that.
  ///
  /// Page names were tried in between and are worse on three counts:
  ///
  ///   • FlutterFlow knows whether a page takes path or query parameters; a
  ///     string does not carry that. This file had to try one, catch the throw
  ///     and try the other, and a page declaring neither shape failed silently.
  ///   • A page name is unvalidated. Rename the page and the parameter still
  ///     holds the old name — the tap dies with nothing to say why.
  ///   • An Action can do more than navigate: update App State, show a dialog,
  ///     call an API. A route name can only ever go somewhere.
  ///
  /// Every Action is optional, and a null one is a no-op — a control the project
  /// chose not to wire, quiet rather than crashing.
  ///
  /// In FlutterFlow: Custom Widget ▸ Parameters ▸ Add, type Action, NOT
  /// required.
  const HomeSectionsWidget({
    super.key,
    this.width,
    this.height,
    this.onSearchTap,
    this.onCartTap,
    this.onWishlistTap,
    this.onShopTap,
    this.onProfileTap,
    this.onDeliverToTap,
  });

  final double? width;
  final double? height;

  /// ---- What is NOT here any more ----
  ///
  /// `onProductTap` and `onCategoryTap` are gone. Both carried an id or a slug
  /// across the FlutterFlow boundary, and both destinations — the product page
  /// and the department browser — are custom widgets in this same project. This
  /// screen pushes them itself now, with the id as a typed Dart argument.
  ///
  /// That is strictly better than a parameter for one reason: a parameter has
  /// to be declared on the destination page, spelled identically in the action
  /// editor, and kept in step with this file. Three places to get one string
  /// wrong, and when it goes wrong the shopper gets a blank product page rather
  /// than the build failing.
  ///
  /// What remains are the bottom tabs — destinations that carry no data and are
  /// real FlutterFlow pages with their own scaffolds — plus search, which has
  /// no in-code counterpart, and the "Deliver to" line.
  ///
  /// `onCartTap` and `onWishlistTap` are the two tabs that also have a screen in
  /// this project, so an unwired one is not a dead control: it falls back to
  /// pushing `ShoppingCartPage` / `WishlistPage` in code.
  final Future Function()? onSearchTap;
  final Future Function()? onCartTap;
  final Future Function()? onWishlistTap;
  final Future Function()? onShopTap;
  final Future Function()? onProfileTap;

  /// Behind the "Deliver to" line in the masthead — an address picker, usually.
  /// Left unwired, the line is shown but is not tappable, which is honest: a
  /// control that looks interactive and does nothing is worse than a label.
  final Future Function()? onDeliverToTap;

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

  /// The saved-items list, shared with every other screen.
  ///
  /// It used to be session-only — a heart tapped here survived until the
  /// shopper left the screen and no further, and the saved-items page knew
  /// nothing about it. Both now read `KandiWishlist`, on the same storage key
  /// the website's own wishlist uses.
  Set<int> _wishlisted = <int>{};

  /// Badge on the cart icon. Hidden while it is zero.
  ///
  /// It was hard-zero, with a note suggesting FFAppState as the place to keep a
  /// real one. There is a real one now and it is not in FlutterFlow: the basket
  /// this app adds to is `KandiCart`, so the badge reads the same list the cart
  /// screen shows and cannot say 3 over a basket of 5.
  int _cartCount = 0;

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
    // The basket and the saved list, from the device. Not awaited: they are
    // local reads that finish in a frame or two, and the feed request should
    // not be waiting behind them.
    _syncStores();
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

  /// Runs one of the navigation Actions.
  ///
  /// This replaced a `pushNamed` that took a page NAME and had to try query
  /// parameters, catch the throw, and then try path parameters — because a
  /// string gives no way to know which shape the destination page declared, and
  /// a page taking neither failed silently.
  ///
  /// FlutterFlow knows, so FlutterFlow navigates. A null Action is a control the
  /// project chose not to wire and does nothing: deliberately quiet rather than
  /// a crash, and obvious the first time it is tapped in testing.
  void _run(Future Function()? action) {
    if (action == null) return;
    HapticFeedback.lightImpact();
    action();
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

  /// Saves or unsaves, in the list every other screen reads.
  ///
  /// This was a `Set<int>` that lived and died with the screen, which meant a
  /// heart tapped here was forgotten the moment the shopper scrolled to another
  /// screen and disagreed with the saved-items page while both were open. The
  /// store is the one declared in `cart_widget.dart`, on the website's own
  /// storage key.
  Future<void> _toggleWishlist(_Product p) async {
    HapticFeedback.lightImpact();
    final nowSaved = await WishlistPage.toggleSaved(
      productId: p.id,
      name: p.name,
      image: p.image,
      price: p.price,
      slug: p.slug,
    );
    if (!mounted) return;
    setState(() {
      if (nowSaved) {
        _wishlisted.add(p.id);
      } else {
        _wishlisted.remove(p.id);
      }
    });
  }

  /// Re-reads the shared basket and saved list.
  ///
  /// Run on open and again every time this screen comes back from one of them,
  /// since both can change while it is off screen — and a badge that is one
  /// behind is the visible half of the bug this replaces.
  ///
  /// Both go through statics on the other widgets rather than through a store
  /// class: FlutterFlow exports each custom widget file with
  /// `show <WidgetName>`, so the widget class is the only symbol that crosses
  /// a file boundary — the reason an earlier `KandiCart.load()` here failed the
  /// whole web build.
  Future<void> _syncStores() async {
    final saved = await WishlistPage.savedIds();
    final count = await ShoppingCartPage.loadCount();
    if (!mounted) return;
    setState(() {
      _wishlisted = saved;
      _cartCount = count;
    });
  }

  // ---------- Opening things, in code ----------

  /// Opens a product.
  ///
  /// `kandiOpenProduct` is declared in `cart_widget.dart` and pushes
  /// `ProductDetailPage` directly, wiring its related rail and its cart icon on
  /// the way. The id travels as a typed Dart argument rather than through a
  /// FlutterFlow parameter that has to be declared on the destination, spelled
  /// identically in the action editor and kept in step with this file — three
  /// places to get one string wrong, and the failure is a blank product page
  /// rather than a compile error.
  void _openProduct(_Product p) {
    HapticFeedback.lightImpact();
    ProductDetailPage.open(context, p.slug.isNotEmpty ? p.slug : p.id.toString());
  }

  /// Opens a department, with its own name at the top of the page.
  ///
  /// `openFiltered` rather than a constructor call: FlutterFlow turns every
  /// public constructor parameter into a panel row that EVERY instance of the
  /// widget must fill in, so a department argument here became "widget does not
  /// specify value for parameter initialSaleOnly" on unrelated screens. The
  /// filter travels beside the push now — same typed arguments, no panel rows.
  void _openDepartment(_Department d) {
    HapticFeedback.lightImpact();
    CategoryNavigationMenu.openFiltered(
      context,
      department: d.slug,
      title: d.name,
    ).then((_) => _syncStores());
  }

  /// Opens the whole shop, or one of the quick picks.
  ///
  /// Every argument here is checked by the compiler, which is the point: "50%
  /// off" is `minDiscount: 50` and not a query string assembled by hand
  /// in two files that have to agree.
  void _openShop({
    String? sort,
    bool saleOnly = false,
    double? maxPrice,
    int? minDiscount,
    String? title,
  }) {
    HapticFeedback.lightImpact();
    CategoryNavigationMenu.openFiltered(
      context,
      sort: sort,
      saleOnly: saleOnly,
      maxPrice: maxPrice,
      minDiscount: minDiscount,
      title: title,
    ).then((_) => _syncStores());
  }

  /// Follows a rail's own "View all".
  ///
  /// The destination is read from the `href` the server sent rather than
  /// guessed from the rail's id, so a rail the website re-points moves the app
  /// with it and a rail added there needs no case adding here. Anything this
  /// does not recognise opens the shop unfiltered, which is the honest failure:
  /// more products, not none.
  void _openRail(_Rail rail) {
    final href = rail.href ?? '';

    if (href.startsWith('/category/')) {
      final slug = href.substring('/category/'.length).split('?').first;
      if (slug.isNotEmpty) {
        HapticFeedback.lightImpact();
        CategoryNavigationMenu.openFiltered(
          context,
          department: slug,
          title: rail.title,
        ).then((_) => _syncStores());
        return;
      }
    }

    if (href.startsWith('/sale')) {
      _openShop(saleOnly: true, sort: 'discount', title: rail.title);
      return;
    }

    // `/search?sort=…` — the sort keys are the same words the app's own
    // endpoint takes, which is why they can be passed straight through.
    final sort = Uri.tryParse(href)?.queryParameters['sort'];
    _openShop(sort: sort, title: rail.title);
  }

  /// The basket. The tab's Action when the project wired one, this app's own
  /// cart screen when it did not — so the control is never dead.
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

  void _toTop() {
    HapticFeedback.mediumImpact();
    _scroll.animateTo(
      0,
      duration: const Duration(milliseconds: 400),
      curve: Curves.easeOut,
    );
  }

  /// Where the masthead says this order is going.
  ///
  /// The time-of-day greeting that used to sit in that corner has gone with the
  /// wordmark. "Good morning" is pleasant and tells a shopper nothing they can
  /// act on; the delivery city answers the question that decides whether they
  /// keep scrolling.
  String get _deliverTo => _kDeliverToCity;

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
    // `Material` + `DefaultTextStyle` rather than a bare `Container` — this is
    // what stops every word on the screen wearing Flutter's double yellow
    // debug underline. Full argument at `_screen` in
    // `product_detail_widget.dart`.
    return Material(
      color: _kPage,
      child: DefaultTextStyle(
        style: _text(size: 14, color: _kInk)
            .copyWith(decoration: TextDecoration.none),
        child: SizedBox(
          width: widget.width ?? double.infinity,
          height: widget.height ?? double.infinity,
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
        ),
      ),
    );
  }

  List<Widget> _slivers() {
    if (_loading) {
      return [
        SliverToBoxAdapter(child: _appBar()),
        _stickySearch(),
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
      _stickySearch(),
      // Above the departments deliberately: a department answers "where do I
      // look", these answer "what is worth looking at", and the second question
      // is the one a shopper opening a shop app has.
      SliverToBoxAdapter(child: _quickPicks()),
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
  //
  // The shop's logo and name no longer appear here — see the "Deliver to" note
  // below. `_feed.logoUrl` is therefore read by nothing on this screen, which
  // is deliberate rather than an oversight: the brand is established by the app
  // icon, the splash and the orange, and repeating it at the top of the one
  // screen a shopper reaches by opening this app is a line spent on the shop
  // rather than on them.
  Widget _appBar() {
    return SafeArea(
      bottom: false,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(_pad, 6, _pad, 6),
        child: Row(
          children: [
            /* ---- Deliver to, not the shop's own name ----
             *
             * The masthead used to print the brand wordmark and a greeting.
             * Both are gone, and the reasoning is the one every large
             * marketplace app has arrived at: a shopper who has opened your app
             * knows whose app it is. The most valuable line in that corner is
             * not your name, it is theirs — where this is going, which is the
             * question underneath "can I actually get this".
             *
             * Amazon, Jumia, Noon and Temu all put a "Deliver to …" control
             * exactly here for the same reason.
             *
             * Tappable only when an `onDeliverToTap` Action is wired, because a control
             * that looks interactive and does nothing is worse than a label.
             * The city is the shop's own delivery origin — see `_deliverTo`. */
            Expanded(
              child: _Press(
                onTap: widget.onDeliverToTap == null
                    ? null
                    : () => _run(widget.onDeliverToTap),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      'Deliver to',
                      style: _label(size: 10.5, color: _kMuted),
                    ),
                    const SizedBox(height: 1),
                    Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(
                          Icons.location_on_rounded,
                          size: 15,
                          color: _kPrimary,
                        ),
                        const SizedBox(width: 3),
                        Flexible(
                          child: Text(
                            _deliverTo,
                            style: _text(
                              size: 14,
                              color: _kInk,
                              weight: FontWeight.w700,
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                        if (widget.onDeliverToTap != null)
                          const Icon(
                            Icons.keyboard_arrow_down_rounded,
                            size: 17,
                            color: _kBody,
                          ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
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
    );
  }

  // `_logoText()` — the orange wordmark that used to head this screen — has
  // been removed with the rest of the branding in the masthead, along with the
  // fallback shop name it fell back to while the feed was loading.

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
  /// The search field, pinned to the top of the screen as the page scrolls.
  ///
  /// ---- Why it is pinned ----
  ///
  /// Search is the primary way into a catalogue of any size, and this home
  /// screen is long by design — departments, a trust strip, eight rails and an
  /// endless grid. Left to scroll away with everything else, the search field
  /// is reachable only by flicking back to the top, which is a long way from
  /// the bottom of the grid. A shopper who has scrolled past forty products and
  /// not found what they came for is exactly the shopper who most needs to
  /// search, and they were the one it was furthest from.
  ///
  /// The masthead above it still scrolls away. That is the trade: the "Deliver
  /// to" line and the cart are chrome a shopper consults occasionally, and the
  /// cart is on the fixed bottom bar in any case, so only the one control worth
  /// the permanent space keeps it.
  ///
  /// Implemented as a `SliverPersistentHeader` rather than a fixed widget
  /// outside the scroll view, so it participates in the same scroll — no second
  /// scrollable, no gap to keep in sync, and `RefreshIndicator` still works
  /// through it.
  SliverPersistentHeader _stickySearch() => SliverPersistentHeader(
        pinned: true,
        delegate: _StickySearchDelegate(child: _searchArea()),
      );

  Widget _searchArea() => Container(
        // Opaque, and that is load-bearing: while pinned this sits ON TOP of
        // the rails scrolling underneath it, and a transparent background
        // would let product photographs slide through the search field.
        color: _kPage,
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

  /// An icon for a department, chosen from its own name.
  ///
  /// The shop's categories are whatever wp-admin says they are, so this cannot
  /// be a fixed list of six — it is a keyword match against the name and the
  /// slug, with a shopping bag for anything it does not recognise. A wrong-ish
  /// icon on an unusual department costs nothing; the failure it replaces was
  /// six identical grey glyphs, which is decoration standing where information
  /// should be.
  ///
  /// Matching is on both the name and the slug because the two can differ —
  /// "Men's Fashion" arrives as `mens-fashion`, and an apostrophe or a capital
  /// should not decide whether a card gets its icon.
  IconData _deptIcon(String name, String slug) {
    final s = '$name $slug'.toLowerCase();

    bool has(List<String> words) => words.any(s.contains);

    // Ordered from the most specific to the most general: "phone accessories"
    // has to be caught by the phone rule before "accessories" claims it.
    if (has(['phone', 'smartphone', 'mobile', 'tecno', 'itel'])) {
      return Icons.smartphone_rounded;
    }
    if (has(['laptop', 'computer', 'pc'])) return Icons.laptop_mac_rounded;
    if (has(['tv', 'television', 'screen'])) return Icons.tv_rounded;
    if (has(['electronic', 'gadget', 'tech'])) {
      return Icons.devices_other_rounded;
    }
    if (has(['audio', 'speaker', 'headphone', 'earbud'])) {
      return Icons.headphones_rounded;
    }
    if (has(['shoe', 'sneaker', 'footwear', 'boot', 'sandal'])) {
      return Icons.directions_walk_rounded;
    }
    if (has(['bag', 'handbag', 'luggage', 'backpack'])) {
      return Icons.shopping_bag_rounded;
    }
    if (has(['watch', 'jewel', 'jewellery', 'jewelry'])) {
      return Icons.watch_rounded;
    }
    if (has(['beauty', 'cosmetic', 'makeup', 'perfume', 'fragrance'])) {
      return Icons.spa_rounded;
    }
    if (has(['health', 'pharmacy', 'medic', 'wellness'])) {
      return Icons.medical_services_rounded;
    }
    if (has(['baby', 'kid', 'child', 'toy'])) {
      return Icons.child_friendly_rounded;
    }
    if (has(['men', 'gent'])) return Icons.man_rounded;
    if (has(['women', 'ladies', 'lady'])) return Icons.woman_rounded;
    if (has(['fashion', 'cloth', 'wear', 'apparel', 'dress'])) {
      return Icons.checkroom_rounded;
    }
    if (has(['home', 'furniture', 'decor', 'kitchen', 'bed'])) {
      return Icons.chair_rounded;
    }
    if (has(['grocer', 'food', 'drink', 'beverage'])) {
      return Icons.local_grocery_store_rounded;
    }
    if (has(['sport', 'fitness', 'gym', 'outdoor'])) {
      return Icons.sports_soccer_rounded;
    }
    if (has(['car', 'auto', 'motor', 'vehicle'])) {
      return Icons.directions_car_rounded;
    }
    if (has(['book', 'stationery', 'office'])) return Icons.menu_book_rounded;
    if (has(['game', 'gaming', 'console'])) {
      return Icons.sports_esports_rounded;
    }
    if (has(['tool', 'hardware', 'build'])) return Icons.handyman_rounded;

    return Icons.shopping_bag_outlined;
  }

  // ---------- Quick picks ----------

  /// Four ways into the catalogue, above the departments.
  ///
  /// ---- Why these four, and why they are not rails ----
  ///
  /// The rails below already show trending and reduced products, but a rail
  /// shows about four things and then asks the shopper to scroll sideways
  /// through the rest. These are the same intentions expressed as destinations:
  /// tapping one opens the shop screen already narrowed, with every matching
  /// product in a grid and the shop's own filters still available on top.
  ///
  /// Every one of them is a real query the API can answer, and that is the bar
  /// each had to clear:
  ///
  ///   • Trending  — `sort=popular`, most bought first.
  ///   • Promotions — `sale=1`, anything reduced, deepest cuts first.
  ///   • 50% off   — `min_discount=50`, and deliberately NOT `sale=1`. "Reduced
  ///     at all" and "half price" are different promises, and the one on the
  ///     button is the second. A chip that quietly included 5% reductions is
  ///     the kind of thing a shopper checks once and never trusts again.
  ///   • Under UGX 50,000 — `max_price=50000`, cheapest first.
  ///
  /// The 50% chip is the loud one — filled orange against three outlined
  /// neighbours — because it is the only one of the four that is a claim about
  /// price rather than a way of sorting, and it is what a shopper scanning this
  /// row is looking for.
  Widget _quickPicks() {
    Widget chip({
      required IconData icon,
      required String label,
      required VoidCallback onTap,
      bool filled = false,
    }) =>
        _Press(
          onTap: onTap,
          child: Container(
            margin: const EdgeInsets.only(right: 8),
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            decoration: BoxDecoration(
              color: filled ? _kPrimary : _kWhite,
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: filled ? _kPrimary : _kLine),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(
                  icon,
                  size: 15,
                  color: filled ? _kWhite : _kPrimaryInk,
                ),
                const SizedBox(width: 6),
                Text(
                  label,
                  style: _label(
                    size: 12.5,
                    color: filled ? _kWhite : _kInk,
                    weight: FontWeight.w700,
                  ),
                ),
              ],
            ),
          ),
        );

    return SizedBox(
      height: 50,
      child: ListView(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.fromLTRB(_pad, 4, _pad - 8, 6),
        children: [
          chip(
            icon: Icons.local_fire_department_rounded,
            label: 'Trending',
            onTap: () => _openShop(sort: 'popular', title: 'Trending now'),
          ),
          chip(
            icon: Icons.sell_rounded,
            label: 'Promotions',
            onTap: () => _openShop(
              saleOnly: true,
              sort: 'discount',
              title: 'Promotions',
            ),
          ),
          chip(
            icon: Icons.bolt_rounded,
            label: '50% off',
            filled: true,
            onTap: () => _openShop(
              minDiscount: 50,
              sort: 'discount',
              title: '50% off',
            ),
          ),
          chip(
            icon: Icons.savings_rounded,
            label: 'Under UGX 50,000',
            onTap: () => _openShop(
              maxPrice: 50000,
              sort: 'price_asc',
              title: 'Under UGX 50,000',
            ),
          ),
        ],
      ),
    );
  }

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
          /* ---- Two rows of cards, not one row of circles ----
           *
           * The old design was a horizontally-scrolling row of 54px circles,
           * each holding the SAME grey category icon, with the name under it.
           * Three things were wrong with it:
           *
           *   • Every circle was identical. A row of six copies of one icon is
           *     decoration standing where information should be — the only
           *     thing distinguishing one department from the next was 11px of
           *     text underneath.
           *   • It hid the catalogue. `count` comes down from the API on every
           *     department and was thrown away, so nothing told a shopper
           *     whether "Electronics" held four products or four hundred.
           *   • One row, scrolling sideways, showed about four and a half
           *     departments and gave no hint how many more there were. Side
           *     scrolling is a poor way to present a *complete, short* list,
           *     which is what a department list is.
           *
           * This is a two-row horizontal grid of cards — the shape Jumia and
           * Noon use for the same job. Two rows means roughly twice as many
           * departments are visible at once, the cards carry the real product
           * count, and each takes a colour from a small rotating palette so the
           * row reads as a set of distinct places rather than repeated
           * furniture. The colours are drawn from the marketing accents already
           * defined for the storefront, so nothing new enters the palette. */
          SizedBox(
            height: 2 * _kDeptCardHeight + _kDeptGap,
            child: GridView.builder(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: _pad),
              gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                // "Cross axis" is the vertical one on a horizontal grid, so
                // this is what makes it two rows deep rather than two wide.
                crossAxisCount: 2,
                mainAxisSpacing: _kDeptGap,
                crossAxisSpacing: _kDeptGap,
                // Width over height, and it is inverted here for the same
                // reason: on a horizontal grid the main axis is the width.
                childAspectRatio: _kDeptCardHeight / _kDeptCardWidth,
              ),
              itemCount: feed.departments.length,
              itemBuilder: (_, i) {
                final d = feed.departments[i];
                final tint = _kDeptTints[i % _kDeptTints.length];
                final ink = _kDeptInks[i % _kDeptInks.length];

                return _Press(
                  onTap: () => _openDepartment(d),
                  child: Container(
                    width: _kDeptCardWidth,
                    padding: const EdgeInsets.symmetric(
                      horizontal: 10,
                      vertical: 10,
                    ),
                    decoration: BoxDecoration(
                      color: tint,
                      borderRadius: BorderRadius.circular(_kCardRadius),
                    ),
                    /* ---- An icon and a name. Nothing else ----
                     *
                     * The card used to print the product count under the name —
                     * "128 items" — and it has been taken out. It answered a
                     * question nobody asks before tapping: a shopper choosing
                     * between Men and Electronics is choosing what they came
                     * for, not which shelf is fuller, and the number was
                     * loudest exactly where it mattered least. It also aged
                     * badly, since a count that says 4 tells a shopper the shop
                     * is empty before they have seen a single photograph.
                     *
                     * What is there instead is the thing the old circular row
                     * never had: an icon that DIFFERS per department. That row
                     * failed because all six circles held the same grey glyph,
                     * so the icon carried no information at all. Chosen by
                     * matching the department's own name — see `_deptIcon` —
                     * with a shopping bag for anything unrecognised, so a shop
                     * that invents a department still gets a card that looks
                     * deliberate. */
                    child: Row(
                      children: [
                        Container(
                          width: 34,
                          height: 34,
                          decoration: const BoxDecoration(
                            color: _kWhite,
                            shape: BoxShape.circle,
                          ),
                          child: Icon(
                            _deptIcon(d.name, d.slug),
                            size: 18,
                            color: ink,
                          ),
                        ),
                        const SizedBox(width: 9),
                        Expanded(
                          child: Text(
                            d.name,
                            style: _text(
                              size: 13,
                              color: _kInk,
                              weight: FontWeight.w700,
                              height: 1.25,
                            ),
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                          ),
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
                  // Follows this rail's own destination, not a single generic
                  // "Shop" for all eight of them.
                  onTap: () => _openRail(rail),
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
      httpHeaders: _kImageHeaders,
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
  /// The whole page, in grey.
  ///
  /// ---- Why this got longer ----
  ///
  /// It used to be one heading and one rail, which meant the shopper watched a
  /// single grey row for as long as the feed took and then had five more
  /// sections drop in underneath it. A skeleton that covers a fifth of the page
  /// does not prevent the jump it exists to prevent — it just moves it further
  /// down.
  ///
  /// Every section the real page draws now has a shape here, in the same order
  /// and off the same constants: the quick picks, the two rows of department
  /// cards, the trust strip, two rails and the first row of the grid. The
  /// arithmetic is shared rather than copied, so a tile that changes height
  /// changes here too and the two cannot drift.
  Widget _skeleton() {
    Widget block(double width, double height, {double radius = 4}) => _Shimmer(
          child: Container(
            width: width,
            height: height,
            decoration: BoxDecoration(
              color: _kHairline,
              borderRadius: BorderRadius.circular(radius),
            ),
          ),
        );

    Widget railBlock() => Padding(
          padding: const EdgeInsets.only(top: 18),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: _pad),
                child: block(150, 18),
              ),
              const SizedBox(height: 12),
              SizedBox(
                height: _kRailTileWidth + _kCardTextHeight,
                child: ListView.separated(
                  scrollDirection: Axis.horizontal,
                  physics: const NeverScrollableScrollPhysics(),
                  padding: const EdgeInsets.symmetric(horizontal: _pad),
                  itemCount: 4,
                  separatorBuilder: (_, __) => const SizedBox(width: 8),
                  itemBuilder: (_, __) => block(
                    _kRailTileWidth,
                    _kRailTileWidth + _kCardTextHeight,
                    radius: _kCardRadius,
                  ),
                ),
              ),
            ],
          ),
        );

    final gridTileWidth = (MediaQuery.of(context).size.width - 24) / 2;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Quick picks.
        SizedBox(
          height: 50,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            physics: const NeverScrollableScrollPhysics(),
            padding: const EdgeInsets.fromLTRB(_pad, 4, _pad, 6),
            itemCount: 4,
            separatorBuilder: (_, __) => const SizedBox(width: 8),
            itemBuilder: (_, i) => block(i == 3 ? 150 : 104, 36, radius: 20),
          ),
        ),

        // Departments — two rows, exactly as tall as the real strip.
        Padding(
          padding: const EdgeInsets.fromLTRB(_pad, 10, _pad, 0),
          child: block(150, 18),
        ),
        const SizedBox(height: 12),
        SizedBox(
          height: 2 * _kDeptCardHeight + _kDeptGap,
          child: GridView.builder(
            scrollDirection: Axis.horizontal,
            physics: const NeverScrollableScrollPhysics(),
            padding: const EdgeInsets.symmetric(horizontal: _pad),
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 2,
              mainAxisSpacing: _kDeptGap,
              crossAxisSpacing: _kDeptGap,
              childAspectRatio: _kDeptCardHeight / _kDeptCardWidth,
            ),
            itemCount: 6,
            itemBuilder: (_, __) => block(
              _kDeptCardWidth,
              _kDeptCardHeight,
              radius: _kCardRadius,
            ),
          ),
        ),

        // Trust strip.
        Padding(
          padding: const EdgeInsets.fromLTRB(_pad, 14, _pad, 0),
          child: block(double.infinity, 34, radius: 8),
        ),

        railBlock(),
        railBlock(),

        // The head of the endless grid, so the page does not end abruptly in
        // white while the rest is still coming.
        Padding(
          padding: const EdgeInsets.fromLTRB(_pad, 20, _pad, 12),
          child: block(150, 18),
        ),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 8),
          child: Row(
            children: [
              block(gridTileWidth, gridTileWidth + _kCardTextHeight,
                  radius: _kCardRadius),
              const SizedBox(width: 8),
              block(gridTileWidth, gridTileWidth + _kCardTextHeight,
                  radius: _kCardRadius),
            ],
          ),
        ),
      ],
    );
  }

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
    // Home is index 0 and already on screen, so it carries no action — a null
    // one is a no-op rather than pushing this page onto itself.
    //
    // Built at runtime rather than const, because each entry now carries the
    // Action the project wired in FlutterFlow rather than a page name.
    final items = <_NavItem>[
      const _NavItem(Icons.home_rounded, 'Home', null),
      _NavItem(
        Icons.grid_view_rounded,
        'Shop',
        // The department browser lives in this project, so an unwired Shop tab
        // still goes shopping rather than doing nothing.
        () => widget.onShopTap != null
            ? _run(widget.onShopTap)
            : _openShop(title: 'Shop'),
      ),
      _NavItem(Icons.favorite_border_rounded, 'Saved', _openWishlist),
      _NavItem(Icons.shopping_bag_outlined, 'Cart', _openCart),
      _NavItem(
        Icons.person_outline_rounded,
        'Me',
        () => _run(widget.onProfileTap),
      ),
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

/// Holds the search field at the top of the screen while the page scrolls.
///
/// A `SliverPersistentHeader` needs a delegate, and the delegate needs a fixed
/// height — the sliver protocol has no way to measure its own child. 56 is the
/// search pill plus the 8px of breathing room under it; get it wrong and the
/// header either clips the field or leaves a band of bare page under it.
///
/// `shouldRebuild` compares the child rather than returning a blanket `true`.
/// This delegate is consulted on every scroll frame, and the field inside it is
/// already animating its own rotating placeholder — an unconditional `true`
/// would rebuild that subtree sixty times a second for the whole length of a
/// very long page.
class _StickySearchDelegate extends SliverPersistentHeaderDelegate {
  final Widget child;
  const _StickySearchDelegate({required this.child});

  static const double _height = 56;

  @override
  double get minExtent => _height;

  @override
  double get maxExtent => _height;

  @override
  Widget build(
    BuildContext context,
    double shrinkOffset,
    bool overlapsContent,
  ) =>
      SizedBox.expand(child: child);

  @override
  bool shouldRebuild(covariant _StickySearchDelegate old) => old.child != child;
}

/// One entry in the bottom bar.
class _NavItem {
  final IconData icon;
  final String label;

  /// What the tab does.
  ///
  /// A plain callback rather than the FlutterFlow Action it used to hold, so a
  /// tab can choose for itself between running an Action and pushing a sibling
  /// screen in code — which is what Shop, Saved and Cart now do. Null for the
  /// tab already on screen: tapping Home on Home is a no-op rather than a push
  /// of this page onto itself.
  final VoidCallback? onTap;

  const _NavItem(this.icon, this.label, this.onTap);
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
