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
// never is.
//
// Do NOT add `/backend/backend.dart` or `/backend/supabase/supabase.dart`.
// This project has neither and FlutterFlow offers to add them.
import 'dart:convert';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

// The only cross-file imports in this screen, and they are for NAVIGATION
// alone — the two destinations a shopper can reach from here. No design, no
// model and no helper is shared; see "Self-contained" below.
import '/custom_code/widgets/kandi_product_screen.dart';
import '/custom_code/widgets/kandi_cart_screen.dart';

// ============================================================
//  KANDI — HOME PAGE
//
//  The shopfront: the shop's terms, the departments, the
//  merchandising rails and an endless grid.
//
//  ---- Self-contained, deliberately ----
//
//  This file carries its own palette, type scale, HTTP client,
//  product model and product tile. Nothing is imported from a
//  shared design library, because there is no shared design
//  library any more.
//
//  That is a real trade and it is worth naming both halves.
//  What it costs is duplication: the palette below also appears
//  in the cart page and the product page, and changing an
//  accent colour means changing it in each. What it buys is
//  that any page can be pasted into FlutterFlow ON ITS OWN, in
//  any order, with nothing else present. The version this
//  replaces could not — its fifteen widgets imported each other
//  for colours and models, so they had one legal paste order
//  and a single file pasted out of turn failed to compile with
//  an error that pointed at the wrong thing.
//
//  ---- Which is why everything here is private ----
//
//  FlutterFlow writes every custom widget into one flat folder,
//  `lib/custom_code/widgets/`, and re-exports them all through
//  a shared `index.dart`. Two files that both declared a
//  top-level `KColors` would collide the moment both were
//  pasted.
//
//  Dart's underscore prefix makes a declaration file-private,
//  so `_KColors` in this file and `_KColors` in the cart page
//  are different classes that cannot see or clash with each
//  other. Only `KandiHomeScreen` is public, because only the
//  widget needs to be.
//
//  ---- One request builds the screen ----
//
//  `/api/app/home` returns the brand, the commerce terms, the
//  departments, every rail already composed and ordered, and
//  the picked-for-you grid. It is the SAME feed the website's
//  homepage renders from, which is the point: what is trending,
//  which department is big enough to show, how deep a discount
//  has to be — decided once on the server, read by both
//  clients. An app that re-decides any of it locally will drift
//  from the site and nobody will notice until a shopper does.
//
//  ---- Where it goes ----
//
//  A tile opens KandiProductScreen with the product id on the
//  route; the basket icon opens KandiCartScreen. FlutterFlow
//  custom widgets take no parameters, so an id cannot be a
//  constructor argument — it travels as a route argument, which
//  is the one channel FlutterFlow does not rewrite.
// ============================================================

// ------------------------------------------------------------
//  Design — private to this file
// ------------------------------------------------------------

class _KColors {
  const _KColors._();

  /// The page ground: a 3% warm neutral. Enough to stop reading as a screen,
  /// not enough to tint a product photographed on white.
  static const Color canvas = Color(0xFFF8F7F4);
  static const Color panel = Color(0xFFFFFFFF);

  static const Color ink = Color(0xFF111827);
  static const Color body = Color(0xFF4B5563);
  static const Color muted = Color(0xFF6B7280);
  static const Color faint = Color(0xFF9CA3AF);

  static const Color line = Color(0xFFE5E7EB);
  static const Color hairline = Color(0xFFF3F4F6);

  /// Brand orange is spent on marks that sit ON things — the basket badge, the
  /// primary button — and never as a large ground. White on #ff6a00 is 2.9:1
  /// and fails AA, which is why nothing here puts small white type on it.
  static const Color primary = Color(0xFFFF6A00);
  static const Color primarySoft = Color(0xFFFFF3E8);

  /// The two accent shelves, matching the website's own tokens.
  /// Both clear 6:1 against white, which is why they are these darker steps
  /// and not brighter ones — the headings on them are white.
  static const Color trending = Color(0xFF7642D6);
  static const Color deals = Color(0xFFB8123A);

