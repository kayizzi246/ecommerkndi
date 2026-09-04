// Automatic FlutterFlow imports
import '/flutter_flow/flutter_flow_theme.dart';
import '/flutter_flow/flutter_flow_util.dart';
import '/custom_code/widgets/index.dart'; // Imports other custom widgets
import '/flutter_flow/custom_functions.dart'; // Imports custom functions
import 'package:flutter/material.dart';
// Begin custom widget code
// DO NOT REMOVE OR MODIFY THE CODE ABOVE!

// Imports go BELOW the header — FlutterFlow rewrites it on save and drops
// anything added there. Do not add the `/backend/` imports it offers.
import 'dart:convert';

import 'package:flutter/services.dart';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

// Navigation only.
import '/custom_code/widgets/kandi_shop_screen.dart';
import '/custom_code/widgets/kandi_product_screen.dart';
import '/custom_code/widgets/kandi_search_screen.dart';

// ============================================================
//  KANDI — CATEGORIES
//
//  Self-contained like every page here: its own palette, HTTP
//  and models, all file-private. The architecture is written
//  out in full at the head of kandi_home_screen.dart.
//
//  ---- Why this screen exists at all ----
//
//  The Shop page can already list any department, and for a
//  shopper who knows which one they want that is enough. It is
//  not enough for the shopper who does not: Shop opened with no
//  department shows a list of names, and a name is the one thing
//  that cannot answer "does this shop have sandals worth
//  buying".
//
//  So this is the browse screen every marketplace on this market
//  serves, and the same one the website now serves on a phone: a
//  rail of departments down the left that never moves, and the
//  selected department's shelves as PHOTOGRAPHS on the right.
//  The list you are choosing from stays on screen while the
//  choice changes, which a stack of sections cannot do at any
//  height.
//
//  ---- One request ----
//
//  `/api/app/categories` returns the whole tree with a picture
//  on every shelf and a dozen of each department's products.
//  Fetched once, switched between locally — tapping a
//  department must not cost a round trip, or the rail stops
//  feeling like a rail and starts feeling like navigation.
//
//  Shelf pictures are borrowed: a WooCommerce category rarely
//  has an image of its own, so the server falls back to the
//  first product filed beneath it. A tile showing real stock is
//  a better tile than a designed icon anyway.
//
//  ---- Nothing is passed in ----
//
//  Tapping a shelf writes `kandi-open-category` as `slug|Name`
//  and pushes the Shop page, which is the same handoff Home
//  uses. See SETUP.md.
// ============================================================

class _KColors {
  const _KColors._();
  static const Color panel = Color(0xFFFFFFFF);
  static const Color ink = Color(0xFF111827);
  static const Color body = Color(0xFF4B5563);
  static const Color muted = Color(0xFF6B7280);
  static const Color faint = Color(0xFF9CA3AF);
  static const Color line = Color(0xFFE5E7EB);
  static const Color hairline = Color(0xFFF3F4F6);
  static const Color primary = Color(0xFFFF6A00);
  static const Color primarySoft = Color(0xFFFFF3EA);

  /// ---- The money colour ----
  ///
  /// #D62200 rather than a brighter red: white on it is 5.1:1, so the same
  /// value works as a ground under white button text AND as text on white at
  /// the 11px a card's price line runs at. The brighter reds do one or the
  /// other, never both.
  static const Color flame = Color(0xFFD62200);

  /// The rail's ground.
  ///
  /// A shade off the canvas rather than the canvas itself, because the pane
  /// beside it is white: the selected row is white too, so it reads as a notch
  /// cut out of the rail into the pane rather than as a highlighted row in a
  /// list. That is the whole trick of this layout — if the rail and the pane
  /// were the same colour there would be nothing to cut.
  static const Color rail = Color(0xFFF7F7F7);
}

class _KSpace {
  const _KSpace._();
  static const double sm = 8;
  static const double md = 12;
  static const double lg = 16;
  static const double xl = 24;
}

const double _rPhoto = 8;

/// The `Accept` header every photograph in this app is fetched with.
///
/// The API hands back image URLs pointing at the storefront's own optimiser,
/// which picks its output format from the request. Dart's HTTP client — which
/// is what `cached_network_image` uses — sends no `Accept` header at all, so
/// without this the app collects the resizing and the CDN delivery and
/// silently leaves the format conversion on the table.
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

