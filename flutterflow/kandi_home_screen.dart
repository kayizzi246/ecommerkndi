// Automatic FlutterFlow imports
import '/flutter_flow/flutter_flow_theme.dart';
import '/flutter_flow/flutter_flow_util.dart';
import '/custom_code/widgets/index.dart'; // Imports other custom widgets
import '/flutter_flow/custom_functions.dart'; // Imports custom functions
import 'package:flutter/material.dart';
// Begin custom widget code
// DO NOT REMOVE OR MODIFY THE CODE ABOVE!

// ---- Every import goes BELOW the line above ----
//
// FlutterFlow rewrites the header block on save and silently drops anything
// added to it. The failure lands far from the cause: the file stops compiling,
// so FlutterFlow cannot find the widget class and reports
// `No widget "KandiHomeScreen" found` — which reads like a naming mistake and
// never is. Do NOT add the `/backend/` imports it offers; this project has
// neither file.
import 'dart:convert';

import 'package:flutter/services.dart';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

// Navigation only — the destinations reachable from this page. No design, no
// model and no helper crosses a file boundary in this app.
import '/custom_code/widgets/kandi_product_screen.dart';
import '/custom_code/widgets/kandi_cart_screen.dart';
import '/custom_code/widgets/kandi_search_screen.dart';
import '/custom_code/widgets/kandi_shop_screen.dart';
import '/custom_code/widgets/kandi_wishlist_screen.dart';
import '/custom_code/widgets/kandi_account_screen.dart';
import '/custom_code/widgets/kandi_orders_screen.dart';

// ============================================================
//  KANDI — HOME PAGE
//
//  The shopfront. This file is also the TEMPLATE every other
//  page in the app copies, so the architecture is written out
//  here once and referred to from the others.
//
//  ---- One file per page, nothing shared ----
//
//  Every page carries its own palette, type scale, HTTP client,
//  product model and product tile. There is no shared design
//  library.
//
//  The trade, in both directions: it costs duplication — the
//  palette appears in nine files and an accent colour changes
//  in nine places. It buys a paste order of "any". The version
//  this replaces had fifteen widgets and exactly ONE legal
//  order, because each imported the others for colours and
//  models; a file pasted early failed to compile with an error
//  naming the wrong file.
//
//  ---- Which is why every helper is private ----
//
//  FlutterFlow writes all custom widgets into one flat folder
//  and re-exports them through a shared index.dart. Two files
//  declaring a top-level `KColors` would collide the moment
//  both were pasted. Dart's underscore makes `_KColors`
//  file-scoped, so nine pages can each have one and never meet.
//  Only the widget class is public, because only it needs to
//  be.
//
//  ---- NOTHING is passed between pages ----
//
//  Not a constructor parameter, not a route argument. Every
//  page is opened with a const constructor and no arguments at
//  all.
//
//  What a page needs to know it reads from the device. Before
//  opening the product page this screen writes the product id
//  to `kandi-open-product`; the product page reads that key in
//  `initState`. Categories and search terms travel the same
//  way.
//
//  That is deliberately not the obvious design, and the reason
//  is FlutterFlow. Route arguments only survive if navigation
//  happens through this code — the moment the builder wires a
//  page with its own "Navigate To" action, a route argument is
//  gone and the destination opens blank. A handoff on disk
//  works however the shopper got there.
//
//  ---- One request builds this screen ----
//
//  `/api/app/home` returns the brand, the commerce terms, the
//  departments, every rail already composed and ordered, and
//  the picked-for-you grid. It is the SAME feed the website's
//  homepage renders from: what is trending, which department is
//  big enough to show, how deep a discount has to be — decided
//  once on the server and read by both clients.
// ============================================================

// ------------------------------------------------------------
//  Design — private to this file
// ------------------------------------------------------------

class _KColors {
  const _KColors._();

  /// The page ground.
  static const Color canvas = Color(0xFFFFFFFF);
  static const Color panel = Color(0xFFFFFFFF);

  static const Color ink = Color(0xFF0B0B0B);
  static const Color body = Color(0xFF414346);
  static const Color muted = Color(0xFF5D6066);
  static const Color faint = Color(0xFF8E9196);

  static const Color line = Color(0xFFE0E0E0);
  static const Color hairline = Color(0xFFF2F2F2);

  /// Brand orange is spent on marks that sit ON things and never as a large
  /// ground: white on #ff6a00 is 2.9:1 and fails AA at label sizes.
  static const Color primary = Color(0xFFFF6A00);

  /// A discount and a saving are GREEN here, matching the reference. Green
  /// reads as "money back" without the alarm red carries, and it leaves the
  /// brand orange free for the controls.
  static const Color save = Color(0xFF15803D);
  static const Color saveSoft = Color(0xFFECFDF3);

  /// The delivery badge — black on yellow is 11:1, the most legible pairing
  /// the palette can draw at 10px.
  static const Color express = Color(0xFFFFE000);


  // ---- Shelf grounds ----
  //
  // The website's exact values, so the two clients cannot disagree about what
  // colour "Trending" is. Every one is a saturated step clearing 5:1 against
  // white, because the heading and the "View all" on a coloured shelf are
  // white — a brighter green or amber would look better and fail the heading,
  // which is why these are the darker steps.
  static const Color trending = Color(0xFF7642D6);
  static const Color deals = Color(0xFFB8123A);
  static const Color railBlue = Color(0xFF1E56BD);
  static const Color railMagenta = Color(0xFFB3175A);
  static const Color railGreen = Color(0xFF0B7A43);
  static const Color railAmber = Color(0xFFB45309);
  static const Color railTeal = Color(0xFF0F6E6A);

  /// ---- The money colour ----
  ///
  /// Every price on the page is printed in it. A price set in the same ink as
  /// the product name is a price a scanning eye has to hunt for, and on a grid
  /// of forty tiles that hunt is the whole difference between browsing and
  /// giving up.
  ///
  /// #D62200 rather than a brighter red: white on it is 5.1:1, so the same
  /// value works as a ground under white button text AND as text on white at
  /// the 11px a card's price line runs at. The brighter reds do one or the
  /// other, never both.
  static const Color flame = Color(0xFFD62200);

  /// ---- The edge that makes a white card visible on a white page ----
  ///
  /// The app used to stand its tiles on #F5F5F5 and let the contrast do the
  /// separating. The site does not: its canvas is #ffffff, the same as the
  /// panel, so the tile is drawn by a 1px ring and nothing else. Matching the
  /// ground without matching the ring would have produced a grid of tiles with
  /// no edges at all.
  static const Color edge = Color(0xFFDEDEDE);

  /// The ground behind a product photograph.
  ///
  /// Warm rather than neutral, and that is the point: most of this catalogue is
  /// shot on white, so the box behind it has to be a shade the white sits ON.
  /// A grey would read as a grey rectangle behind the product; #FBF7F4 reads as
  /// paper. It is `--color-shop-photo` on the site.
  static const Color photo = Color(0xFFFBF7F4);

  /// The red a reduced price is set in, and the ground of the corner flag.
  ///
  /// Kept apart from `flame` deliberately. `flame` is a BUTTON ground and was
  /// picked for 5.1:1 against white text; this is TYPE on white and is the
  /// site's `--color-shop-price-was`. Collapsing the two would either dull the
  /// price or fail the buttons.
  static const Color priceWas = Color(0xFFC62828);
}

class _KSpace {
  const _KSpace._();
  static const double xs = 4;
  static const double sm = 8;
  static const double md = 12;
  static const double lg = 16;
  static const double xl = 24;
}

const double _rPanel = 12;

/// The `Accept` header every photograph in this app is fetched with.
///
/// ---- Why an app has to say this out loud ----
///
/// The API hands back image URLs pointing at the storefront's own optimiser
/// (`/_next/image?...`) rather than at the raw WordPress upload, and that
/// endpoint picks its output format from the REQUEST: a client that says it
/// takes WebP gets WebP, and a client that says nothing gets the original
/// format back, resized.
///
/// Dart's HTTP client — which is what `cached_network_image` uses — sends no
/// `Accept` header at all. Without this the app collects the resizing and the
/// CDN delivery and silently leaves the format conversion on the table.
/// Measured against twelve of the home feed's own photographs: 451,147 bytes
/// of JPEG without it, 272,374 of WebP with it. Nearly two fifths of the
/// picture bytes on the screen that has to paint fastest.
///
/// Flutter decodes WebP natively on both Android and iOS, so there is nothing
/// to lose by asking. `image/*` after it is the fallback for any URL not going
/// through the optimiser — a seller avatar on another domain, say — where the
/// server should simply send whatever it has.
const Map<String, String> _kImageHeaders = <String, String>{
  'Accept': 'image/webp,image/*;q=0.8',
};