  static const Color save = Color(0xFF15803D);
  static const Color saveSoft = Color(0xFFF0FDF4);
  static const Color dealFlag = Color(0xFFFACC15);
  static const Color star = Color(0xFFF59E0B);
}

class _KType {
  const _KType._();

  static const TextStyle display = TextStyle(
      fontSize: 22, height: 1.2, fontWeight: FontWeight.w800, color: _KColors.ink);
  static const TextStyle section = TextStyle(
      fontSize: 18, height: 1.25, fontWeight: FontWeight.w800, color: _KColors.ink);

  /// A product name is regular weight on purpose: forty semibold names on a
  /// screen is forty things competing with the prices under them.
  static const TextStyle name = TextStyle(
      fontSize: 12.5, height: 1.35, fontWeight: FontWeight.w400, color: _KColors.ink);

  /// The loudest line in a tile, and never the loudest on the page.
  static const TextStyle price = TextStyle(
      fontSize: 14.5, height: 1.1, fontWeight: FontWeight.w700, color: _KColors.ink);
  static const TextStyle wasPrice = TextStyle(
      fontSize: 11.5,
      height: 1.1,
      color: _KColors.faint,
      decoration: TextDecoration.lineThrough);

  static const TextStyle bodyText =
      TextStyle(fontSize: 13.5, height: 1.5, color: _KColors.body);
  static const TextStyle meta =
      TextStyle(fontSize: 11.5, height: 1.3, color: _KColors.muted);
}

class _KSpace {
  const _KSpace._();
  static const double xs = 4;
  static const double sm = 8;
  static const double md = 12;
  static const double lg = 16;
  static const double xl = 24;
}

class _KRadius {
  const _KRadius._();
  static const double panel = 16;
  static const double photo = 12;
  static const double chip = 8;
}

/// Where the app talks to the shop.
///
/// The public app API lives on the storefront rather than on WordPress: those
/// endpoints are already composed, formatted and cached, so the app gets the
/// website's merchandising decisions instead of a second, drifting copy.
const String _apiBase = 'https://kandiug.com';

// ------------------------------------------------------------
//  Money
// ------------------------------------------------------------

/// `UGX 145,000`.
///
/// Only used for figures the app computes itself. Every product price is
/// printed from the API's own `priceLabel`, formatted by the shop's formatter,
/// so the app cannot show a different figure from the website for one item.
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

/// One product, as `/api/app/` sends it.
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
  /// A tile cannot show a size picker, so this decides what its basket button
  /// does: add a simple product in one tap, or open the product page where the
  /// picker is. Without it that button has two options and both are wrong —
  /// not existing for the whole catalogue, or sending an order for a shoe to
  /// wp-admin with no size on it.
  final bool hasOptions;

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
    );
  }

  /// Parses a list, dropping malformed rows rather than failing the screen.
  /// One bad product should cost its own tile, not the whole homepage.
  static List<_KProduct> listFrom(dynamic json) {
    if (json is! List) return const [];
    return json.map(_KProduct.from).whereType<_KProduct>().toList();
  }
}

class _KDepartment {
  const _KDepartment({required this.name, required this.image});
  final String name;
  final String image;

