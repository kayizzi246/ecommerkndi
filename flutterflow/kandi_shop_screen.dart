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

import 'package:cached_network_image/cached_network_image.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

// Navigation only.
import '/custom_code/widgets/kandi_product_screen.dart';
import '/custom_code/widgets/kandi_cart_screen.dart';

// ============================================================
//  KANDI — SHOP PAGE
//
//  Browsing by department, and the department picker when no
//  department has been chosen.
//
//  Self-contained like every page here. The architecture is
//  written out in full at the head of kandi_home_screen.dart.
//
//  ---- Nothing is passed in ----
//
//  The category, if there is one, is read from
//  `kandi-open-category` as `slug|Name`. Home writes it before
//  opening this page.
//
//  Opened with no category — which is what the bottom bar's
//  "Shop" tab does — the page lists the departments instead of
//  showing an empty grid. That is the honest state for "browse"
//  with nothing chosen, and it saves a shopper a trip back to
//  Home to pick one.
//
//  ---- Sorting is server-side ----
//
//  The sort goes on the request rather than being applied to
//  the page already fetched. Sorting the twenty-four rows in
//  hand is only correct while the whole result fits on one
//  page, and it stops being correct exactly when it matters —
//  on a big department, where "cheapest first" would mean
//  "cheapest of the first two dozen".
// ============================================================

class _KColors {
  const _KColors._();
  static const Color canvas = Color(0xFFF2F4F7);
  static const Color panel = Color(0xFFFFFFFF);
  static const Color ink = Color(0xFF111827);
  static const Color body = Color(0xFF4B5563);
  static const Color muted = Color(0xFF6B7280);
  static const Color faint = Color(0xFF9CA3AF);
  static const Color line = Color(0xFFE5E7EB);
  static const Color hairline = Color(0xFFF3F4F6);
  static const Color primary = Color(0xFFFF6A00);
  static const Color primarySoft = Color(0xFFFFF3E8);
  static const Color save = Color(0xFF15803D);
  static const Color saveSoft = Color(0xFFECFDF3);
  static const Color star = Color(0xFFF59E0B);
}

class _KSpace {
  const _KSpace._();
  static const double sm = 8;
  static const double md = 12;
  static const double lg = 16;
  static const double xl = 24;
}

const double _rPanel = 14;
const double _rPhoto = 10;
const double _rChip = 8;
const String _apiBase = 'https://kandiug.com';

// The keys every page in this app agrees on.
const String _basketKey = 'kandi-cart-v1';
const String _openProductKey = 'kandi-open-product';
const String _openCategoryKey = 'kandi-open-category';
const String _openSortKey = 'kandi-open-sort';

/// The sorts the API accepts, with the words a shopper uses for them.
const List<({String key, String label})> _sorts = [
  (key: 'newest', label: 'Newest'),
  (key: 'popular', label: 'Most popular'),
  (key: 'price_asc', label: 'Price: low to high'),
  (key: 'price_desc', label: 'Price: high to low'),
  (key: 'rating', label: 'Best rated'),
];

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
      hasOptions: json['hasOptions'] == true,
    );
  }

  static List<_KProduct> listFrom(dynamic json) {
    if (json is! List) return const [];
    return json.map(_KProduct.from).whereType<_KProduct>().toList();
  }
}

class _KDept {
  const _KDept({required this.name, required this.slug, required this.count});
  final String name;
  final String slug;
  final int count;

  static List<_KDept> listFrom(dynamic json) {
    if (json is! List) return const [];
    final out = <_KDept>[];
    for (final entry in json) {
      if (entry is! Map) continue;
      final name = (entry['name'] ?? '').toString();
      final slug = (entry['slug'] ?? '').toString();
      if (name.isEmpty || slug.isEmpty) continue;
      out.add(_KDept(
        name: name,
        slug: slug,
        count: entry['count'] is int ? entry['count'] as int : 0,
      ));
    }
    return out;
  }
}

Future<void> _handoff(String key, String value) async {
  try {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(key, value);
  } catch (_) {}
}

Future<void> _addToBasket(_KProduct product) async {
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
  } catch (_) {}
}

class KandiShopScreen extends StatefulWidget {
  const KandiShopScreen({super.key, this.width, this.height});

  final double? width;
  final double? height;

  @override
  State<KandiShopScreen> createState() => _KandiShopScreenState();
}

class _KandiShopScreenState extends State<KandiShopScreen> {
  String _slug = '';
  String _title = 'Shop';
  String _sort = 'newest';

  bool _loading = true;
  bool _failed = false;
  List<_KProduct> _products = const [];
  List<_KDept> _departments = const [];
  int _total = 0;

  @override
  void initState() {
    super.initState();
    _restore();
  }