/// The brand gradient: Kandi orange running into the deep red.
///
/// It carries the chrome — app bars, the home band, the primary buttons — so
/// that every screen is recognisably one shop. Horizontal rather than vertical
/// because an app bar is a wide, short box: a vertical ramp across 56px reads
/// as a flat muddy colour, where a horizontal one across the whole width
/// actually travels.
const LinearGradient _brandGradient = LinearGradient(
  begin: Alignment.centerLeft,
  end: Alignment.centerRight,
  colors: [Color(0xFFFF6A00), Color(0xFFD62200)],
);

/// Fully rounded. The primary calls to action are pills, which is what tells
/// them apart from the square panels they sit on.
const double _rPill = 999;

const String _apiBase = 'https://kandiug.com';

// ------------------------------------------------------------
//  Keys every page in this app agrees on
//
//  These five strings are the entire contract between pages.
//  They are repeated verbatim in each file, and if one changes
//  it must change in all of them at the same time — nothing
//  enforces the agreement, which is the price of pages that do
//  not import each other.
// ------------------------------------------------------------

const String _basketKey = 'kandi-cart-v1';
const String _wishlistKey = 'kandi-wishlist-v1';

/// The product id the product page should open.
const String _openProductKey = 'kandi-open-product';

/// The category the shop page should list: `slug|Name`.
const String _openCategoryKey = 'kandi-open-category';

/// The term the search page should run on open. Empty means "just focus the
/// field" — which is what tapping the search bar here does.
const String _openSearchKey = 'kandi-open-search';

/// The sort the shop page should open on — one of the API's own sort keys.
///
/// Added so a rail's "View all" lands on the aisle it was showing rather than
/// an empty search box. See `_KRail.sort`.
const String _openSortKey = 'kandi-open-sort';

String _money(num amount) {
  final whole = amount.round().toString();
  final out = StringBuffer();
  for (int i = 0; i < whole.length; i++) {
    if (i > 0 && (whole.length - i) % 3 == 0) out.write(',');
    out.write(whole[i]);
  }
  return 'UGX $out';
}

// ------------------------------------------------------------
//  Data
// ------------------------------------------------------------

class _KProduct {
  const _KProduct({
    required this.id,
    required this.name,
    required this.image,
    required this.priceLabel,
    required this.price,
    this.wasPriceLabel,
    this.savingLabel,
    this.discountPercent = 0,
    this.inStock = true,
    this.stockQuantity,
    this.rating = 0,
    this.ratingCount = 0,
    this.totalSales = 0,
    this.hasOptions = false,
    this.isNew = false,
  });

  final int id;
  final String name;
  final String image;
  final String priceLabel;
  final num price;
  final String? wasPriceLabel;
  final String? savingLabel;
  final int discountPercent;
  final bool inStock;

  /// Units left, when WooCommerce is tracking stock for this product.
  ///
  /// Null means "not tracked", which is different from zero — the website's
  /// tile draws the scarcity line only for a real count, and a product with
  /// untracked stock is not nearly gone, it is simply uncounted.
  final int? stockQuantity;
  final num rating;
  final int ratingCount;
  final int totalSales;

  /// Whether buying needs a choice first — a size, a colour.
  ///
  /// A tile cannot show a size picker, so this decides what the `+` does: add a
  /// simple product in one tap, or open the product page where the picker is.
  /// Without it that button either cannot exist for the whole catalogue, or
  /// sends an order for a shoe to wp-admin with no size on it.
  final bool hasOptions;
  final bool isNew;

  static _KProduct? from(dynamic json) {
    if (json is! Map) return null;
    final id = json['id'];
    if (id is! int) return null;
    return _KProduct(
      id: id,
      name: (json['name'] ?? '').toString(),
      image: (json['image'] ?? '').toString(),
      priceLabel: (json['priceLabel'] ?? '').toString(),
      price: json['price'] is num ? json['price'] as num : 0,
      wasPriceLabel: json['wasPriceLabel']?.toString(),
      savingLabel: json['savingLabel']?.toString(),
      discountPercent:
          json['discountPercent'] is int ? json['discountPercent'] as int : 0,
      inStock: json['inStock'] != false,
      stockQuantity:
          json['stockQuantity'] is int ? json['stockQuantity'] as int : null,
      rating: json['rating'] is num ? json['rating'] as num : 0,
      ratingCount: json['ratingCount'] is int ? json['ratingCount'] as int : 0,
      totalSales: json['totalSales'] is int ? json['totalSales'] as int : 0,
      hasOptions: json['hasOptions'] == true,
      isNew: json['isNew'] == true,
    );
  }

  /// Drops malformed rows rather than failing the screen. One bad product
  /// should cost its own tile, not the whole homepage.
  static List<_KProduct> listFrom(dynamic json) {
    if (json is! List) return const [];
    return json.map(_KProduct.from).whereType<_KProduct>().toList();
  }
}

class _KDept {
  const _KDept({required this.name, required this.slug, required this.image});
  final String name;
  final String slug;
  final String image;

  static List<_KDept> listFrom(dynamic json) {
    if (json is! List) return const [];
    final out = <_KDept>[];
    for (final entry in json) {
      if (entry is! Map) continue;
      final name = (entry['name'] ?? '').toString();
      final slug = (entry['slug'] ?? '').toString();
      if (name.isEmpty || slug.isEmpty) continue;
      out.add(_KDept(
          name: name, slug: slug, image: (entry['image'] ?? '').toString()));
    }
    return out;
  }
}

class _KRail {
  const _KRail({
    required this.id,
    required this.title,
    required this.subtitle,
    required this.products,
  });
  final String title;
  final String? subtitle;
  final List<_KProduct> products;

  /// The API's own id for this rail — `trending`, `super-deals`, and so on.
  final String id;

  /// Which sort on the shop page shows more of what this rail is showing.
  ///
  /// "View all" used to open an EMPTY search box on every rail, which is a dead
  /// end: it threw away the one thing the shopper had just expressed an
  /// interest in and asked them to type it again. The shop page can be opened
  /// pre-sorted instead, so "View all" under Best sellers lands on the whole
  /// catalogue ordered by what sells.
  ///
  /// Mapped from the id rather than parsed out of the API's `href`, which is a
  /// web path — `/search?sort=popular` — and would make the app depend on the
  /// website's URL shape. An unrecognised rail falls back to `newest`, which is
  /// the shop page's own default and never wrong, only unhelpful.
  /// The shelf's ground, decided by id.
  ///
  /// A presentation choice, so it lives here rather than in the shared API —
  /// the website makes the same choice in CSS with the same values.
  ///
  /// Every rail was a plain white shelf, so the page had no landmarks below the
  /// second screen: a shopper scrolling back up to "the green one" had nothing
  /// to scroll back to. Seven grounds give the column a rhythm and let a
  /// department be recognised by colour before its heading is read.
  ///
  /// Anything unnamed stays white, deliberately — a page where every shelf is
  /// coloured has no emphasis at all.
  Color? get accent {
    // ---- Which rails get colour, and which deliberately do not ----
    //
    // The first pass named every id the feed can send, which would have painted
    // all twelve rails. That is the same mistake as painting none: a page where
    // every shelf is coloured has no emphasis, just a paintbox.
    //
    // So this matches the website exactly. Trending and Super Deals are the two
    // shelves that sell — what is moving and what is cheapest — and the five
    // department rails are the ones a shopper navigates BY, which is what makes
    // a colour per aisle worth having. New in, Promotions, Daily Deals, New
    // arrivals and Best sellers stay white on both clients: they are the same
    // catalogue in another order, and the white runs between the coloured
    // shelves are what give the column its rhythm.
    if (id.contains('trending')) return _KColors.trending;
    if (id.contains('super-deals')) return _KColors.deals;

    // The department rails the feed appends. "women" is tested before "men"
    // because "men" is a SUBSTRING of "women" — `dept-women` matches a naive
    // `contains('men')` and would come out blue.
    if (id.contains('women')) return _KColors.railMagenta;
    if (id.contains('men')) return _KColors.railBlue;
    if (id.contains('kids')) return _KColors.railGreen;
    if (id.contains('shoes')) return _KColors.railAmber;
    if (id.contains('sports')) return _KColors.railTeal;
    return null;
  }

  String get sort {
    if (id.contains('trending') || id.contains('best-sellers')) return 'popular';
    if (id.contains('deals') || id.contains('promotions')) return 'price_asc';
    return 'newest';
  }