  static List<_KDepartment> listFrom(dynamic json) {
    if (json is! List) return const [];
    final out = <_KDepartment>[];
    for (final entry in json) {
      if (entry is! Map) continue;
      final name = (entry['name'] ?? '').toString();
      if (name.isEmpty) continue;
      out.add(_KDepartment(name: name, image: (entry['image'] ?? '').toString()));
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

  final String id;
  final String title;
  final String? subtitle;
  final List<_KProduct> products;

  /// The shelf's ground, decided by id.
  ///
  /// A presentation choice, so it lives here rather than in the shared API —
  /// the website makes the same choice in CSS for the same two ids. Any rail
  /// not named is a white shelf, which is the right default: a page where every
  /// shelf is coloured has no emphasis at all.
  Color? get accent {
    if (id == 'trending') return _KColors.trending;
    if (id == 'super-deals') return _KColors.deals;
    return null;
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
//  The basket, shared through the disk rather than through code
// ------------------------------------------------------------

/// Adds a line to the saved basket.
///
/// ---- Why this is not a shared cart class ----
///
/// Every page in this app is self-contained, so there is no common object for
/// three screens to hold the basket in. What they share instead is the STORAGE:
/// one SharedPreferences key, one JSON shape, read and written by whichever
/// page is open. The cart page reads what this wrote without either file
/// knowing the other exists.
///
/// The shape is deliberately thin — id, name, image, quantity, and the unit
/// price AS IT WAS when the line was added. Prices move, and a basket restored
/// next week must not show today's figure against last week's decision; the
/// cart page re-checks against the API before checkout, which is where a
/// change belongs.
///
/// Keyed on id AND variant: a shopper buying the same shoe in two sizes has two
/// lines, and merging them on id alone silently drops a size from the order.
Future<int> _addToBasket(_KProduct product, {int quantity = 1}) async {
  try {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_basketKey);
    final lines = <Map<String, dynamic>>[];

    if (raw != null) {
      final decoded = jsonDecode(raw);
      if (decoded is List) {
        for (final entry in decoded) {
          if (entry is Map) lines.add(Map<String, dynamic>.from(entry));
        }
      }
    }

    final key = '${product.id}::';
    final index = lines.indexWhere((line) => line['key'] == key);
    if (index >= 0) {
      final current = lines[index]['quantity'];
      lines[index]['quantity'] = (current is int ? current : 1) + quantity;
    } else {
      lines.add({
        'key': key,
        'productId': product.id,
        'name': product.name,
        'image': product.image,
        'price': product.price,
        'priceLabel': product.priceLabel,
        'quantity': quantity,
        'variantLabel': null,
      });
    }

    await prefs.setString(_basketKey, jsonEncode(lines));
    return lines.fold<int>(0, (total, line) {
      final q = line['quantity'];
      return total + (q is int ? q : 0);
    });
  } catch (_) {
    // A basket that will not read or write is recoverable — the shopper can
    // add again. Throwing here would take out the tile they just tapped.
    return 0;
  }
}

/// How many items are in the saved basket, for the badge.
Future<int> _basketCount() async {
  try {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_basketKey);
    if (raw == null) return 0;
    final decoded = jsonDecode(raw);
    if (decoded is! List) return 0;
    return decoded.fold<int>(0, (total, entry) {
      if (entry is! Map) return total;
      final q = entry['quantity'];
      return total + (q is int ? q : 0);
    });
  } catch (_) {
    return 0;
  }
}

/// The one string every page in this app agrees on.
/// Change it here and it must change in every page file at the same time.
const String _basketKey = 'kandi-cart-v1';

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
  List<_KDepartment> _departments = const [];
  List<_KRail> _rails = const [];
  List<_KProduct> _picked = const [];
  int _cartCount = 0;

  @override
  void initState() {
    super.initState();
    _load();
    _refreshBadge();
  }

  Future<void> _refreshBadge() async {
    final count = await _basketCount();
    if (mounted) setState(() => _cartCount = count);
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
        // Only a true failure when there is nothing on screen already. A failed
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
      if (brand is Map && brand['name'] != null) {
        _brand = brand['name'].toString();
      }
      if (commerce is Map) {
        _freeDeliveryFrom = commerce['freeDeliveryFrom'] is num
            ? commerce['freeDeliveryFrom'] as num
            : 0;
        _returnsDays =
            commerce['returnsDays'] is int ? commerce['returnsDays'] as int : 0;
      }
      _departments = _KDepartment.listFrom(data['departments']);
      _rails = _KRail.listFrom(data['rails']);
      _picked = _KProduct.listFrom(data['pickedForYou']);
    });
  }

  Future<void> _openProduct(_KProduct product) async {
    await Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => const KandiProductScreen(),
        // The id travels on the route: FlutterFlow custom widgets take no
        // parameters, and this is the one channel it does not rewrite.
        settings: RouteSettings(arguments: product.id),
      ),
    );
    // The product page can add to the basket, so the badge is re-read on the
    // way back rather than assumed unchanged.
    await _refreshBadge();
  }

  Future<void> _openCart() async {
    await Navigator.of(context)
        .push(MaterialPageRoute(builder: (_) => const KandiCartScreen()));
    await _refreshBadge();
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
          onPressed: _openCart,
        ),
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
        appBar: AppBar(
          backgroundColor: _KColors.panel,
          surfaceTintColor: _KColors.panel,
          elevation: 0,
          scrolledUnderElevation: 0.5,
          titleSpacing: _KSpace.lg,
          title: Text(_brand, style: _KType.display),
          actions: [_buildBasketButton()],
        ),
        body: _buildBody(),
      ),
    );
  }

  Widget _buildBasketButton() {
    return Padding(
      padding: const EdgeInsets.only(right: _KSpace.sm),
      child: IconButton(
        onPressed: _openCart,
        tooltip: 'Basket',
        icon: Stack(
          clipBehavior: Clip.none,
          children: [
            const Icon(Icons.shopping_bag_outlined, color: _KColors.ink),
            if (_cartCount > 0)
              Positioned(
                right: -6,
                top: -6,
                child: Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
                  constraints: const BoxConstraints(minWidth: 18),
                  decoration: BoxDecoration(
                    color: _KColors.primary,
                    borderRadius: BorderRadius.circular(9),
                    // A white ring keeps the badge legible over the dark icon
                    // beneath it.
                    border: Border.all(color: Colors.white, width: 1.5),
                  ),
                  child: Text(
                    _cartCount > 99 ? '99+' : '$_cartCount',
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                      fontSize: 10,
                      height: 1.3,
                      fontWeight: FontWeight.w800,
                      color: Colors.white,
                    ),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }

  Widget _buildBody() {
    if (_loading && _rails.isEmpty && _picked.isEmpty) {
      return const _HomeSkeleton();
    }

    if (_failed) {
      return _Empty(
        icon: Icons.wifi_off_rounded,
        title: 'Could not reach the shop',
        message:
            'Check your connection and try again. Nothing in your basket has been lost.',
        actionLabel: 'Try again',
        onAction: _load,
      );
    }

    return RefreshIndicator(
      color: _KColors.primary,
      onRefresh: _load,
      child: CustomScrollView(
        slivers: [
          if (_freeDeliveryFrom > 0 || _returnsDays > 0)
            SliverToBoxAdapter(
              child: _TermsStrip(
                freeDeliveryFrom: _freeDeliveryFrom,
                returnsDays: _returnsDays,
              ),
            ),
          if (_departments.isNotEmpty)
            SliverToBoxAdapter(
                child: _DepartmentStrip(departments: _departments)),
          for (final rail in _rails)
            SliverToBoxAdapter(
              child: _RailSection(
                rail: rail,
                onOpen: _openProduct,
                onAdd: _add,
              ),
            ),
          if (_picked.isNotEmpty) ...[
            const SliverToBoxAdapter(
              child: Padding(
                padding: EdgeInsets.fromLTRB(
                    _KSpace.lg, _KSpace.xl, _KSpace.lg, _KSpace.md),
                child: Text('Picked for you', style: _KType.section),
              ),
            ),
            SliverPadding(
              padding: const EdgeInsets.symmetric(horizontal: _KSpace.lg),
              sliver: SliverGrid(
                gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                  crossAxisCount: 2,
                  mainAxisSpacing: _KSpace.lg,
                  crossAxisSpacing: _KSpace.md,
                  // A square photograph plus four short text rows. A ratio that
                  // fits only the picture clips the price off the bottom.
                  childAspectRatio: 0.56,
                ),
                delegate: SliverChildBuilderDelegate(
                  (context, index) {
                    final product = _picked[index];
                    return _Tile(
                      product: product,
                      onOpen: () => _openProduct(product),
                      onAdd: _add,
                    );
                  },
                  childCount: _picked.length,
                ),
              ),
            ),
          ],
          const SliverToBoxAdapter(child: SizedBox(height: _KSpace.xl)),
        ],
      ),
    );
  }
}

// ------------------------------------------------------------
//  Pieces
// ------------------------------------------------------------

/// The shop's terms, once, under the masthead.
///
/// The three things a first-time Ugandan shopper asks about a shop they have
/// not bought from: what delivery costs, whether they can pay on arrival, and
/// whether they can send it back. Every figure comes from the API rather than
/// being typed here, so the app cannot promise a window the checkout will not
/// honour.
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
      margin: const EdgeInsets.fromLTRB(_KSpace.lg, _KSpace.md, _KSpace.lg, 0),
      padding: const EdgeInsets.all(_KSpace.md),
      decoration: BoxDecoration(
        color: _KColors.saveSoft,
        borderRadius: BorderRadius.circular(_KRadius.panel),
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
                Text(
                  term,
                  style: const TextStyle(
                      fontSize: 11.5,
                      fontWeight: FontWeight.w600,
                      color: _KColors.ink),
                ),
              ],
            ),
        ],
      ),
    );
  }
}