  Future<void> _restore() async {
    String slug = '';
    String name = '';
    String sort = _sort;
    try {
      final prefs = await SharedPreferences.getInstance();
      final raw = prefs.getString(_openCategoryKey) ?? '';
      // Consumed on read: leaving it set means the "Shop" tab keeps reopening
      // the last department a shopper visited instead of the picker.
      await prefs.remove(_openCategoryKey);
      final parts = raw.split('|');
      if (parts.isNotEmpty && parts.first.isNotEmpty) {
        slug = parts.first;
        name = parts.length > 1 ? parts[1] : parts.first;
      }

      // A rail's "View all" asks for a sort as well as an aisle. Consumed for
      // the same reason: it describes one arrival, not a preference.
      final wanted = prefs.getString(_openSortKey) ?? '';
      await prefs.remove(_openSortKey);
      // Checked against the list rather than trusted: an unknown key would be
      // sent to the API and come back as an unsorted page with no explanation.
      if (_sorts.any((option) => option.key == wanted)) sort = wanted;
    } catch (_) {
      slug = '';
    }

    if (!mounted) return;
    setState(() {
      _slug = slug;
      _sort = sort;
      if (name.isNotEmpty) {
        _title = name;
      } else if (sort != 'newest') {
        // Named after the sort when there is no department, so a shopper who
        // tapped "View all" under Best sellers does not land on a page headed
        // "Shop" with no clue why these products are in this order.
        final match = _sorts.where((option) => option.key == sort);
        if (match.isNotEmpty) _title = match.first.label;
      }
    });
    _load();
  }

  Future<void> _load() async {
    if (mounted) setState(() => _loading = true);

    // With no department chosen the request still runs — it returns the
    // department list this page needs for the picker, and the newest products
    // as a reasonable default grid.
    final query = StringBuffer('$_apiBase/api/app/products?sort=$_sort');
    if (_slug.isNotEmpty) {
      query.write('&category=${Uri.encodeQueryComponent(_slug)}');
    }

    dynamic data;
    int status = 0;
    try {
      final response =
          await http.get(Uri.parse(query.toString())).timeout(const Duration(seconds: 20));
      status = response.statusCode;
      data = jsonDecode(response.body);
    } catch (_) {
      status = 0;
    }

    if (!mounted) return;

    if (status != 200 || data is! Map) {
      setState(() {
        _loading = false;
        _failed = _products.isEmpty;
      });
      return;
    }

    setState(() {
      _loading = false;
      _failed = false;
      _products = _KProduct.listFrom(data['products']);
      _departments = _KDept.listFrom(data['departments']);
      _total = data['total'] is int ? data['total'] as int : _products.length;
    });
  }

  Future<void> _pick(_KDept department) async {
    setState(() {
      _slug = department.slug;
      _title = department.name;
    });
    await _load();
  }

  Future<void> _open(_KProduct product) async {
    await _handoff(_openProductKey, '${product.id}');
    if (!mounted) return;
    await Navigator.of(context)
        .push(MaterialPageRoute(builder: (_) => const KandiProductScreen()));
  }