  static List<_KRail> listFrom(dynamic json) {
    if (json is! List) return const [];
    final out = <_KRail>[];
    for (final entry in json) {
      if (entry is! Map) continue;
      final products = _KProduct.listFrom(entry['products']);
      // A rail that parsed empty is dropped rather than drawn as a heading
      // over nothing.
      if (products.isEmpty) continue;
      out.add(_KRail(
        id: (entry['id'] ?? '').toString(),
        title: (entry['title'] ?? '').toString(),
        subtitle: entry['subtitle']?.toString(),
        products: products,
      ));
    }
    return out;
  }
}

// ------------------------------------------------------------
//  Basket and wishlist, shared through the device
// ------------------------------------------------------------

Future<int> _addToBasket(_KProduct product) async {
  try {
    final prefs = await SharedPreferences.getInstance();
    final lines = _readLines(prefs.getString(_basketKey));
    // Keyed on id AND variant: the same shoe in two sizes is two lines, and
    // merging on id alone silently drops a size from the order. A tile can only
    // ever add the no-variant form, hence the trailing separator.
    final key = '${product.id}::';
    final index = lines.indexWhere((line) => line['key'] == key);
    if (index >= 0) {
      final current = lines[index]['quantity'];
      lines[index]['quantity'] = (current is int ? current : 1) + 1;
    } else {
      lines.add({
        'key': key,
        'productId': product.id,
        'name': product.name,
        'image': product.image,
        'price': product.price,
        'priceLabel': product.priceLabel,
        'quantity': 1,
        'variantLabel': null,
      });
    }
    await prefs.setString(_basketKey, jsonEncode(lines));
    return lines.fold<int>(0, (total, line) {
      final q = line['quantity'];
      return total + (q is int ? q : 0);
    });
  } catch (_) {
    // Recoverable — the shopper can tap again. Throwing would take out the
    // tile they just used.
    return 0;
  }
}

List<Map<String, dynamic>> _readLines(String? raw) {
  final out = <Map<String, dynamic>>[];
  if (raw == null) return out;
  try {
    final decoded = jsonDecode(raw);
    if (decoded is List) {
      for (final entry in decoded) {
        if (entry is Map) out.add(Map<String, dynamic>.from(entry));
      }
    }
  } catch (_) {
    // A basket that will not parse is one from an older build.
  }
  return out;
}

Future<int> _basketCount() async {
  try {
    final prefs = await SharedPreferences.getInstance();
    return _readLines(prefs.getString(_basketKey)).fold<int>(0, (total, line) {
      final q = line['quantity'];
      return total + (q is int ? q : 0);
    });
  } catch (_) {
    return 0;
  }
}

/// The wishlist is a plain list of product ids plus enough to draw a tile
/// without a second fetch — the wishlist page has no other source for a name or
/// a price, and a saved item that has to be looked up one request at a time is
/// a page that takes a second to open.
Future<Set<int>> _readWishlistIds() async {
  try {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_wishlistKey);
    if (raw == null) return <int>{};
    final decoded = jsonDecode(raw);
    if (decoded is! List) return <int>{};
    return decoded
        .whereType<Map>()
        .map((entry) => entry['id'])
        .whereType<int>()
        .toSet();
  } catch (_) {
    return <int>{};
  }
}

Future<bool> _toggleWishlist(_KProduct product) async {
  try {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_wishlistKey);
    final items = <Map<String, dynamic>>[];
    if (raw != null) {
      final decoded = jsonDecode(raw);
      if (decoded is List) {
        for (final entry in decoded) {
          if (entry is Map) items.add(Map<String, dynamic>.from(entry));
        }
      }
    }
    final index = items.indexWhere((item) => item['id'] == product.id);
    final added = index < 0;
    if (added) {
      items.add({
        'id': product.id,
        'name': product.name,
        'image': product.image,
        'priceLabel': product.priceLabel,
        'price': product.price,
      });
    } else {
      items.removeAt(index);
    }
    await prefs.setString(_wishlistKey, jsonEncode(items));
    return added;
  } catch (_) {
    return false;
  }
}

/// Writes what the next page needs, then the caller opens it with no arguments.
Future<void> _handoff(String key, String value) async {
  try {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(key, value);
  } catch (_) {
    // The destination falls back to its own empty state — see each page's
    // `initState`. A failed handoff shows an empty search rather than a crash.
  }
}

// ------------------------------------------------------------
//  The screen
// ------------------------------------------------------------

class KandiHomeScreen extends StatefulWidget {
  const KandiHomeScreen({super.key, this.width, this.height});

  final double? width;
  final double? height;

  @override
  State<KandiHomeScreen> createState() => _KandiHomeScreenState();
}

class _KandiHomeScreenState extends State<KandiHomeScreen> {
  bool _loading = true;
  bool _failed = false;

  String _brand = 'KandiUg';
  num _freeDeliveryFrom = 0;
  int _returnsDays = 0;
  List<_KDept> _departments = const [];
  List<_KRail> _rails = const [];
  List<_KProduct> _picked = const [];

  int _cartCount = 0;
  Set<int> _wishlist = <int>{};

  /// Held so the bottom bar's Home tab can return to the top.
  final ScrollController _scroll = ScrollController();

  void _scrollToTop() {
    if (!_scroll.hasClients) return;
    _scroll.animateTo(
      0,
      duration: const Duration(milliseconds: 320),
      curve: Curves.easeOutCubic,
    );
  }

  @override
  void initState() {
    super.initState();
    _load();
    _refreshLocal();
  }

  @override
  void dispose() {
    _scroll.dispose();
    super.dispose();
  }

  Future<void> _refreshLocal() async {
    final count = await _basketCount();
    final wishlist = await _readWishlistIds();
    if (!mounted) return;
    setState(() {
      _cartCount = count;
      _wishlist = wishlist;
    });
  }

  Future<void> _load() async {
    if (mounted) setState(() => _loading = true);

    dynamic data;
    int status = 0;
    try {
      final response = await http
          .get(Uri.parse('$_apiBase/api/app/home'))
          .timeout(const Duration(seconds: 20));
      status = response.statusCode;
      data = jsonDecode(response.body);
    } catch (_) {
      // A timeout, a DNS failure and a dropped connection are the same event to
      // a shopper — the shop did not answer — and all render the same retry.
      status = 0;
    }

    if (!mounted) return;

    if (status != 200 || data is! Map) {
      setState(() {
        _loading = false;
        // Only a true failure when nothing is on screen already. A failed
        // pull-to-refresh over a good render should leave the good render
        // alone rather than replacing a working shop with an error.
        _failed = _rails.isEmpty && _picked.isEmpty;
      });
      return;
    }

    final brand = data['brand'];
    final commerce = data['commerce'];

    setState(() {
      _loading = false;
      _failed = false;
      if (brand is Map && brand['name'] != null) _brand = brand['name'].toString();
      if (commerce is Map) {
        _freeDeliveryFrom = commerce['freeDeliveryFrom'] is num
            ? commerce['freeDeliveryFrom'] as num
            : 0;
        _returnsDays =
            commerce['returnsDays'] is int ? commerce['returnsDays'] as int : 0;
      }
      _departments = _KDept.listFrom(data['departments']);
      _rails = _KRail.listFrom(data['rails']);
      _picked = _KProduct.listFrom(data['pickedForYou']);
    });
  }

  // ---- Navigation. Nothing is passed; the destination reads the device. ----

  Future<void> _openProduct(_KProduct product) async {
    await _handoff(_openProductKey, '${product.id}');
    if (!mounted) return;
    await Navigator.of(context)
        .push(MaterialPageRoute(builder: (_) => const KandiProductScreen()));
    await _refreshLocal();
  }

  /// The whole catalogue, no department and no sort.
  Future<void> _openShopAll() async {
    await _handoff(_openCategoryKey, '');
    await _handoff(_openSortKey, '');
    if (!mounted) return;
    await Navigator.of(context)
        .push(MaterialPageRoute(builder: (_) => const KandiShopScreen()));
    await _refreshLocal();
  }

  Future<void> _openCategory(_KDept department) async {
    await _handoff(_openCategoryKey, '${department.slug}|${department.name}');
    if (!mounted) return;
    await Navigator.of(context)
        .push(MaterialPageRoute(builder: (_) => const KandiShopScreen()));
    await _refreshLocal();
  }