/// The departments, as a scrolling row of discs.
///
/// It says what the shop sells before any single product does, which is what a
/// shopper arriving with an intent — shoes, something for the kids — needs from
/// the first screen.
///
/// The discs are WHITE with a coloured ring rather than a coloured fill. Almost
/// every image in this catalogue is a JPEG shot on white, so a tinted disc
/// paints an opaque white rectangle into the middle of itself and the tint
/// survives only in the corners. The ring puts the colour where no photograph
/// can cover it.
class _DepartmentStrip extends StatelessWidget {
  const _DepartmentStrip({required this.departments});

  final List<_KDepartment> departments;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: _KSpace.lg),
      child: SizedBox(
        height: 108,
        child: ListView.separated(
          scrollDirection: Axis.horizontal,
          padding: const EdgeInsets.symmetric(horizontal: _KSpace.lg),
          itemCount: departments.length,
          separatorBuilder: (_, __) => const SizedBox(width: _KSpace.md),
          itemBuilder: (context, index) {
            final department = departments[index];
            return SizedBox(
              width: 76,
              child: Column(
                children: [
                  Container(
                    width: 66,
                    height: 66,
                    decoration: BoxDecoration(
                      color: _KColors.panel,
                      shape: BoxShape.circle,
                      border: Border.all(
                        // A literal ARGB rather than `withValues(alpha:)`,
                        // which only exists from Flutter 3.27. FlutterFlow
                        // decides the SDK version this compiles against, not
                        // this file, so the version-proof form is the right
                        // one: 0x40 is 25% of 255.
                        color: const Color(0x407642D6),
                        width: 1.5,
                      ),
                    ),
                    child: ClipOval(
                      child: department.image.isEmpty
                          ? Center(
                              child: Text(
                                department.name.substring(0, 1).toUpperCase(),
                                style: const TextStyle(
                                  fontSize: 22,
                                  fontWeight: FontWeight.w800,
                                  color: _KColors.trending,
                                ),
                              ),
                            )
                          : _Photo(
                              url: department.image,
                              fit: BoxFit.contain,
                              padding: const EdgeInsets.all(8),
                            ),
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    department.name,
                    maxLines: 2,
                    textAlign: TextAlign.center,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontSize: 11,
                      height: 1.2,
                      fontWeight: FontWeight.w600,
                      color: _KColors.ink,
                    ),
                  ),
                ],
              ),
            );
          },
        ),
      ),
    );
  }
}