// The keys every page in this app agrees on. Repeated verbatim in each file;
// if one changes it must change in all of them at once.
const String _openCategoryKey = 'kandi-open-category';
const String _openProductKey = 'kandi-open-product';
const String _openSearchKey = 'kandi-open-search';

Future<void> _handoff(String key, String value) async {
  try {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(key, value);
  } catch (_) {
    // The destination falls back to its own empty state.
  }
}

/// One shelf under a department.
///
/// `depth` is 1 for a shelf and 2 for a sub-shelf. The tree is flattened by the
/// server into one ordered list — each shelf followed by its own sub-shelves —
/// because a grid cannot express nesting and a shopper does not need it to:
/// what they need is for Sandals to be visible without opening Shoes first.
class _KShelf {
  const _KShelf({
    required this.name,
    required this.slug,
    required this.image,
    required this.depth,
    required this.count,
  });

  final String name;
  final String slug;
  final String image;
  final int depth;
  final int count;

  static _KShelf? from(dynamic json) {
    if (json is! Map) return null;
    final slug = (json['slug'] ?? '').toString();
    if (slug.isEmpty) return null;
    return _KShelf(
      name: (json['name'] ?? '').toString(),
      slug: slug,
      image: (json['image'] ?? '').toString(),
      depth: json['depth'] is int ? json['depth'] as int : 1,
      count: json['count'] is int ? json['count'] as int : 0,
    );
  }
}

/// Just enough of a product to draw a small tile and open it.
///
/// Deliberately not the full product shape the tile grids use. This grid is the
/// tail of a browse screen: it exists so a department is a place with goods in
/// it rather than a page of labels, and a shopper comparing prices is on the
/// Shop screen, which is one tap away at the top of the pane.
class _KMini {
  const _KMini({required this.id, required this.name, required this.image});

  final int id;
  final String name;
  final String image;

  static _KMini? from(dynamic json) {
    if (json is! Map) return null;
    final id = json['id'];
    if (id is! int) return null;
    return _KMini(
      id: id,
      name: (json['name'] ?? '').toString(),
      image: (json['image'] ?? '').toString(),
    );
  }
}

class _KDepartment {
  const _KDepartment({
    required this.id,
    required this.name,
    required this.slug,
    required this.count,
    required this.shelves,
    required this.products,
  });

  final int id;
  final String name;
  final String slug;
  final int count;
  final List<_KShelf> shelves;
  final List<_KMini> products;

  static _KDepartment? from(dynamic json) {
    if (json is! Map) return null;
    final id = json['id'];
    final slug = (json['slug'] ?? '').toString();
    if (id is! int || slug.isEmpty) return null;
    return _KDepartment(
      id: id,
      name: (json['name'] ?? '').toString(),
      slug: slug,
      count: json['count'] is int ? json['count'] as int : 0,
      shelves: json['shelves'] is List
          ? (json['shelves'] as List)
              .map(_KShelf.from)
              .whereType<_KShelf>()
              .toList()
          : const <_KShelf>[],
      products: json['products'] is List
          ? (json['products'] as List)
              .map(_KMini.from)
              .whereType<_KMini>()
              .toList()
          : const <_KMini>[],
    );
  }
}

class KandiCategoriesScreen extends StatefulWidget {
  const KandiCategoriesScreen({super.key, this.width, this.height});

  final double? width;
  final double? height;

  @override
  State<KandiCategoriesScreen> createState() => _KandiCategoriesScreenState();
}

class _KandiCategoriesScreenState extends State<KandiCategoriesScreen> {
  bool _loading = true;
  bool _failed = false;
  List<_KDepartment> _departments = const [];
  int _active = 0;