  /// Opens the shop page showing more of what a rail was showing.
  ///
  /// The category is cleared deliberately: a rail is a slice of the WHOLE
  /// catalogue, not of one aisle, so leaving a stale department set would show
  /// "Best sellers" filtered to whichever department was last opened.
  Future<void> _openRail(_KRail rail) async {
    await _handoff(_openCategoryKey, '');
    await _handoff(_openSortKey, rail.sort);
    if (!mounted) return;
    await Navigator.of(context)
        .push(MaterialPageRoute(builder: (_) => const KandiShopScreen()));
    await _refreshLocal();
  }

  Future<void> _openSearch() async {
    await _handoff(_openSearchKey, '');
    if (!mounted) return;
    await Navigator.of(context)
        .push(MaterialPageRoute(builder: (_) => const KandiSearchScreen()));
    await _refreshLocal();
  }

  /// Opens a top-level tab from the bottom bar.
  ///
  /// `popUntil(isFirst)` before pushing, matching every other tab page. Home is
  /// usually the root already, so the pop is a no-op here — but it is not
  /// guaranteed to be: FlutterFlow decides which page the app opens on, and if
  /// that is Shop then Home is a pushed screen like any other. Doing the same
  /// thing on all five pages means the stack cannot grow whichever one the
  /// builder made the entry point.
  Future<void> _push(Widget screen) async {
    Navigator.of(context).popUntil((route) => route.isFirst);
    if (!mounted) return;
    await Navigator.of(context).push(MaterialPageRoute(builder: (_) => screen));
    await _refreshLocal();
  }

  Future<void> _add(_KProduct product) async {
    final count = await _addToBasket(product);
    if (!mounted) return;
    setState(() => _cartCount = count);
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('${product.name} added'),
        duration: const Duration(seconds: 2),
        behavior: SnackBarBehavior.floating,
        action: SnackBarAction(
          label: 'Basket',
          textColor: Colors.white,
          onPressed: () => _push(const KandiCartScreen()),
        ),
      ),
    );
  }

  Future<void> _toggleSaved(_KProduct product) async {
    final added = await _toggleWishlist(product);
    if (!mounted) return;
    setState(() {
      if (added) {
        _wishlist.add(product.id);
      } else {
        _wishlist.remove(product.id);
      }
    });
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(added ? 'Saved' : 'Removed from saved'),
        duration: const Duration(seconds: 1),
        behavior: SnackBarBehavior.floating,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: widget.width,
      height: widget.height,
      child: Scaffold(
        backgroundColor: _KColors.canvas,
        body: _failed ? _buildFailed() : _buildBody(),
        bottomNavigationBar: _buildBottomBar(),
      ),
    );
  }

  Widget _buildFailed() {
    return SafeArea(
      child: Center(
        child: Padding(
          padding: const EdgeInsets.all(_KSpace.xl),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.wifi_off_rounded, size: 44, color: _KColors.muted),
              const SizedBox(height: _KSpace.md),
              const Text('Could not reach the shop',
                  style: TextStyle(
                      fontSize: 17, fontWeight: FontWeight.w800, color: _KColors.ink)),
              const SizedBox(height: _KSpace.sm),
              const Text(
                'Check your connection and try again. Nothing in your basket has been lost.',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 13.5, height: 1.5, color: _KColors.body),
              ),
              const SizedBox(height: _KSpace.lg),
              FilledButton(
                onPressed: _load,
                style: FilledButton.styleFrom(backgroundColor: _KColors.flame),
                child: const Text('Try again'),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildBody() {
    return RefreshIndicator(
      color: _KColors.primary,
      onRefresh: _load,
      child: CustomScrollView(
        controller: _scroll,
        slivers: [
          SliverToBoxAdapter(child: _buildHeader()),
          if (_loading && _rails.isEmpty && _picked.isEmpty)
            const SliverToBoxAdapter(child: _Skeleton())
          else ...[
            if (_freeDeliveryFrom > 0 || _returnsDays > 0)
              SliverToBoxAdapter(
                child: _TermsStrip(
                    freeDeliveryFrom: _freeDeliveryFrom, returnsDays: _returnsDays),
              ),
            for (final rail in _rails)
              SliverToBoxAdapter(
                child: _RailSection(
                  rail: rail,
                  freeDeliveryFrom: _freeDeliveryFrom,
                  savedIds: _wishlist,
                  onOpen: _openProduct,
                  onAdd: _add,
                  onSave: _toggleSaved,
                  onViewAll: () => _openRail(rail),
                ),
              ),
            if (_picked.isNotEmpty) ...[
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(
                      _KSpace.md, _KSpace.xl, _KSpace.md, _KSpace.md),
                  child: Row(
                    children: [
                      Container(
                        width: 3.5,
                        height: 16,
                        decoration: BoxDecoration(
                          color: _KColors.flame,
                          borderRadius: BorderRadius.circular(2),
                        ),
                      ),
                      const SizedBox(width: 7),
                      const Expanded(
                        child: Text('Picked for you',
                            style: TextStyle(
                                fontSize: 17,
                                letterSpacing: -0.2,
                                fontWeight: FontWeight.w900,
                                color: _KColors.ink)),
                      ),
                      // The endless grid IS the catalogue, so this opens
                      // the shop with no sort and no department rather than a
                      // search box.
                      _ViewAll(onTap: () => _openShopAll()),
                    ],
                  ),
                ),
              ),
              SliverPadding(
                padding: const EdgeInsets.symmetric(horizontal: _KSpace.md),
                sliver: SliverGrid(
                  gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                    crossAxisCount: 2,
                    mainAxisSpacing: _KSpace.md,
                    crossAxisSpacing: _KSpace.md,
                    // A square photograph plus the card's text rows, added
                    // up rather than guessed: at 390 wide a tile is 171px, and
                    // 171 / 0.50 is the 342 the fullest card needs. The old
                    // 0.46 left about 90px of empty white under most of them.
                    // ---- 0.62, where this was 0.57 ----
                    //
                    // The tile got shorter and this is the figure that has to
                    // follow it: the price dropped from 17px to the site's 12,
                    // the struck original came off the phone entirely, and the
                    // sold-and-stars row moved below the price rather than
                    // adding a row above it. Left at 0.57 every cell would carry
                    // about forty pixels of empty white BELOW the price and
                    // inside the tile's new border, which is dead space a
                    // borderless tile could hide and a bordered one cannot.
                    //
                    // Slack rather than a tight fit, deliberately. The rows grow
                    // with the reader's text size and the price is bottom-pinned,
                    // so what is left over collects above the price as air —
                    // whereas a cell one pixel too short clips the bottom row.
                    childAspectRatio: 0.62,
                  ),
                  delegate: SliverChildBuilderDelegate(
                    (context, index) {
                      final product = _picked[index];
                      return _Card(
                        product: product,
                        freeDeliveryFrom: _freeDeliveryFrom,
                        saved: _wishlist.contains(product.id),
                        onOpen: () => _openProduct(product),
                        onAdd: () => _add(product),
                        onSave: () => _toggleSaved(product),
                      );
                    },
                    childCount: _picked.length,
                  ),
                ),
              ),
            ],
          ],
          const SliverToBoxAdapter(child: SizedBox(height: _KSpace.xl)),
        ],
      ),
    );
  }

  /// The brand band: search, then the departments.
  ///
  /// ---- Search moved to the top ----
  ///
  /// It used to sit under the department pills. Search is the highest-intent
  /// control on the page — a shopper who knows the word for what they want is
  /// worth more than one browsing — and it now takes the first line under the
  /// status bar, where the thumb reaches it without a scroll.
  ///
  /// ---- The band is the gradient, and it runs under the status bar ----
  ///
  /// `SafeArea` is INSIDE the container, not around it, so the colour paints
  /// the notch strip and the content sits below it. The other way round leaves
  /// a white bar above the gradient on every phone with a cutout.
  ///
  /// Still a gradient rather than artwork: an illustration behind a search
  /// field costs a download on the one screen that has to paint fastest.
  Widget _buildHeader() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _buildBrandBand(),
        if (_departments.isNotEmpty) _buildDepartmentStrip(),
      ],
    );
  }

  Widget _buildBrandBand() {
    return Container(
      decoration: const BoxDecoration(gradient: _brandGradient),
      child: SafeArea(
        bottom: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(0, _KSpace.sm, 0, _KSpace.md),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: _KSpace.md),
                child: Row(
                  children: [
                    // The shop's name, set in the header rather than on a pill
                    // of its own. As a pill it was a button that reloaded the
                    // page — a control nobody was looking for, in the spot
                    // where a shop's name belongs.
                    Text(_brand,
                        style: const TextStyle(
                            fontSize: 20,
                            height: 1.1,
                            letterSpacing: -0.4,
                            fontWeight: FontWeight.w900,
                            color: Colors.white)),
                    const Spacer(),
                    _HeaderIcon(
                        icon: Icons.favorite_border_rounded,
                        tooltip: 'Saved',
                        onTap: () => _push(const KandiWishlistScreen())),
                    const SizedBox(width: 2),
                    _HeaderIcon(
                        icon: Icons.receipt_long_rounded,
                        tooltip: 'My orders',
                        onTap: () => _push(const KandiOrdersScreen())),
                  ],
                ),
              ),
              const SizedBox(height: _KSpace.sm),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: _KSpace.md),
                child: _SearchBar(onTap: _openSearch),
              ),
            ],
          ),
        ),
      ),
    );
  }

  /// The departments, on white, directly under the band.
  ///
  /// The fastest route for a shopper who arrived knowing what they want, and —
  /// with the website's category grid gone — the only map of the catalogue a
  /// phone ever shows. Which is exactly why it cannot live on the gradient:
  /// white text on a translucent pill over orange measured about 2.3:1.
  Widget _buildDepartmentStrip() {
    return Container(
      color: _KColors.panel,
      padding: const EdgeInsets.symmetric(vertical: _KSpace.sm),
      child: SizedBox(
        height: 32,
        child: ListView(
          scrollDirection: Axis.horizontal,
          padding: const EdgeInsets.symmetric(horizontal: _KSpace.md),
          children: [
            for (final department in _departments)
              Padding(
                padding: const EdgeInsets.only(right: _KSpace.sm),
                child: _BrandPill(
                  label: department.name,
                  onTap: () => _openCategory(department),
                ),
              ),
          ],
        ),
      ),
    );
  }

  /// Five destinations, always reachable.
  ///
  /// A bottom bar rather than a drawer: every page in this app is a full-screen
  /// push, and without a persistent bar the only way back to Home from four
  /// levels deep is four back taps. The basket carries its count here as well
  /// as on the cards, because that is the number a shopper checks before
  /// deciding they are finished.
  Widget _buildBottomBar() {
    return Container(
      decoration: const BoxDecoration(
        color: _KColors.panel,
        border: Border(top: BorderSide(color: _KColors.line)),
        boxShadow: [
          BoxShadow(
              color: Color(0x0F000000), blurRadius: 12, offset: Offset(0, -2)),
        ],
      ),
      child: SafeArea(
        top: false,
        child: SizedBox(
          height: 58,
          child: Row(
            children: [
              _NavItem(
                icon: Icons.home_rounded,
                label: 'Home',
                active: true,
                // Was an empty callback — a button that visibly did nothing.
                // Tapping the tab you are already on means "take me back to the
                // top", which is what every app with a bottom bar does and what
                // a shopper twelve rails down actually wants.
                onTap: _scrollToTop,
              ),
              _NavItem(
                  icon: Icons.grid_view_rounded,
                  label: 'Shop',
                  onTap: () => _push(const KandiShopScreen())),
              _NavItem(
                  icon: Icons.favorite_border_rounded,
                  label: 'Saved',
                  onTap: () => _push(const KandiWishlistScreen())),
              _NavItem(
                icon: Icons.shopping_cart_outlined,
                label: 'Basket',
                badge: _cartCount,
                onTap: () => _push(const KandiCartScreen()),
              ),
              _NavItem(
                  icon: Icons.person_outline_rounded,
                  label: 'Account',
                  onTap: () => _push(const KandiAccountScreen())),
            ],
          ),
        ),
      ),
    );
  }
}