/// One shelf: a heading and a horizontal row of tiles.
class _RailSection extends StatelessWidget {
  const _RailSection({
    required this.rail,
    required this.onOpen,
    required this.onAdd,
  });

  final _KRail rail;
  final ValueChanged<_KProduct> onOpen;
  final ValueChanged<_KProduct> onAdd;

  @override
  Widget build(BuildContext context) {
    final accent = rail.accent;
    final onAccent = accent != null;

    return Container(
      margin: const EdgeInsets.fromLTRB(_KSpace.lg, _KSpace.xl, _KSpace.lg, 0),
      padding: const EdgeInsets.symmetric(vertical: _KSpace.lg),
      decoration: BoxDecoration(
        color: accent ?? _KColors.panel,
        borderRadius: BorderRadius.circular(_KRadius.panel),
        border: onAccent ? null : Border.all(color: _KColors.line),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: _KSpace.lg),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  rail.title,
                  style: _KType.section.copyWith(
                    color: onAccent ? Colors.white : _KColors.ink,
                  ),
                ),
                if (rail.subtitle != null && rail.subtitle!.isNotEmpty)
                  Padding(
                    padding: const EdgeInsets.only(top: 2),
                    child: Text(
                      rail.subtitle!,
                      style: _KType.meta.copyWith(
                        color: onAccent
                            // 0xC7 is 78% of 255 — see the ARGB note above.
                            ? const Color(0xC7FFFFFF)
                            : _KColors.muted,
                      ),
                    ),
                  ),
              ],
            ),
          ),
          const SizedBox(height: _KSpace.md),
          SizedBox(
            // Tall enough for a 150px square photograph plus the text rows.
            // Fixed rather than intrinsic: a horizontal list has no height of
            // its own to measure.
            height: 286,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: _KSpace.lg),
              itemCount: rail.products.length,
              separatorBuilder: (_, __) => const SizedBox(width: _KSpace.md),
              itemBuilder: (context, index) {
                final product = rail.products[index];
                final tile = _Tile(
                  product: product,
                  onOpen: () => onOpen(product),
                  onAdd: onAdd,
                );
                return SizedBox(
                  width: 150,
                  // On an accent shelf the tile takes a white card: the tile
                  // sets its text in ink, and ink on violet or crimson is
                  // unreadable. A shelf's ground and the readability of what
                  // stands on it are ONE decision — the website learned this
                  // by shipping the dark version without the cards and
                  // reverting it within the hour.
                  child: onAccent
                      ? Container(
                          padding: const EdgeInsets.all(_KSpace.sm),
                          decoration: BoxDecoration(
                            color: _KColors.panel,
                            borderRadius:
                                BorderRadius.circular(_KRadius.photo),
                          ),
                          child: tile,
                        )
                      : tile,
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}

/// The product tile.
///
/// The WHOLE tile is the tap target — not just the photograph and the name. A
/// shopper aims at a tile, and on a phone the gaps between its rows are
/// thumb-sized; a tile with two small live regions and dead space between them
/// feels broken without anybody being able to say why. The basket button sits
/// above that gesture and takes its own tap.
class _Tile extends StatelessWidget {
  const _Tile({required this.product, required this.onOpen, this.onAdd});

  final _KProduct product;
  final VoidCallback onOpen;
  final ValueChanged<_KProduct>? onAdd;

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
                    borderRadius: BorderRadius.circular(_KRadius.photo),
                    child: _Photo(url: product.image),
                  ),
                  if (product.discountPercent > 0)
                    Positioned(
                      top: 6,
                      right: 6,
                      child: _Flag(label: '-${product.discountPercent}%'),
                    ),
                  if (!product.inStock)
                    const Positioned(
                      top: 6,
                      left: 6,
                      child: _Flag(
                        label: 'Sold out',
                        background: _KColors.ink,
                        foreground: Colors.white,
                      ),
                    ),
                  if (onAdd != null && product.inStock)
                    Positioned(
                      bottom: 6,
                      right: 6,
                      child: _AddButton(
                        // A product with options cannot be added from a tile —
                        // it opens instead, where the picker is.
                        onTap: () =>
                            product.hasOptions ? onOpen() : onAdd!(product),
                        icon: product.hasOptions
                            ? Icons.tune_rounded
                            : Icons.add_shopping_cart_rounded,
                      ),
                    ),
                ],
              ),
            ),
            const SizedBox(height: _KSpace.sm),
            Text(product.name,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: _KType.name),
            const SizedBox(height: 3),
            // The saving is a chip rather than coloured text: it competes with
            // a bolder price directly under it, and green on white at 11px is
            // easy to miss where a tinted chip is not.
            if (product.savingLabel != null)
              Container(
                margin: const EdgeInsets.only(bottom: 3),
                padding:
                    const EdgeInsets.symmetric(horizontal: 5, vertical: 1.5),
                decoration: BoxDecoration(
                  color: _KColors.saveSoft,
                  borderRadius: BorderRadius.circular(5),
                ),
                child: Text(
                  'Save ${product.savingLabel}',
                  style: const TextStyle(
                      fontSize: 10.5,
                      fontWeight: FontWeight.w700,
                      color: _KColors.save),
                ),
              ),
            Row(
              crossAxisAlignment: CrossAxisAlignment.baseline,
              textBaseline: TextBaseline.alphabetic,
              children: [
                Flexible(
                  child: Text(product.priceLabel,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: _KType.price),
                ),
                if (product.wasPriceLabel != null) ...[
                  const SizedBox(width: 5),
                  Flexible(
                    child: Text(product.wasPriceLabel!,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: _KType.wasPrice),
                  ),
                ],
              ],
            ),
            // Only drawn when there is a number to carry. A row that renders
            // empty on most tiles is a row of debris at forty different
            // heights down the grid.
            if (product.totalSales > 0 || product.ratingCount > 0)
              Padding(
                padding: const EdgeInsets.only(top: 2),
                child: Row(
                  children: [
                    if (product.ratingCount > 0) ...[
                      const Icon(Icons.star_rounded,
                          size: 12, color: _KColors.star),
                      const SizedBox(width: 2),
                      Text(product.rating.toStringAsFixed(1),
                          style: _KType.meta),
                      const SizedBox(width: 6),
                    ],
                    if (product.totalSales > 0)
                      Flexible(
                        child: Text('${product.totalSales} sold',
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: _KType.meta),
                      ),
                  ],
                ),
              ),
          ],
        ),
      ),
    );
  }
}