  /// The pane's own scroll position, reset on every department change.
  ///
  /// Without this, switching from a department scrolled halfway down opens the
  /// next one halfway down its shelves — which looks like the tap did nothing
  /// at all when the two happen to be a similar length.
  final ScrollController _pane = ScrollController();

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _pane.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _failed = false;
    });

    dynamic data;
    int status = 0;
    try {
      final response = await http
          .get(Uri.parse('$_apiBase/api/app/categories'))
          .timeout(const Duration(seconds: 20));
      status = response.statusCode;
      data = jsonDecode(response.body);
    } catch (_) {
      status = 0;
    }

    if (!mounted) return;

    setState(() {
      _loading = false;
      if (status == 200 && data is Map && data['departments'] is List) {
        _departments = (data['departments'] as List)
            .map(_KDepartment.from)
            .whereType<_KDepartment>()
            .toList();
        _failed = _departments.isEmpty;
        _active = 0;
      } else {
        _departments = const [];
        _failed = true;
      }
    });
  }

  void _select(int index) {
    if (index == _active) return;
    setState(() => _active = index);
    if (_pane.hasClients) _pane.jumpTo(0);
  }

  Future<void> _openCategory(String slug, String name) async {
    await _handoff(_openCategoryKey, '$slug|$name');
    if (!mounted) return;
    await Navigator.of(context)
        .push(MaterialPageRoute(builder: (_) => const KandiShopScreen()));
  }

  Future<void> _openProduct(int id) async {
    await _handoff(_openProductKey, '$id');
    if (!mounted) return;
    await Navigator.of(context)
        .push(MaterialPageRoute(builder: (_) => const KandiProductScreen()));
  }

  Future<void> _openSearch() async {
    await _handoff(_openSearchKey, '');
    if (!mounted) return;
    await Navigator.of(context)
        .push(MaterialPageRoute(builder: (_) => const KandiSearchScreen()));
  }

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: widget.width,
      height: widget.height,
      child: Scaffold(
        backgroundColor: _KColors.panel,
        appBar: AppBar(
          backgroundColor: Colors.transparent,
          surfaceTintColor: Colors.transparent,
          elevation: 0,
          scrolledUnderElevation: 0,
          // The gradient goes behind the bar rather than in `backgroundColor`,
          // which only takes a flat colour. `flexibleSpace` fills the whole
          // bar including the status-bar strip above it, so the ramp starts at
          // the top of the screen and not under the clock.
          // SizedBox.expand is load-bearing. A childless DecoratedBox has
          // no size, and AppBar puts flexibleSpace in a Stack under loose
          // constraints — so the gradient painted nothing at all and every
          // sub-page had a white title on a white bar.
          flexibleSpace: const DecoratedBox(
            decoration: BoxDecoration(gradient: _brandGradient),
            child: SizedBox.expand(),
          ),
          systemOverlayStyle: SystemUiOverlayStyle.light,
          iconTheme: const IconThemeData(color: Colors.white),
          title: const Text('Categories',
              style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w700,
                  color: Colors.white)),
          actions: [
            IconButton(
              onPressed: _openSearch,
              icon: const Icon(Icons.search_rounded, color: Colors.white),
              tooltip: 'Search',
            ),
          ],
        ),
        body: _buildBody(),
      ),
    );
  }

  Widget _buildBody() {
    if (_loading) {
      return const Center(
          child: CircularProgressIndicator(color: _KColors.primary));
    }

    if (_failed || _departments.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(_KSpace.xl),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 76,
                height: 76,
                decoration: const BoxDecoration(
                    color: _KColors.primarySoft, shape: BoxShape.circle),
                child: const Icon(Icons.category_outlined,
                    size: 34, color: _KColors.primary),
              ),
              const SizedBox(height: _KSpace.lg),
              const Text('Could not load the departments',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w800,
                      color: _KColors.ink)),
              const SizedBox(height: _KSpace.sm),
              const Text('Check your connection and try again.',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                      fontSize: 13.5, height: 1.5, color: _KColors.body)),
              const SizedBox(height: _KSpace.xl),
              SizedBox(
                width: 220,
                height: 48,
                child: FilledButton(
                  onPressed: _load,
                  style: FilledButton.styleFrom(
                    backgroundColor: _KColors.flame,
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(_rPill)),
                  ),
                  child: const Text('Try again',
                      style: TextStyle(
                          fontSize: 15, fontWeight: FontWeight.w700)),
                ),
              ),
            ],
          ),
        ),
      );
    }

    final current = _departments[_active.clamp(0, _departments.length - 1)];

    return Row(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _buildRail(),
        Expanded(child: _buildPane(current)),
      ],
    );
  }

  /// The department rail.
  ///
  /// 104 is about a quarter of a 390px phone, which is the narrowest a long
  /// department name stays readable at 13px over two lines. Wider starts taking
  /// the third tile column away from the pane the rail exists to serve.
  Widget _buildRail() {
    return Container(
      width: 104,
      color: _KColors.rail,
      child: ListView.builder(
        padding: EdgeInsets.zero,
        itemCount: _departments.length,
        itemBuilder: (context, index) {
          final department = _departments[index];
          final on = index == _active;
          return InkWell(
            // Null rather than an empty handler on the row already open, so
            // InkWell draws no ripple — the honest signal for "nothing will
            // happen", which is the same rule the bottom bar follows.
            onTap: on ? null : () => _select(index),
            child: Container(
              color: on ? _KColors.panel : Colors.transparent,
              padding: const EdgeInsets.symmetric(
                  horizontal: _KSpace.md, vertical: 14),
              child: Row(
                children: [
                  // The bar is drawn in the layout rather than in a Stack, so
                  // the text of a selected row starts where an unselected row's
                  // text starts. A positioned overlay would leave the two
                  // columns of names a pixel apart and the rail would appear to
                  // twitch as the selection moved.
                  Container(
                    width: 3,
                    height: 20,
                    decoration: BoxDecoration(
                      color: on ? _KColors.flame : Colors.transparent,
                      borderRadius: BorderRadius.circular(_rPill),
                    ),
                  ),
                  const SizedBox(width: _KSpace.sm),
                  Expanded(
                    child: Text(
                      department.name,
                      maxLines: 3,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        fontSize: 13,
                        height: 1.3,
                        fontWeight: on ? FontWeight.w800 : FontWeight.w500,
                        color: on ? _KColors.flame : _KColors.body,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _buildPane(_KDepartment department) {
    final shelves = department.shelves;

    return ListView(
      controller: _pane,
      padding: const EdgeInsets.fromLTRB(
          _KSpace.md, _KSpace.md, _KSpace.md, _KSpace.xl),
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            Expanded(
              child: Text(
                department.name,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                    fontSize: 17,
                    fontWeight: FontWeight.w800,
                    color: _KColors.ink),
              ),
            ),
            GestureDetector(
              onTap: () => _openCategory(department.slug, department.name),
              child: const Padding(
                // Padding rather than bare text: a 12px word is a 12px tap
                // target, and this one sits at the very edge of the screen.
                padding: EdgeInsets.symmetric(horizontal: 4, vertical: 4),
                child: Text('Shop all',
                    style: TextStyle(
                        fontSize: 12.5,
                        fontWeight: FontWeight.w800,
                        color: _KColors.flame)),
              ),
            ),
          ],
        ),
        if (department.count > 0)
          Padding(
            padding: const EdgeInsets.only(top: 2),
            child: Text('${department.count} products',
                style: const TextStyle(fontSize: 12, color: _KColors.muted)),
          ),
        const SizedBox(height: _KSpace.md),

        if (shelves.isEmpty)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: _KSpace.lg),
            child: Text(
              'Everything in ${department.name} is listed together — tap Shop all.',
              style: const TextStyle(
                  fontSize: 13, height: 1.45, color: _KColors.body),
            ),
          )
        else
          GridView.builder(
            // The pane is one scroll view; this grid is a block inside it, so
            // it must not scroll or try to be infinitely tall.
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            padding: EdgeInsets.zero,
            itemCount: shelves.length,
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 3,
              mainAxisSpacing: _KSpace.md,
              crossAxisSpacing: _KSpace.sm,
              // Square photograph, two lines of name, and the gap between
              // them. Tighter than this and a two-line shelf name is clipped
              // on exactly the shelves with the longest names, which are the
              // ones a shopper is most likely to be hunting for.
              childAspectRatio: 0.74,
            ),
            itemBuilder: (context, index) {
              final shelf = shelves[index];
              return _ShelfTile(
                shelf: shelf,
                onTap: () => _openCategory(shelf.slug, shelf.name),
              );
            },
          ),

        if (department.products.isNotEmpty) ...[
          const SizedBox(height: _KSpace.xl),
          Row(
            children: [
              Container(
                width: 3,
                height: 15,
                decoration: BoxDecoration(
                  gradient: _brandGradient,
                  borderRadius: BorderRadius.circular(_rPill),
                ),
              ),
              const SizedBox(width: _KSpace.sm),
              Expanded(
                child: Text('Popular in ${department.name}',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                        fontSize: 14.5,
                        fontWeight: FontWeight.w800,
                        color: _KColors.ink)),
              ),
            ],
          ),
          const SizedBox(height: _KSpace.md),
          GridView.builder(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            padding: EdgeInsets.zero,
            itemCount: department.products.length,
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 2,
              mainAxisSpacing: _KSpace.md,
              crossAxisSpacing: _KSpace.sm,
              childAspectRatio: 0.82,
            ),
            itemBuilder: (context, index) {
              final product = department.products[index];
              return _MiniTile(
                product: product,
                onTap: () => _openProduct(product.id),
              );
            },
          ),
          const SizedBox(height: _KSpace.lg),
          SizedBox(
            height: 46,
            child: OutlinedButton(
              onPressed: () =>
                  _openCategory(department.slug, department.name),
              style: OutlinedButton.styleFrom(
                foregroundColor: _KColors.ink,
                side: const BorderSide(color: _KColors.line),
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(_rPill)),
              ),
              child: Text('See all ${department.name}',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                      fontSize: 14, fontWeight: FontWeight.w700)),
            ),
          ),
        ],
      ],
    );
  }
}