// ------------------------------------------------------------
//  Pieces
// ------------------------------------------------------------

class _BrandPill extends StatelessWidget {
  const _BrandPill({required this.label, required this.onTap});

  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        alignment: Alignment.center,
        padding: const EdgeInsets.symmetric(horizontal: 14),
        decoration: BoxDecoration(
          // A grey pill with dark text. On the gradient this was a translucent
          // white pill with white text on it, which measured about 2.3:1 —
          // the least legible thing on the page, and the only map of the
          // catalogue a phone has left. On white it runs at 12:1.
          color: _KColors.hairline,
          borderRadius: BorderRadius.circular(_rPill),
        ),
        child: Text(
          label,
          style: const TextStyle(
              fontSize: 13, fontWeight: FontWeight.w700, color: _KColors.ink),
        ),
      ),
    );
  }
}

/// A white icon on the brand band.
///
/// Its 40px box is the hit area, not the 22px glyph — an icon sized for a
/// header is well under what a thumb can land on, and the padding is what
/// closes that gap without drawing anything.
class _HeaderIcon extends StatelessWidget {
  const _HeaderIcon(
      {required this.icon, required this.tooltip, required this.onTap});

  final IconData icon;
  final String tooltip;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Tooltip(
      message: tooltip,
      child: GestureDetector(
        onTap: onTap,
        behavior: HitTestBehavior.opaque,
        child: SizedBox(
          width: 40,
          height: 40,
          child: Icon(icon, size: 22, color: Colors.white),
        ),
      ),
    );
  }
}

/// Looks like a field and is a button.
///
/// Tapping opens the search page, which has the real `TextField` and the
/// keyboard focus. A live field here would need this screen to own search state
/// it does not otherwise have, and the reference does the same thing.
class _SearchBar extends StatelessWidget {
  const _SearchBar({required this.onTap});

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        height: 44,
        padding: const EdgeInsets.fromLTRB(_KSpace.md, 0, 4, 0),
        decoration: BoxDecoration(
          color: _KColors.panel,
          borderRadius: BorderRadius.circular(_rPill),
        ),
        child: Row(
          children: [
            const Icon(Icons.search_rounded, size: 20, color: _KColors.muted),
            const SizedBox(width: _KSpace.sm),
            const Expanded(
              child: Text('Search for shoes, phones, home…',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(fontSize: 14, color: _KColors.muted)),
            ),
            // A filled button inside the field. It does the same thing as
            // tapping the field, and it is here because a white pill on a
            // white-flecked gradient can read as decoration — the coloured
            // button is what makes it unmistakably a control.
            Container(
              width: 62,
              height: 36,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                gradient: _brandGradient,
                borderRadius: BorderRadius.circular(_rPill),
              ),
              child: const Text('Search',
                  style: TextStyle(
                      fontSize: 12.5,
                      fontWeight: FontWeight.w800,
                      color: Colors.white)),
            ),
          ],
        ),
      ),
    );
  }
}

class _NavItem extends StatelessWidget {
  const _NavItem({
    required this.icon,
    required this.label,
    required this.onTap,
    this.active = false,
    this.badge = 0,
  });

  final IconData icon;
  final String label;
  final VoidCallback onTap;
  final bool active;
  final int badge;

  @override
  Widget build(BuildContext context) {
    final colour = active ? _KColors.flame : _KColors.muted;
    return Expanded(
      child: InkWell(
        onTap: onTap,
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Stack(
              clipBehavior: Clip.none,
              children: [
                Icon(icon, size: 22, color: colour),
                if (badge > 0)
                  Positioned(
                    right: -7,
                    top: -5,
                    child: Container(
                      padding:
                          const EdgeInsets.symmetric(horizontal: 4, vertical: 1),
                      constraints: const BoxConstraints(minWidth: 16),
                      decoration: BoxDecoration(
                        color: _KColors.flame,
                        borderRadius: BorderRadius.circular(8),
                        // A white ring keeps the badge legible over the icon.
                        border: Border.all(color: Colors.white, width: 1.4),
                      ),
                      child: Text(
                        badge > 99 ? '99+' : '$badge',
                        textAlign: TextAlign.center,
                        style: const TextStyle(
                            fontSize: 9,
                            height: 1.3,
                            fontWeight: FontWeight.w800,
                            color: Colors.white),
                      ),
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 3),
            Text(label,
                style: TextStyle(
                    fontSize: 10.5, fontWeight: FontWeight.w600, color: colour)),
          ],
        ),
      ),
    );
  }
}

/// The shop's terms, once, under the search band.
///
/// The three things a first-time Ugandan shopper asks about a shop they have
/// not bought from. Every figure comes from the API, so the app cannot promise
/// a window the checkout will not honour.
class _TermsStrip extends StatelessWidget {
  const _TermsStrip({required this.freeDeliveryFrom, required this.returnsDays});

  final num freeDeliveryFrom;
  final int returnsDays;

