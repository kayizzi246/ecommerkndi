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
  static const Color canvas = Color(0xFFF2F4F7);
  static const Color panel = Color(0xFFFFFFFF);

  /// The patterned band behind the search bar and the shortcut pills.
  static const Color headerTop = Color(0xFFD9EEFB);
  static const Color headerBottom = Color(0xFFEAF6FD);

  static const Color ink = Color(0xFF111827);
  static const Color body = Color(0xFF4B5563);
  static const Color muted = Color(0xFF6B7280);
  static const Color faint = Color(0xFF9CA3AF);

  static const Color line = Color(0xFFE5E7EB);
  static const Color hairline = Color(0xFFF3F4F6);

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

  static const Color star = Color(0xFFF59E0B);
}

class _KSpace {
  const _KSpace._();
  static const double xs = 4;
  static const double sm = 8;
  static const double md = 12;
  static const double lg = 16;
  static const double xl = 24;
}

const double _rPanel = 14;
const double _rPhoto = 10;
const double _rChip = 8;

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

  Future<void> _push(Widget screen) async {
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
                style: FilledButton.styleFrom(backgroundColor: _KColors.primary),
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
                      const Expanded(
                        child: Text('Picked for you',
                            style: TextStyle(
                                fontSize: 17,
                                fontWeight: FontWeight.w800,
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
                    // A square photograph plus the card's text rows. A ratio
                    // that fits only the picture clips the price off.
                    childAspectRatio: 0.50,
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

  /// The patterned band: shortcut pills, then the search bar.
  ///
  /// Modelled on the reference the shop gave. The band is a soft gradient
  /// rather than an illustration — artwork behind a search field costs a
  /// download on the one screen that must paint fastest, and the colour alone
  /// does the same job of separating the chrome from the merchandise.
  Widget _buildHeader() {
    return Container(
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [_KColors.headerTop, _KColors.headerBottom],
        ),
      ),
      child: SafeArea(
        bottom: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(0, _KSpace.sm, 0, _KSpace.lg),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // The brand, then the departments as pills. The reference runs
              // its own sub-brands here; this shop has departments, which is
              // the equivalent thing — the fastest route for a shopper who
              // arrived knowing what they want.
              SizedBox(
                height: 42,
                child: ListView(
                  scrollDirection: Axis.horizontal,
                  padding: const EdgeInsets.symmetric(horizontal: _KSpace.md),
                  children: [
                    _BrandPill(label: _brand, filled: true, onTap: _load),
                    for (final department in _departments)
                      Padding(
                        padding: const EdgeInsets.only(left: _KSpace.sm),
                        child: _BrandPill(
                          label: department.name,
                          onTap: () => _openCategory(department),
                        ),
                      ),
                  ],
                ),
              ),
              const SizedBox(height: _KSpace.md),
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
  const _BrandPill({required this.label, required this.onTap, this.filled = false});

  final String label;
  final VoidCallback onTap;
  final bool filled;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        alignment: Alignment.center,
        padding: const EdgeInsets.symmetric(horizontal: _KSpace.lg),
        decoration: BoxDecoration(
          // The shop's own pill is filled, the rest are white — the reference's
          // arrangement, and it says which of the row you are currently in.
          color: filled ? _KColors.express : _KColors.panel,
          borderRadius: BorderRadius.circular(_rChip),
        ),
        child: Text(
          label,
          style: const TextStyle(
              fontSize: 14, fontWeight: FontWeight.w800, color: _KColors.ink),
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
        height: 48,
        padding: const EdgeInsets.symmetric(horizontal: _KSpace.md),
        decoration: BoxDecoration(
          color: _KColors.panel,
          borderRadius: BorderRadius.circular(_rChip),
        ),
        child: const Row(
          children: [
            Icon(Icons.search_rounded, size: 22, color: _KColors.ink),
            SizedBox(width: _KSpace.sm),
            Expanded(
              child: Text('Search for shoes, phones, home…',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(fontSize: 14.5, color: _KColors.muted)),
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
    final colour = active ? _KColors.primary : _KColors.muted;
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
                        color: _KColors.primary,
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
  const _ViewAll({required this.onTap});
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: const Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text('View all',
              style: TextStyle(
                  fontSize: 13.5,
                  fontWeight: FontWeight.w700,
                  color: Color(0xFF1A73E8))),
          Icon(Icons.chevron_right_rounded, size: 18, color: Color(0xFF1A73E8)),
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
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(
              _KSpace.md, _KSpace.xl, _KSpace.md, _KSpace.md),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(rail.title,
                        style: const TextStyle(
                            fontSize: 17,
                            height: 1.25,
                            fontWeight: FontWeight.w800,
                            color: _KColors.ink)),
                    if (rail.subtitle != null && rail.subtitle!.isNotEmpty)
                      Padding(
                        padding: const EdgeInsets.only(top: 2),
                        child: Text(rail.subtitle!,
                            style: const TextStyle(
                                fontSize: 12.5, color: _KColors.muted)),
                      ),
                  ],
                ),
              ),
              const SizedBox(width: _KSpace.sm),
              _ViewAll(onTap: onViewAll),
            ],
          ),
        ),
        SizedBox(
          // Tall enough for the card's photograph plus every text row it can
          // draw. Fixed, because a horizontal list has no height to measure.
          height: 340,
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
    );
  }
}

/// The product card, drawn to the reference.
///
/// A white card with the photograph in it, a badge top-left, a heart top-right,
/// a `+` bottom-right, then the name, the price row with a green discount, the
/// saving as a green pill and the delivery badge.
///
/// The WHOLE card is the tap target. A shopper aims at a card, and on a phone
/// the gaps between its rows are thumb-sized — a card with two small live
/// regions and dead space between them feels broken without anybody being able
/// to say why. The heart and the `+` sit above that gesture and take their own
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

  /// The badge in the top-left corner.
  ///
  /// One label at most, in order of usefulness to a shopper who has not
  /// decided: a deep cut, then a new listing. A badge on every card is a badge
  /// that means nothing, which is why there is no fallback.
  String? get _badge {
    if (product.discountPercent >= 30) return 'SUPER DEAL';
    if (product.isNew) return 'NEW';
    return null;
  }

  /// Whether this item alone clears the free-delivery threshold.
  ///
  /// Derived rather than sent: the API has no per-product delivery field, and
  /// this is the same arithmetic the website's tile does. It is honest because
  /// the threshold is the figure checkout actually applies.
  bool get _freeDelivery =>
      freeDeliveryFrom > 0 && product.price >= freeDeliveryFrom;

  @override
  Widget build(BuildContext context) {
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
            borderRadius: BorderRadius.circular(_rPanel),
          ),
          padding: const EdgeInsets.all(_KSpace.sm),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              AspectRatio(
                aspectRatio: 1,
                child: Stack(
                  fit: StackFit.expand,
                  children: [
                    ClipRRect(
                      borderRadius: BorderRadius.circular(_rPhoto),
                      child: _Photo(url: product.image),
                    ),
                    if (_badge != null)
                      Positioned(
                        top: 4,
                        left: 4,
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 6, vertical: 3),
                          decoration: BoxDecoration(
                            color: _KColors.ink,
                            borderRadius: BorderRadius.circular(4),
                          ),
                          child: Text(_badge!,
                              style: const TextStyle(
                                  fontSize: 8.5,
                                  height: 1,
                                  letterSpacing: 0.4,
                                  fontWeight: FontWeight.w800,
                                  color: Colors.white)),
                        ),
                      ),
                    Positioned(
                      top: 0,
                      right: 0,
                      child: GestureDetector(
                        onTap: onSave,
                        // A generous invisible hit area: the heart itself is
                        // 18px, which is under the 44px a thumb needs.
                        behavior: HitTestBehavior.opaque,
                        child: Padding(
                          padding: const EdgeInsets.all(6),
                          child: Icon(
                            saved
                                ? Icons.favorite_rounded
                                : Icons.favorite_border_rounded,
                            size: 19,
                            color: saved ? _KColors.primary : _KColors.muted,
                          ),
                        ),
                      ),
                    ),
                    if (product.inStock)
                      Positioned(
                        bottom: 0,
                        right: 0,
                        child: _AddButton(
                          // A product with options cannot be added from a card —
                          // it opens instead, where the picker is.
                          onTap: product.hasOptions ? onOpen : onAdd,
                          icon: product.hasOptions
                              ? Icons.tune_rounded
                              : Icons.add_rounded,
                        ),
                      ),
                    if (!product.inStock)
                      Positioned(
                        bottom: 4,
                        left: 4,
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 6, vertical: 3),
                          decoration: BoxDecoration(
                            color: _KColors.ink,
                            borderRadius: BorderRadius.circular(4),
                          ),
                          child: const Text('Sold out',
                              style: TextStyle(
                                  fontSize: 9,
                                  height: 1,
                                  fontWeight: FontWeight.w800,
                                  color: Colors.white)),
                        ),
                      ),
                  ],
                ),
              ),
              const SizedBox(height: _KSpace.sm),
              Text(product.name,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                      fontSize: 12.5, height: 1.35, color: _KColors.ink)),
              const SizedBox(height: 5),
              if (product.ratingCount > 0) ...[
                Row(
                  children: [
                    const Icon(Icons.star_rounded, size: 13, color: _KColors.star),
                    const SizedBox(width: 2),
                    Text(product.rating.toStringAsFixed(1),
                        style: const TextStyle(
                            fontSize: 11.5,
                            fontWeight: FontWeight.w700,
                            color: _KColors.ink)),
                    const SizedBox(width: 3),
                    Text('(${product.ratingCount})',
                        style: const TextStyle(
                            fontSize: 11, color: _KColors.muted)),
                  ],
                ),
                const SizedBox(height: 3),
              ],
              // Price, old price and the cut, on one line — the reference's
              // arrangement. The percentage is green because it is money back,
              // which is also what keeps red out of a catalogue that would
              // otherwise be covered in it.
              Row(
                crossAxisAlignment: CrossAxisAlignment.baseline,
                textBaseline: TextBaseline.alphabetic,
                children: [
                  Flexible(
                    child: Text(product.priceLabel,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                            fontSize: 15,
                            height: 1.1,
                            fontWeight: FontWeight.w800,
                            color: _KColors.ink)),
                  ),
                  if (product.wasPriceLabel != null) ...[
                    const SizedBox(width: 4),
                    Flexible(
                      child: Text(product.wasPriceLabel!,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                              fontSize: 11,
                              color: _KColors.faint,
                              decoration: TextDecoration.lineThrough)),
                    ),
                  ],
                  if (product.discountPercent > 0) ...[
                    const SizedBox(width: 4),
                    Text('${product.discountPercent}%',
                        style: const TextStyle(
                            fontSize: 11.5,
                            fontWeight: FontWeight.w800,
                            color: _KColors.save)),
                  ],
                ],
              ),
              if (product.savingLabel != null) ...[
                const SizedBox(height: 5),
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
                  decoration: BoxDecoration(
                    color: _KColors.saveSoft,
                    borderRadius: BorderRadius.circular(5),
                  ),
                  child: Text('Save ${product.savingLabel}',
                      style: const TextStyle(
                          fontSize: 10.5,
                          fontWeight: FontWeight.w800,
                          color: _KColors.save)),
                ),
              ],
              if (_freeDelivery) ...[
                const SizedBox(height: 5),
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
                  decoration: BoxDecoration(
                    color: _KColors.express,
                    borderRadius: BorderRadius.circular(4),
                  ),
                  child: const Text('FREE DELIVERY',
                      style: TextStyle(
                          fontSize: 9,
                          height: 1,
                          letterSpacing: 0.3,
                          fontWeight: FontWeight.w800,
                          color: _KColors.ink)),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class _AddButton extends StatelessWidget {
  const _AddButton({required this.onTap, required this.icon});

  final VoidCallback onTap;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: Container(
        width: 34,
        height: 34,
        decoration: BoxDecoration(
          color: _KColors.panel,
          borderRadius: BorderRadius.circular(_rChip),
          border: Border.all(color: _KColors.line),
        ),
        child: Icon(icon, size: 20, color: _KColors.ink),
      ),
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
        color: _KColors.hairline,
        child: Center(
            child: Icon(Icons.image_not_supported_outlined,
                size: 22, color: _KColors.faint)),
      );
    }
    return CachedNetworkImage(
      imageUrl: url,
      // Contain, not cover: a category photograph is one object and a
      // cover crop slices it. The card gives it a square well to sit in.
      fit: BoxFit.contain,
      fadeInDuration: const Duration(milliseconds: 160),
      placeholder: (_, __) => const ColoredBox(color: _KColors.hairline),
      errorWidget: (_, __, ___) => const ColoredBox(
        color: _KColors.hairline,
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
            height: 300,
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