/// A shelf: a square photograph and a name under it.
///
/// A sub-shelf is drawn the same size as its parent deliberately. The depth is
/// carried in the type only, and it is spent on the NAME's weight rather than
/// on the tile's size — three columns is already narrow, and a half-size tile
/// in a grid of full-size ones reads as a rendering fault rather than as a
/// hierarchy.
class _ShelfTile extends StatelessWidget {
  const _ShelfTile({required this.shelf, required this.onTap});

  final _KShelf shelf;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      // Opaque behind the whole tile, so the gap between the photograph and the
      // name is part of the tap target rather than a dead strip through the
      // middle of it.
      behavior: HitTestBehavior.opaque,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          AspectRatio(
            aspectRatio: 1,
            child: _Photo(url: shelf.image, fallback: shelf.name),
          ),
          const SizedBox(height: 6),
          Expanded(
            child: Text(
              shelf.name,
              maxLines: 2,
              textAlign: TextAlign.center,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                fontSize: 11.5,
                height: 1.25,
                fontWeight:
                    shelf.depth > 1 ? FontWeight.w500 : FontWeight.w700,
                color: shelf.depth > 1 ? _KColors.body : _KColors.ink,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// A product, small: the photograph and two lines of name.
class _MiniTile extends StatelessWidget {
  const _MiniTile({required this.product, required this.onTap});

  final _KMini product;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          AspectRatio(
            aspectRatio: 1,
            child: _Photo(url: product.image, fallback: product.name),
          ),
          const SizedBox(height: 6),
          Expanded(
            child: Text(
              product.name,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                  fontSize: 12, height: 1.3, color: _KColors.ink),
            ),
          ),
        ],
      ),
    );
  }
}