  Future<void> _add(_KProduct product) async {
    await _addToBasket(product);
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('${product.name} added'),
        duration: const Duration(seconds: 2),
        behavior: SnackBarBehavior.floating,
        action: SnackBarAction(
          label: 'Basket',
          textColor: Colors.white,
          onPressed: () => Navigator.of(context)
              .push(MaterialPageRoute(builder: (_) => const KandiCartScreen())),
        ),
      ),
    );
  }

  Future<void> _chooseSort() async {
    final chosen = await showModalBottomSheet<String>(
      context: context,
      backgroundColor: _KColors.panel,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(_rPanel)),
      ),
      builder: (context) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Padding(
              padding: EdgeInsets.all(_KSpace.lg),
              child: Text('Sort by',
                  style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w800,
                      color: _KColors.ink)),
            ),
            for (final sort in _sorts)
              ListTile(
                title: Text(sort.label,
                    style: TextStyle(
                      fontSize: 14.5,
                      fontWeight:
                          sort.key == _sort ? FontWeight.w700 : FontWeight.w400,
                      color: _KColors.ink,
                    )),
                trailing: sort.key == _sort
                    ? const Icon(Icons.check_rounded,
                        size: 20, color: _KColors.primary)
                    : null,
                onTap: () => Navigator.of(context).pop(sort.key),
              ),
            const SizedBox(height: _KSpace.sm),
          ],
        ),
      ),
    );

    if (chosen == null || chosen == _sort) return;
    setState(() => _sort = chosen);
    await _load();
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
          iconTheme: const IconThemeData(color: _KColors.ink),
          title: Text(_title,
              style: const TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w700,
                  color: _KColors.ink)),
          actions: [
            IconButton(
              onPressed: _chooseSort,
              tooltip: 'Sort',
              icon: const Icon(Icons.sort_rounded, color: _KColors.ink),
            ),
          ],
        ),
        body: _buildBody(),
      ),
    );
  }

  Widget _buildBody() {
    if (_loading && _products.isEmpty) {
      return const Center(
          child: CircularProgressIndicator(color: _KColors.primary));
    }

    if (_failed) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(_KSpace.xl),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.wifi_off_rounded, size: 44, color: _KColors.muted),
              const SizedBox(height: _KSpace.md),
              const Text('Could not load the shop',
                  style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w700,
                      color: _KColors.ink)),
              const SizedBox(height: _KSpace.lg),
              FilledButton(
                onPressed: _load,
                style: FilledButton.styleFrom(backgroundColor: _KColors.primary),
                child: const Text('Try again'),
              ),
            ],
          ),
        ),
      );
    }

    return RefreshIndicator(
      color: _KColors.primary,
      onRefresh: _load,
      child: CustomScrollView(
        slivers: [
          // The department row stays on screen after a choice, so switching
          // aisle does not mean going back first.
          if (_departments.isNotEmpty)
            SliverToBoxAdapter(
              child: SizedBox(
                height: 44,
                child: ListView.separated(
                  scrollDirection: Axis.horizontal,
                  padding: const EdgeInsets.fromLTRB(
                      _KSpace.md, _KSpace.sm, _KSpace.md, 0),
                  itemCount: _departments.length + 1,
                  separatorBuilder: (_, __) => const SizedBox(width: _KSpace.sm),
                  itemBuilder: (context, index) {
                    if (index == 0) {
                      return _Pill(
                        label: 'All',
                        selected: _slug.isEmpty,
                        onTap: () {
                          setState(() {
                            _slug = '';
                            _title = 'Shop';
                          });
                          _load();
                        },
                      );
                    }
                    final department = _departments[index - 1];
                    return _Pill(
                      label: department.name,
                      selected: department.slug == _slug,
                      onTap: () => _pick(department),
                    );
                  },
                ),
              ),
            ),
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(
                  _KSpace.md, _KSpace.md, _KSpace.md, _KSpace.sm),
              child: Text(
                '$_total ${_total == 1 ? 'item' : 'items'}',
                style: const TextStyle(fontSize: 13, color: _KColors.muted),
              ),
            ),
          ),
          if (_products.isEmpty)
            const SliverToBoxAdapter(
              child: Padding(
                padding: EdgeInsets.all(_KSpace.xl),
                child: Center(
                  child: Text('Nothing in this department yet.',
                      style: TextStyle(fontSize: 14, color: _KColors.body)),
                ),
              ),
            )
          else
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(
                  _KSpace.md, 0, _KSpace.md, _KSpace.xl),
              sliver: SliverGrid(
                gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                  crossAxisCount: 2,
                  mainAxisSpacing: _KSpace.md,
                  crossAxisSpacing: _KSpace.md,
                  childAspectRatio: 0.52,
                ),
                delegate: SliverChildBuilderDelegate(
                  (context, index) {
                    final product = _products[index];
                    return _Card(
                      product: product,
                      onOpen: () => _open(product),
                      onAdd: () => _add(product),
                    );
                  },
                  childCount: _products.length,
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class _Pill extends StatelessWidget {
  const _Pill({required this.label, required this.selected, required this.onTap});

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        alignment: Alignment.center,
        padding: const EdgeInsets.symmetric(horizontal: _KSpace.lg),
        decoration: BoxDecoration(
          // A filled tint with a brand border rather than a colour change on
          // the text alone: at a glance a shopper has to see WHICH aisle they
          // are in, and a one-shade difference does not carry that.
          color: selected ? _KColors.primarySoft : _KColors.panel,
          borderRadius: BorderRadius.circular(_rChip),
          border: Border.all(
              color: selected ? _KColors.primary : _KColors.line,
              width: selected ? 1.5 : 1),
        ),
        child: Text(label,
            style: TextStyle(
                fontSize: 13,
                fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
                color: _KColors.ink)),
      ),
    );
  }
}

class _Card extends StatelessWidget {
  const _Card({required this.product, required this.onOpen, required this.onAdd});

  final _KProduct product;
  final VoidCallback onOpen;
  final VoidCallback onAdd;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: '${product.name}. ${product.priceLabel}',
      child: GestureDetector(
        onTap: onOpen,
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
                    if (product.inStock)
                      Positioned(
                        bottom: 0,
                        right: 0,
                        child: GestureDetector(
                          onTap: product.hasOptions ? onOpen : onAdd,
                          behavior: HitTestBehavior.opaque,
                          child: Container(
                            width: 34,
                            height: 34,
                            decoration: BoxDecoration(
                              color: _KColors.panel,
                              borderRadius: BorderRadius.circular(_rChip),
                              border: Border.all(color: _KColors.line),
                            ),
                            child: Icon(
                                product.hasOptions
                                    ? Icons.tune_rounded
                                    : Icons.add_rounded,
                                size: 20,
                                color: _KColors.ink),
                          ),
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
                  ],
                ),
                const SizedBox(height: 3),
              ],
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
            ],
          ),
        ),
      ),
    );
  }
}

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
      fit: BoxFit.contain,
      fadeInDuration: const Duration(milliseconds: 160),
      placeholder: (_, __) => const ColoredBox(color: _KColors.hairline),
      errorWidget: (_, __, ___) => const ColoredBox(color: _KColors.hairline),
    );
  }
}