  @override
  Widget build(BuildContext context) {
    final terms = <String>[
      if (freeDeliveryFrom > 0) 'Free delivery over ${_money(freeDeliveryFrom)}',
      'Pay on delivery',
      if (returnsDays > 0) '$returnsDays-day returns',
    ];

    return Container(
      margin: const EdgeInsets.fromLTRB(_KSpace.md, _KSpace.md, _KSpace.md, 0),
      padding: const EdgeInsets.all(_KSpace.md),
      decoration: BoxDecoration(
        color: _KColors.saveSoft,
        borderRadius: BorderRadius.circular(_rPanel),
      ),
      child: Wrap(
        spacing: _KSpace.md,
        runSpacing: _KSpace.xs,
        children: [
          for (final term in terms)
            Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.check_circle_rounded,
                    size: 14, color: _KColors.save),
                const SizedBox(width: 4),
                Text(term,
                    style: const TextStyle(
                        fontSize: 11.5,
                        fontWeight: FontWeight.w600,
                        color: _KColors.ink)),
              ],
            ),
        ],
      ),
    );
  }
}

class _ViewAll extends StatelessWidget {
  const _ViewAll({required this.onTap, this.onAccent = false});

  final VoidCallback onTap;

  /// Whether this sits on a coloured shelf.
  ///
  /// The default blue is a link colour for a white page and is close to
  /// unreadable on the blue and violet grounds. White works on all seven,
  /// which is the point of choosing grounds that clear 5:1 against it.
  final bool onAccent;

  @override
  Widget build(BuildContext context) {
    final colour = onAccent ? Colors.white : _KColors.flame;
    return GestureDetector(
      onTap: onTap,
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text('View all',
              style: TextStyle(
                  fontSize: 13.5,
                  fontWeight: FontWeight.w700,
                  color: colour)),
          Icon(Icons.chevron_right_rounded, size: 18, color: colour),
        ],
      ),
    );
  }
}

class _RailSection extends StatelessWidget {
  const _RailSection({
    required this.rail,
    required this.freeDeliveryFrom,
    required this.savedIds,
    required this.onOpen,
    required this.onAdd,
    required this.onSave,
    required this.onViewAll,
  });

  final _KRail rail;
  final num freeDeliveryFrom;
  final Set<int> savedIds;
  final ValueChanged<_KProduct> onOpen;
  final ValueChanged<_KProduct> onAdd;
  final ValueChanged<_KProduct> onSave;
  final VoidCallback onViewAll;

  @override
  Widget build(BuildContext context) {
    final accent = rail.accent;
    final onAccent = accent != null;

    // ---- The shelf is a coloured slab, or nothing at all ----
    //
    // A coloured rail gets a rounded panel with a margin; a plain one stays
    // flush with the page. That difference is the whole point: if every shelf
    // had a box, the boxes would stop meaning anything.
    return Container(
      margin: onAccent
          ? const EdgeInsets.fromLTRB(
              _KSpace.md, _KSpace.xl, _KSpace.md, 0)
          : EdgeInsets.zero,
      padding: onAccent
          ? const EdgeInsets.symmetric(vertical: _KSpace.lg)
          : EdgeInsets.zero,
      decoration: onAccent
          ? BoxDecoration(
              color: accent,
              borderRadius: BorderRadius.circular(_rPanel),
            )
          : null,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: EdgeInsets.fromLTRB(
                _KSpace.md, onAccent ? 0 : _KSpace.xl, _KSpace.md, _KSpace.md),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          // A short bar in the money colour, on the plain
                          // shelves only. The coloured ones already announce
                          // themselves with the whole slab; on white, twelve
                          // headings set in the same weight run together, and
                          // the bar is what gives a scrolling eye somewhere to
                          // catch.
                          if (!onAccent) ...[
                            Container(
                              width: 3.5,
                              height: 16,
                              decoration: BoxDecoration(
                                color: _KColors.flame,
                                borderRadius: BorderRadius.circular(2),
                              ),
                            ),
                            const SizedBox(width: 7),
                          ],
                          Flexible(
                            child: Text(rail.title,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: TextStyle(
                                    fontSize: 17,
                                    height: 1.25,
                                    letterSpacing: -0.2,
                                    fontWeight: FontWeight.w900,
                                    // White on the coloured grounds, which is
                                    // why every one of them clears 5:1
                                    // against white.
                                    color: onAccent
                                        ? Colors.white
                                        : _KColors.ink)),
                          ),
                        ],
                      ),
                      if (rail.subtitle != null && rail.subtitle!.isNotEmpty)
                        Padding(
                          padding: const EdgeInsets.only(top: 2),
                          child: Text(rail.subtitle!,
                              style: TextStyle(
                                  fontSize: 12.5,
                                  // 78% white, not 60: 60% fails AA on the
                                  // lighter of these grounds.
                                  color: onAccent
                                      ? const Color(0xC7FFFFFF)
                                      : _KColors.muted)),
                      ),
                  ],
                ),
              ),
              const SizedBox(width: _KSpace.sm),
                _ViewAll(onTap: onViewAll, onAccent: onAccent),
            ],
          ),
        ),
        SizedBox(
          // Tall enough for the card's photograph plus every text row it can
          // draw. Fixed, because a horizontal list has no height to measure.
          // Taller than it was: the card gained the scarcity line and its bar,
          // and a horizontal list has no height of its own to measure — an
          // under-sized box clips the bottom row rather than scrolling it.
          // 278, down from 302, for the reason on `childAspectRatio`
          // above: the shorter tile. A rail card is 168 wide, so its
          // photograph is 154 and the four rows under it come to about 78 —
          // 278 leaves the same slack the grid does, which the bottom-pinned
          // price turns into air above the figure rather than a gap below it.
          height: 278,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: _KSpace.md),
            itemCount: rail.products.length,
            separatorBuilder: (_, __) => const SizedBox(width: _KSpace.md),
            itemBuilder: (context, index) {
              final product = rail.products[index];
              return SizedBox(
                width: 168,
                child: _Card(
                  product: product,
                  freeDeliveryFrom: freeDeliveryFrom,
                  saved: savedIds.contains(product.id),
                  onOpen: () => onOpen(product),
                  onAdd: () => onAdd(product),
                  onSave: () => onSave(product),
                ),
              );
            },
          ),
          ),
        ],
      ),
    );
  }
}

/// The product card, drawn to match the website's tile.
///
/// ---- What changed, and why each piece moved ----
///
/// The app and the site were showing the same catalogue in two different
/// layouts, which is the one thing a shop with both must not do: somebody who
/// browses on the phone and buys on the laptop should recognise the product,
/// not re-learn the card.
///
/// So the anatomy is the site's, piece for piece:
///
///   • The yellow discount flag is top RIGHT of the photograph, the loudest
///     thing on a resting tile.
///   • The heart moves to the top LEFT, where the badge used to be.
///   • The programme chip — "Super Deal", "New" — moves OFF the photograph and
///     INTO the name line. It rides the name's own clamp, so it costs the card
///     no height at all; as a corner badge it was competing with the discount
///     flag for the same glance.
///   • The basket button is a white circle with a drawn ring, not a rounded
///     square. It floats over a photograph that can be any colour including
///     white — most of this catalogue is shot on it — so a white disc with no
///     edge is an invisible button on half the grid.
///   • "Only N left" arrives with its bar. That is the site's one honest
///     urgency device: the bar is `stockQuantity` out of the threshold that put
///     the warning there, so it can never say "nearly gone" about a product
///     with plenty in the back.
///
/// The WHOLE card is still the tap target. A shopper aims at a card, and on a
/// phone the gaps between its rows are thumb-sized — two small live regions
/// with dead space between them feels broken without anybody being able to say
/// why. The heart and the basket sit above that gesture and take their own
/// taps.
class _Card extends StatelessWidget {
  const _Card({
    required this.product,
    required this.freeDeliveryFrom,
    required this.saved,
    required this.onOpen,
    required this.onAdd,
    required this.onSave,
  });

  final _KProduct product;
  final num freeDeliveryFrom;
  final bool saved;
  final VoidCallback onOpen;
  final VoidCallback onAdd;
  final VoidCallback onSave;

  /// The threshold the website uses before it calls stock low.
  static const int _lowStockAt = 5;

  bool get _lowStock =>
      product.inStock &&
      product.stockQuantity != null &&
      product.stockQuantity! <= _lowStockAt;

  /// Whether this item alone clears the free-delivery threshold.
  ///
  /// Derived rather than sent: the API has no per-product delivery field, and
  /// the threshold here is the figure checkout actually applies.
  bool get _freeDelivery =>
      freeDeliveryFrom > 0 && product.price >= freeDeliveryFrom;