/// The photograph, with the two states it actually has on this shop.
///
/// `BoxFit.contain` and never `cover`: a category's picture is borrowed from a
/// product, and a product shot cropped to a square loses the shoe and keeps the
/// box. The letter fallback is for the shelves a shop has genuinely nothing
/// filed under yet — better than a grey rectangle, which reads as an image that
/// failed rather than as a shelf that is empty.
class _Photo extends StatelessWidget {
  const _Photo({required this.url, required this.fallback});

  final String url;
  final String fallback;

  @override
  Widget build(BuildContext context) {
    final letter =
        fallback.trim().isEmpty ? '?' : fallback.trim().substring(0, 1);

    return ClipRRect(
      borderRadius: BorderRadius.circular(_rPhoto),
      child: Container(
        color: _KColors.hairline,
        child: url.isEmpty
            ? Center(
                child: Text(letter.toUpperCase(),
                    style: const TextStyle(
                        fontSize: 20,
                        fontWeight: FontWeight.w900,
                        color: _KColors.faint)),
              )
            : CachedNetworkImage(
                imageUrl: url,
                httpHeaders: _kImageHeaders,
                fit: BoxFit.contain,
                fadeInDuration: const Duration(milliseconds: 150),
                placeholder: (_, __) => const ColoredBox(
                  color: _KColors.hairline,
                  child: SizedBox.expand(),
                ),
                errorWidget: (_, __, ___) => Center(
                  child: Text(letter.toUpperCase(),
                      style: const TextStyle(
                          fontSize: 20,
                          fontWeight: FontWeight.w900,
                          color: _KColors.faint)),
                ),
              ),
      ),
    );
  }
}