/// A network image with the three states a photograph actually has.
///
/// `cached_network_image` rather than `Image.network`: a catalogue is the same
/// few hundred pictures seen over and over as the shopper moves between Home, a
/// product and back, and refetching them on every build is most of what makes a
/// shopping app feel slow on a Ugandan mobile connection.
class _Photo extends StatelessWidget {
  const _Photo({
    required this.url,
    this.fit = BoxFit.cover,
    this.padding = EdgeInsets.zero,
  });

  final String url;
  final BoxFit fit;
  final EdgeInsets padding;

  @override
  Widget build(BuildContext context) {
    if (url.isEmpty) return const _NoPhoto();
    return Padding(
      padding: padding,
      child: CachedNetworkImage(
        imageUrl: url,
        fit: fit,
        fadeInDuration: const Duration(milliseconds: 160),
        placeholder: (_, __) => const ColoredBox(color: _KColors.hairline),
        errorWidget: (_, __, ___) => const _NoPhoto(),
      ),
    );
  }
}

class _NoPhoto extends StatelessWidget {
  const _NoPhoto();

  @override
  Widget build(BuildContext context) {
    return const ColoredBox(
      color: _KColors.hairline,
      child: Center(
        child: Icon(Icons.image_not_supported_outlined,
            size: 22, color: _KColors.faint),
      ),
    );
  }
}