  /// The chip that rides the name line.
  ///
  /// One at most, in order of usefulness to a shopper who has not decided: a
  /// deep cut, then a new listing. A chip on every card is a chip that means
  /// nothing, which is why there is no fallback.
  ///
  /// 3px corners and 9px bold, which is what `ProductCard.tsx` sets on the same
  /// chip — it is a `WidgetSpan` here and an inline `<span>` there, so the name
  /// wraps around it rather than under it in both.
  ({String label, Color background, Color foreground})? get _chip {
    if (product.discountPercent >= 30) {
      return (
        label: 'Super Deal',
        background: _KColors.express,
        foreground: _KColors.ink
      );
    }
    if (product.isNew) {
      return (label: 'New', background: _KColors.save, foreground: Colors.white);
    }
    return null;
  }

  /// The strip across the bottom of the photograph.
  ///
  /// ---- One of two places this tile deliberately differs from the site ----
  ///
  /// The website puts the shilling saving in a green chip BELOW the name and
  /// the free-delivery promise in a row below that — two rows of tile height
  /// for two facts. On a phone tile roughly 165px wide those two rows are the
  /// difference between the price landing on the first screen and landing
  /// under the fold, so they ride the photograph here instead, where they cost
  /// no height at all.
  ///
  /// The other difference is the heart, which the site shows on hover only. A
  /// hover state on a touch screen is a control that does not exist, so it
  /// stays visible here. Both deviations are additions rather than departures:
  /// nothing the site shows is missing, it is only placed where a thumb can
  /// reach it.
  ///
  /// Suppressed when the product is out of stock: a saving on something that
  /// cannot be bought is noise, and the corner is needed for the sold-out mark.
  String? get _ribbon {
    if (!product.inStock) return null;
    final parts = <String>[
      if (product.savingLabel != null) 'SAVE ${product.savingLabel}',
      if (_freeDelivery) 'FREE DELIVERY',
    ];
    return parts.isEmpty ? null : parts.join(' · ');
  }

  @override
  Widget build(BuildContext context) {
    final chip = _chip;

    return Semantics(
      button: true,
      label: '${product.name}. ${product.priceLabel}',
      child: GestureDetector(
        onTap: onOpen,
        // Opaque, so the gesture covers the gaps between rows and not only the
        // pixels the children happen to paint.
        behavior: HitTestBehavior.opaque,
        child: Container(
          decoration: BoxDecoration(
            color: _KColors.panel,
            // ---- Square, with a drawn edge ----
            //
            // Both halves come from `.tile-card` in globals.css and both are a
            // change from what this app drew. The corners were 12px and are
            // now 0: the site squared them so that tiles could touch in a
            // flush grid without leaving a white notch at each of the four
            // corners they share, and a tile that is square there and rounded
            // here is the single most obvious way the two stop looking like
            // one shop.
            //
            // The 1px ring is what replaces the grey page. The app stood its
            // cards on #F5F5F5 and let the contrast draw them; the site stands
            // them on white and draws them with `inset 0 0 0 1px` in
            // `--color-shop-edge`. Taking the tint away without adding the ring
            // would have left a grid with no tiles in it.
            border: Border.all(color: _KColors.edge),
          ),
          // 6px, where this was 8. It is `p-1.5` on the site, and on a 177px
          // tile the two pixels a side are four pixels of photograph.
          padding: const EdgeInsets.all(6),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              AspectRatio(
                aspectRatio: 1,
                child: ClipRRect(
                  // 10px, matching `.tile-frame`. The corners are on the Stack
                  // rather than on the picture: the deal strip is a sibling of
                  // the photograph, and clipping only the photograph would
                  // leave the strip with square ends hanging off a rounded one.
                  borderRadius: BorderRadius.circular(10),
                  child: Stack(
                    fit: StackFit.expand,
                    children: [
                      _Photo(url: product.image),

                      // Top LEFT: the heart, on its own white disc. See the
                      // note on `_ribbon` for why it is visible at rest here
                      // and only on hover on the site.
                      Positioned(
                        top: 6,
                        left: 6,
                        child: GestureDetector(
                          onTap: onSave,
                          behavior: HitTestBehavior.opaque,
                          child: Container(
                            width: 30,
                            height: 30,
                            decoration: BoxDecoration(
                              color: const Color(0xF2FFFFFF),
                              shape: BoxShape.circle,
                              // `ring-1 ring-black/5` on the site. A white disc
                              // on a photograph shot on white has no edge
                              // without it, and most of this catalogue is shot
                              // on white.
                              border: Border.all(color: const Color(0x0D000000)),
                            ),
                            child: Icon(
                              saved
                                  ? Icons.favorite_rounded
                                  : Icons.favorite_border_rounded,
                              size: 17,
                              color: saved ? _KColors.priceWas : _KColors.body,
                            ),
                          ),
                        ),
                      ),

                      // ---- Top RIGHT: the cut ----
                      //
                      // Red ground, white type, fully rounded — which is a
                      // change on all three counts. This was a yellow chip with
                      // ink type and an 8px corner; the site draws
                      // `bg-[--color-shop-price-was] text-white rounded-full`,
                      // and the red is the same red the reduced price below is
                      // set in, so the flag and the figure agree.
                      if (product.inStock && product.discountPercent > 0)
                        Positioned(
                          top: 6,
                          right: 6,
                          child: Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 8, vertical: 4),
                            decoration: BoxDecoration(
                              color: _KColors.priceWas,
                              borderRadius: BorderRadius.circular(999),
                            ),
                            child: Text('-${product.discountPercent}%',
                                style: const TextStyle(
                                    fontSize: 11,
                                    height: 1,
                                    fontWeight: FontWeight.w800,
                                    color: Colors.white)),
                          ),
                        ),

                      // Sold out, in the site's white pill rather than the
                      // black one this used to draw. It sits top-right where
                      // the site puts it top-left, because the heart holds that
                      // corner here — see the note on `_ribbon`.
                      if (!product.inStock)
                        Positioned(
                          top: 6,
                          right: 6,
                          child: Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 10, vertical: 4),
                            decoration: BoxDecoration(
                              color: const Color(0xF2FFFFFF),
                              borderRadius: BorderRadius.circular(999),
                              border: Border.all(color: _KColors.line),
                            ),
                            child: const Text('Sold out',
                                style: TextStyle(
                                    fontSize: 11,
                                    height: 1,
                                    fontWeight: FontWeight.w700,
                                    color: _KColors.body)),
                          ),
                        ),

                      // The deal strip. Full width across the foot of the
                      // photograph; the right padding clears the basket button,
                      // which floats over the strip's end rather than being
                      // pushed off the tile by it.
                      if (_ribbon != null)
                        Positioned(
                          left: 0,
                          right: 0,
                          bottom: 0,
                          child: Container(
                            padding: const EdgeInsets.fromLTRB(7, 3.5, 44, 3.5),
                            decoration:
                                const BoxDecoration(gradient: _brandGradient),
                            child: Text(_ribbon!,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: const TextStyle(
                                    fontSize: 9.5,
                                    height: 1.25,
                                    letterSpacing: 0.2,
                                    fontWeight: FontWeight.w800,
                                    color: Colors.white)),
                          ),
                        ),

                      if (product.inStock)
                        Positioned(
                          bottom: 6,
                          right: 6,
                          child: GestureDetector(
                            // A product with options cannot be added from a
                            // card — it opens instead, where the picker is.
                            onTap: product.hasOptions ? onOpen : onAdd,
                            behavior: HitTestBehavior.opaque,
                            child: Container(
                              width: 34,
                              height: 34,
                              decoration: BoxDecoration(
                                color: const Color(0xF2FFFFFF),
                                shape: BoxShape.circle,
                                border:
                                    Border.all(color: const Color(0x0D000000)),
                              ),
                              child: Icon(
                                  product.hasOptions
                                      ? Icons.tune_rounded
                                      : Icons.add_shopping_cart_rounded,
                                  size: 18,
                                  color: _KColors.body),
                            ),
                          ),
                        ),
                    ],
                  ),
                ),
              ),

              // 8px, which is `pt-2` on the site: the one piece of vertical
              // space in this block that is not simply a row's own leading.
              const SizedBox(height: 8),

              // ---- The name: 12/15 at weight 300 ----
              //
              // All three numbers are the site's, and the weight is the one
              // worth pausing on. It is 300 on a phone and 400 from `sm` up —
              // see the `.product-name` media query in globals.css. The
              // argument there is that the name is the only thing on a tile
              // that is not a claim: the price, the saving and the stock line
              // are all set in weight or colour because they are what a shopper
              // compares, and a name competing with all three reads as a fourth
              // claim rather than as the caption it is.
              //
              // The height is fixed at two lines rather than clamped to two, so
              // a one-line name does not shorten its tile and land the prices
              // in a row on two different baselines.
              SizedBox(
                height: 30,
                child: RichText(
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  text: TextSpan(
                    style: const TextStyle(
                        fontSize: 12,
                        height: 15 / 12,
                        fontWeight: FontWeight.w300,
                        color: _KColors.ink),
                    children: [
                      if (chip != null)
                        WidgetSpan(
                          alignment: PlaceholderAlignment.middle,
                          child: Padding(
                            padding: const EdgeInsets.only(right: 4),
                            child: Container(
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 4, vertical: 1.5),
                              decoration: BoxDecoration(
                                color: chip.background,
                                borderRadius: BorderRadius.circular(3),
                              ),
                              child: Text(chip.label,
                                  style: TextStyle(
                                      fontSize: 9,
                                      height: 1.2,
                                      fontWeight: FontWeight.w700,
                                      color: chip.foreground)),
                            ),
                          ),
                        ),
                      TextSpan(text: product.name),
                    ],
                  ),
                ),
              ),

              // ---- The price, and what happened to it ----
              //
              // 12px at weight 800, down from 17. That is `.price` on a phone
              // (it steps up to 14 at `sm`), and it is the largest single
              // difference between the two tiles. A 17px price on a 165px tile
              // is most of a row's width for one figure; the site spends that
              // width on the photograph instead and lets weight, not size, do
              // the work of making the number findable.
              //
              // Red when it is a reduction, ink when it is just the price —
              // the oldest price-tag convention there is, and the same red as
              // the corner flag above.
              // ---- The price is pinned to the foot of the tile ----
              //
              // `mt-auto` on the site, and it is what makes a grid ROW
              // readable: the cells in a row are stretched to a common height,
              // so a two-line name beside a one-line name would otherwise land
              // their prices on different baselines and the eye has to hunt
              // down the page for each figure.
              //
              // It also settles where the leftover height goes now that the
              // tile draws its own border. Any slack between the grid cell and
              // the card's content used to collect at the bottom, inside the
              // edge, as a visible empty strip; it collects here instead,
              // between the name and the price, where it reads as air.
              const Spacer(),
              Text(
                product.priceLabel,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  fontSize: 12,
                  height: 1.1,
                  fontWeight: FontWeight.w800,
                  color: product.discountPercent > 0
                      ? _KColors.priceWas
                      : _KColors.ink,
                ),
              ),

              // ---- The struck original is NOT drawn on a phone ----
              //
              // `.was-price` is `hidden ... sm:inline` on the site: a 165px
              // tile has room for one price and nothing else, and the two
              // figures side by side is what produced a sliced number. Nothing
              // is lost — the corner flag carries the percentage and the deal
              // strip carries the shillings.

              // The stock warning, on the products that have one and nowhere
              // else. A row that renders empty on most tiles is a row of debris
              // at forty different heights down the grid.
              if (_lowStock) ...[
                const SizedBox(height: 2),
                Text('Only ${product.stockQuantity} left',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                        fontSize: 11,
                        height: 14 / 11,
                        fontWeight: FontWeight.w500,
                        color: _KColors.body)),
              ],

              // ---- What other people did, BELOW what it costs ----
              //
              // The site's order, and this tile had it the other way round.
              // The name says which product it is and the price says whether it
              // is worth a second look; the sold count and the stars are the
              // corroboration a shopper reads only once those two have passed.
              // Putting them above the price made the tile ask for attention
              // before it had said anything.
              if (product.totalSales > 0 || product.ratingCount > 0) ...[
                const SizedBox(height: 2),
                Row(
                  children: [
                    // Flexible, and it is not decoration. The stars are icons
                    // at a fixed 11px and do not scale with the reader's text
                    // size, so at a raised setting the two TEXTS have to give
                    // way or the row overflows to the right — which is the one
                    // kind of overflow a shopper cannot scroll to see. Found by
                    // pumping this tile at a 1.3 text scale, where an
                    // unbounded '340 sold' ran 20px past the tile's edge.
                    if (product.totalSales > 0)
                      Flexible(
                        child: Text('${product.totalSales} sold',
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                                fontSize: 11,
                                height: 1.3,
                                color: _KColors.muted)),
                      ),
                    if (product.totalSales > 0 && product.ratingCount > 0)
                      const SizedBox(width: 8),
                    if (product.ratingCount > 0) ...[
                      _Stars(rating: product.rating, size: 11),
                      const SizedBox(width: 4),
                      Flexible(
                        child: Text(product.rating.toStringAsFixed(1),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                                fontSize: 11,
                                height: 1.3,
                                color: _KColors.body)),
                      ),
                    ],
                  ],
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

/// Five stars, drawn to the half.
///
/// Glyphs rather than the bare number. "4.5" is a fact a shopper has to read;
/// four and a half stars is one they see, and on a grid of forty tiles that
/// difference is most of what gets read at all.
///
/// Dark rather than gold, which is what the reference does — and it is right
/// for a second reason here: gold stars sitting next to a yellow discount flag
/// are two yellows competing inside a 154px tile.
///
/// Only ever drawn behind a real review count. An empty row of grey stars on a
/// shop with no ratings yet is a rating of nothing dressed up as a rating.
class _Stars extends StatelessWidget {
  const _Stars({required this.rating, this.size = 11});

  final num rating;
  final double size;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        for (int i = 1; i <= 5; i++)
          Icon(
            rating >= i
                ? Icons.star_rounded
                : (rating >= i - 0.5
                    ? Icons.star_half_rounded
                    : Icons.star_border_rounded),
            size: size,
            color: _KColors.ink,
          ),
      ],
    );
  }
}


/// A network image with the three states a photograph actually has.
///
/// `cached_network_image` rather than `Image.network`: a catalogue is the same
/// few hundred pictures seen over and over as a shopper moves between pages,
/// and refetching them on every build is most of what makes a shopping app feel
/// slow on a Ugandan mobile connection.
class _Photo extends StatelessWidget {
  const _Photo({required this.url});

  final String url;

  @override
  Widget build(BuildContext context) {
    if (url.isEmpty) {
      return const ColoredBox(
        color: _KColors.photo,
        child: Center(
            child: Icon(Icons.image_not_supported_outlined,
                size: 22, color: _KColors.faint)),
      );
    }
    return CachedNetworkImage(
      httpHeaders: _kImageHeaders,
      imageUrl: url,
      // Contain, not cover: a category photograph is one object and a
      // cover crop slices it. The card gives it a square well to sit in.
      fit: BoxFit.contain,
      fadeInDuration: const Duration(milliseconds: 160),
      placeholder: (_, __) => const ColoredBox(color: _KColors.photo),
      errorWidget: (_, __, ___) => const ColoredBox(
        color: _KColors.photo,
        child: Center(
            child: Icon(Icons.image_not_supported_outlined,
                size: 22, color: _KColors.faint)),
      ),
    );
  }
}

/// What the screen shows before the first answer arrives.
///
/// A shimmering block of roughly the right shape rather than a spinner: a
/// spinner says "something is happening", a skeleton says "a grid of products
/// is arriving", and the second stops the layout jumping when it does.
class _Skeleton extends StatefulWidget {
  const _Skeleton();

  @override
  State<_Skeleton> createState() => _SkeletonState();
}

class _SkeletonState extends State<_Skeleton>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1100),
  )..repeat(reverse: true);

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Widget _block(double width, double height, [double radius = 10]) {
    return AnimatedBuilder(
      animation: _controller,
      builder: (context, _) => Container(
        width: width,
        height: height,
        decoration: BoxDecoration(
          color: Color.lerp(_KColors.hairline, _KColors.line, _controller.value),
          borderRadius: BorderRadius.circular(radius),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(_KSpace.md),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _block(160, 20, 6),
          const SizedBox(height: _KSpace.md),
          SizedBox(
            // In step with the real rail above. A placeholder at the wrong
            // height makes the row visibly re-draw itself when the products
            // land, which is the one thing a skeleton exists to prevent.
            height: 278,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              itemCount: 3,
              separatorBuilder: (_, __) => const SizedBox(width: _KSpace.md),
              itemBuilder: (_, __) => Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _block(168, 168, _rPanel),
                  const SizedBox(height: _KSpace.sm),
                  _block(140, 12, 4),
                  const SizedBox(height: 6),
                  _block(90, 16, 4),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