class _Flag extends StatelessWidget {
  const _Flag({
    required this.label,
    this.background = _KColors.dealFlag,
    this.foreground = _KColors.ink,
  });

  final String label;
  final Color background;
  final Color foreground;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 4),
      decoration: BoxDecoration(
        color: background,
        borderRadius: BorderRadius.circular(_KRadius.chip),
      ),
      child: Text(
        label,
        style: TextStyle(
            fontSize: 11,
            height: 1,
            fontWeight: FontWeight.w800,
            color: foreground),
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
    return Material(
      color: Colors.white,
      shape: const CircleBorder(),
      elevation: 1.5,
      child: InkWell(
        onTap: onTap,
        customBorder: const CircleBorder(),
        child: SizedBox(
            width: 34, height: 34, child: Icon(icon, size: 17, color: _KColors.ink)),
      ),
    );
  }
}

/// Nothing here, and what to do about it. Always carries an action — an empty
/// state that only apologises leaves the shopper on a dead screen.
class _Empty extends StatelessWidget {
  const _Empty({
    required this.icon,
    required this.title,
    required this.message,
    this.actionLabel,
    this.onAction,
  });

  final IconData icon;
  final String title;
  final String message;
  final String? actionLabel;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(_KSpace.xl),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 72,
              height: 72,
              decoration: const BoxDecoration(
                  color: _KColors.primarySoft, shape: BoxShape.circle),
              child: Icon(icon, size: 32, color: _KColors.primary),
            ),
            const SizedBox(height: _KSpace.lg),
            Text(title, style: _KType.section, textAlign: TextAlign.center),
            const SizedBox(height: _KSpace.sm),
            Text(message, style: _KType.bodyText, textAlign: TextAlign.center),
            if (actionLabel != null && onAction != null) ...[
              const SizedBox(height: _KSpace.xl),
              SizedBox(
                width: 220,
                height: 48,
                child: FilledButton(
                  onPressed: onAction,
                  style: FilledButton.styleFrom(
                    backgroundColor: _KColors.primary,
                    shape: RoundedRectangleBorder(
                        borderRadius:
                            BorderRadius.circular(_KRadius.chip)),
                  ),
                  child: Text(actionLabel!,
                      style: const TextStyle(
                          fontSize: 15, fontWeight: FontWeight.w700)),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

/// What the screen shows before the first answer arrives.
///
/// A shimmering block of roughly the right shape rather than a spinner: a
/// spinner says "something is happening", a skeleton says "a grid of products
/// is arriving", and the second stops the layout jumping when it does.
class _HomeSkeleton extends StatefulWidget {
  const _HomeSkeleton();

  @override
  State<_HomeSkeleton> createState() => _HomeSkeletonState();
}

class _HomeSkeletonState extends State<_HomeSkeleton>
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

  Widget _block(double width, double height, [double radius = 12]) {
    return AnimatedBuilder(
      animation: _controller,
      builder: (context, _) => Container(
        width: width,
        height: height,
        decoration: BoxDecoration(
          color: Color.lerp(
              _KColors.hairline, _KColors.line, _controller.value),
          borderRadius: BorderRadius.circular(radius),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(_KSpace.lg),
      children: [
        _block(double.infinity, 48),
        const SizedBox(height: _KSpace.lg),
        SizedBox(
          height: 92,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            itemCount: 5,
            separatorBuilder: (_, __) => const SizedBox(width: _KSpace.md),
            itemBuilder: (_, __) => Column(
              children: [
                _block(66, 66, 33),
                const SizedBox(height: 6),
                _block(48, 10, 4),
              ],
            ),
          ),
        ),
        const SizedBox(height: _KSpace.xl),
        _block(160, 20, 6),
        const SizedBox(height: _KSpace.md),
        SizedBox(
          height: 240,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            itemCount: 3,
            separatorBuilder: (_, __) => const SizedBox(width: _KSpace.md),
            itemBuilder: (_, __) => Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _block(150, 150),
                const SizedBox(height: _KSpace.sm),
                _block(130, 12, 4),
                const SizedBox(height: 6),
                _block(80, 14, 4),
              ],
            ),
          ),
        ),
      ],
    );
  }
}
