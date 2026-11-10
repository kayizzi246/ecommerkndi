// Automatic FlutterFlow imports
import '/flutter_flow/flutter_flow_theme.dart';
import '/flutter_flow/flutter_flow_util.dart';
import '/custom_code/widgets/index.dart'; // Imports other custom widgets
import '/flutter_flow/custom_functions.dart'; // Imports custom functions
import 'package:flutter/material.dart';
// Begin custom widget code
// DO NOT REMOVE OR MODIFY THE CODE ABOVE!


// ============================================================
//  KANDI — HOME
//  A glass search bar the page scrolls under, the departments,
//  Super deals, New in, one coloured carousel per department,
//  then Best sellers. Products open as glass sheets.
// ============================================================

import 'dart:async';
import 'dart:convert';
import 'dart:math' as math;
import 'dart:ui' as ui;
import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/cupertino.dart';
import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter/services.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
// Supabase comes through FlutterFlow's own file (Settings > Integrations > Supabase must be on).
// Sign-in goes straight to Supabase too (see _KAuth.signInWithGoogle): no generated auth files.
import '/backend/supabase/supabase.dart';
// The other Kandi screens are reached through '/custom_code/widgets/index.dart' above.

class KandiHomeScreen extends StatefulWidget {
  const KandiHomeScreen({super.key, this.width, this.height});
  final double? width;
  final double? height;

  @override
  State<KandiHomeScreen> createState() => _KandiHomeScreenState();
}

class _Rail {
  _Rail(this.category, this.products);
  final _KCategory category;
  final List<_KProduct> products;
}

/// Each department's colour, the same as on the website's home page.
const Map<String, List<Color>> _tones = {
  'men': [Color(0xFFE3EDFF), Color(0xFF1D4ED8)],
  'women': [Color(0xFFFFE3EE), Color(0xFFBE185D)],
  'kids': [Color(0xFFDFF6E6), Color(0xFF15803D)],
  'home-decor': [Color(0xFFFFEAD6), Color(0xFFC2410C)],
};
const List<List<Color>> _spareTones = [
  [Color(0xFFEFE7FF), Color(0xFF6D28D9)],
  [Color(0xFFD9F4F2), Color(0xFF0F766E)],
];

class _KandiHomeScreenState extends State<KandiHomeScreen> {
  bool _loading = true;
  String? _error;
  List<_KCategory> _departments = [];
  List<_KProduct> _deals = [];
  List<_KProduct> _newIn = [];
  List<_KProduct> _best = [];
  List<_Rail> _rails = [];

  @override
  void initState() {
    super.initState();
    _KCart.instance.load();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = _deals.isEmpty;
      _error = null;
    });
    try {
      final results = await Future.wait([
        _KApi.departments(),
        _KApi.products(onlyReduced: true, order: 'discount_percent', limit: 16),
        _KApi.products(order: 'date_created', limit: 16),
        _KApi.products(order: 'total_sales', limit: 24),
      ]);
      final departments = results[0] as List<_KCategory>;
      // Men, Women and Kids first, the rest by size.
      const lead = ['men', 'women', 'kids'];
      departments.sort((a, b) {
        final ai = lead.indexOf(a.slug), bi = lead.indexOf(b.slug);
        return (ai == -1 ? 99 : ai).compareTo(bi == -1 ? 99 : bi);
      });
      final rails = await Future.wait(departments.take(6).map((department) async =>
          _Rail(department, await _KApi.products(categoryId: department.id, order: 'total_sales', limit: 16))));

      if (!mounted) return;
      setState(() {
        _departments = departments;
        _deals = results[1] as List<_KProduct>;
        _newIn = results[2] as List<_KProduct>;
        _best = results[3] as List<_KProduct>;
        _rails = rails;
        _loading = false;
      });
    } catch (e) {
      debugPrint('Kandi home: $e');
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = 'Could not load the shop. Pull down to try again.\n$e';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: _KColors.ground,
      extendBody: true,
      bottomNavigationBar: const _KTabBar(current: 0),
      body: CustomScrollView(
        physics: _kPhysics,
        slivers: [
          _bar(context),
          CupertinoSliverRefreshControl(
            onRefresh: () async {
              await _KApi.categories(refresh: true);
              await _load();
            },
          ),
          if (_departments.isNotEmpty) SliverToBoxAdapter(child: _departmentChips(context)),
          if (_loading)
            SliverList(
              delegate: SliverChildListDelegate(const [
                SizedBox(height: 12),
                _KSkeleton(height: 150),
                _KSkeleton(height: 280),
                _KSkeleton(height: 280),
              ]),
            )
          else if (_error != null)
            SliverFillRemaining(
              hasScrollBody: false,
              child: _KEmpty(icon: Icons.wifi_off_rounded, title: 'No connection', message: _error, action: 'Try again', onAction: _load),
            )
          else ...[
            SliverToBoxAdapter(child: _banner(context)),
            SliverToBoxAdapter(
              child: _KCarousel(
                title: 'Super deals',
                products: _deals,
                background: _KColors.ink,
                titleColor: _KColors.yellow,
                onSeeAll: () => _KNav.openShop(context, sort: 'discount'),
              ),
            ),
            SliverToBoxAdapter(
              child: _KCarousel(
                title: 'New in',
                products: _newIn,
                background: _KColors.yellowSoft,
                titleColor: const Color(0xFF8A5A00),
                onSeeAll: () => _KNav.openShop(context, sort: 'newest'),
              ),
            ),
            for (var i = 0; i < _rails.length; i++)
              SliverToBoxAdapter(
                child: _KCarousel(
                  title: _rails[i].category.name,
                  products: _rails[i].products,
                  background: (_tones[_rails[i].category.slug] ?? _spareTones[i % _spareTones.length])[0],
                  titleColor: (_tones[_rails[i].category.slug] ?? _spareTones[i % _spareTones.length])[1],
                  onSeeAll: () => _KNav.openShop(context, categoryId: _rails[i].category.id),
                ),
              ),
            const SliverToBoxAdapter(
              child: Padding(
                padding: EdgeInsets.fromLTRB(16, 6, 16, 12),
                child: Text('Best sellers',
                    style: TextStyle(fontSize: 22, fontWeight: FontWeight.w900, color: _KColors.ink, letterSpacing: -0.5)),
              ),
            ),
            _KProductGrid(_best),
          ],
          const _KBarSpace(),
        ],
      ),
    );
  }

  /// The pinned glass bar: the name, the search capsule, the cart.
  Widget _bar(BuildContext context) {
    return SliverAppBar(
      pinned: true,
      automaticallyImplyLeading: false,
      backgroundColor: Colors.transparent,
      surfaceTintColor: Colors.transparent,
      elevation: 0,
      scrolledUnderElevation: 0,
      toolbarHeight: 64,
      titleSpacing: 14,
      flexibleSpace: const _KGlassBar(),
      title: Row(
        children: [
          const Text('Kandi',
              style: TextStyle(fontSize: 24, fontWeight: FontWeight.w900, color: _KColors.ink, letterSpacing: -1)),
          Container(
            margin: const EdgeInsets.only(left: 2, top: 2),
            padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
            decoration: BoxDecoration(color: _KColors.yellow, borderRadius: BorderRadius.circular(6)),
            child: const Text('UG', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w900, color: _KColors.ink)),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: _KPress(
              onTap: () => _KNav.openShop(context, query: ''),
              child: Container(
                height: 44,
                padding: const EdgeInsets.symmetric(horizontal: 14),
                decoration: BoxDecoration(
                  color: const Color(0xB3FFFFFF),
                  borderRadius: BorderRadius.circular(999),
                  border: Border.all(color: const Color(0x14000000), width: 0.5),
                ),
                child: const Row(
                  children: [
                    Icon(Icons.search_rounded, color: _KColors.ink, size: 20),
                    SizedBox(width: 8),
                    Expanded(
                      child: Text('Search shoes, bags…',
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(fontSize: 15, color: _KColors.muted, fontWeight: FontWeight.w500)),
                    ),
                  ],
                ),
              ),
            ),
          ),
          const SizedBox(width: 10),
          AnimatedBuilder(
            animation: _KCart.instance,
            builder: (_, __) => _KGlassIcon(
              icon: Icons.shopping_bag_outlined,
              badge: _KCart.instance.count,
              onTap: () => _KNav.tab(context, 2),
            ),
          ),
        ],
      ),
    );
  }

  Widget _departmentChips(BuildContext context) {
    return SizedBox(
      height: 62,
      child: ListView.separated(
        padding: const EdgeInsets.fromLTRB(12, 12, 12, 12),
        physics: const BouncingScrollPhysics(),
        scrollDirection: Axis.horizontal,
        itemCount: _departments.length,
        separatorBuilder: (_, __) => const SizedBox(width: 8),
        itemBuilder: (_, index) {
          final department = _departments[index];
          final tone = _tones[department.slug] ?? _spareTones[index % _spareTones.length];
          return _KPress(
            onTap: () => _KNav.openShop(context, categoryId: department.id),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              alignment: Alignment.center,
              decoration: BoxDecoration(color: tone[0], borderRadius: BorderRadius.circular(999)),
              child: Text(department.name, style: TextStyle(fontSize: 14, fontWeight: FontWeight.w800, color: tone[1])),
            ),
          );
        },
      ),
    );
  }

  Widget _banner(BuildContext context) {
    final deepest = _deals.isEmpty ? 0 : _deals.map((p) => p.discount).reduce((a, b) => a > b ? a : b);
    return _KPress(
      onTap: () => _KNav.openShop(context, sort: 'discount'),
      child: Container(
        margin: const EdgeInsets.fromLTRB(12, 0, 12, 12),
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(color: _KColors.yellow, borderRadius: BorderRadius.circular(24)),
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('BLACK NOVEMBER',
                      style: TextStyle(fontSize: 12, fontWeight: FontWeight.w900, letterSpacing: 1.5, color: _KColors.ink)),
                  const SizedBox(height: 4),
                  Text(deepest > 0 ? 'Up to $deepest% off' : 'Deals of the week',
                      style: const TextStyle(fontSize: 30, height: 1.05, fontWeight: FontWeight.w900, color: _KColors.ink, letterSpacing: -1)),
                  const SizedBox(height: 6),
                  const Text('Earn reward points on every order',
                      style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: _KColors.body)),
                ],
              ),
            ),
            Container(
              width: 48,
              height: 48,
              decoration: const BoxDecoration(color: _KColors.ink, shape: BoxShape.circle),
              child: const Icon(Icons.arrow_forward_rounded, color: _KColors.yellow),
            ),
          ],
        ),
      ),
    );
  }
}

// ============================================================
//  Shared building blocks, private to this file
//  (the same in all four Kandi screens; change one, change all)
// ============================================================

/// The website: delivery quotes, place search and Pesapal.
const String _kSiteUrl = 'https://kandiug.com';

/// Support line shown on Account.
const String _kSupportPhone = '0704892253';

// ------------------------------------------------------------
//  Colours and type
// ------------------------------------------------------------

class _KColors {
  static const ink = Color(0xFF111111);
  static const body = Color(0xFF3A3A3A);
  static const muted = Color(0xFF767676);
  static const line = Color(0xFFE8E8E6);
  static const ground = Color(0xFFF5F5F2);
  static const yellow = Color(0xFFFFCC00);
  static const yellowSoft = Color(0xFFFFF4C2);
  static const sale = Color(0xFFD32F2F);
  static const green = Color(0xFF15803D);
  static const greenSoft = Color(0xFFDFF6E6);
  static const white = Colors.white;

  // Liquid glass tints: clear for floating controls, strong for sheets,
  // bar for the pinned top bars, lens for the chosen tab.
  static const glass = Color(0x8CFFFFFF);
  static const glassStrong = Color(0xD6F8F8F6);
  static const glassBar = Color(0xB8F7F7F5);
  static const lens = Color(0x17000000);
}

/// "UGX 12,000".
String _kMoney(num amount) {
  final whole = amount.round().abs().toString();
  final buffer = StringBuffer();
  for (var i = 0; i < whole.length; i++) {
    if (i > 0 && (whole.length - i) % 3 == 0) buffer.write(',');
    buffer.write(whole[i]);
  }
  return '${amount < 0 ? '−' : ''}UGX $buffer';
}

/// 1234 → "1.2K".
String _kCompact(int value) {
  if (value >= 1000000) return '${(value / 1000000).toStringAsFixed(1)}M';
  if (value >= 1000) return '${(value / 1000).toStringAsFixed(1)}K';
  return '$value';
}

/// Strips HTML from a WooCommerce description for plain display.
String _kPlain(String? html) {
  if (html == null) return '';
  return html
      .replaceAll(RegExp(r'<br\s*/?>', caseSensitive: false), '\n')
      .replaceAll(RegExp(r'</p>', caseSensitive: false), '\n\n')
      .replaceAll(RegExp(r'<li[^>]*>', caseSensitive: false), '• ')
      .replaceAll(RegExp(r'<[^>]+>'), '')
      .replaceAll('&amp;', '&')
      .replaceAll('&nbsp;', ' ')
      .replaceAll(RegExp(r'&#0?39;|&#8217;'), "'")
      .replaceAll(RegExp(r'\n{3,}'), '\n\n')
      .trim();
}

// ------------------------------------------------------------
//  Models
// ------------------------------------------------------------

class _KOption {
  _KOption(this.name, this.value, this.image);
  final String name;
  final String? value; // a colour hex, when the shop set one
  final String? image;
}

class _KAttribute {
  _KAttribute(this.name, this.options);
  final String name;
  final List<_KOption> options;
}

class _KVariation {
  _KVariation({
    required this.id,
    required this.price,
    required this.regularPrice,
    required this.attributes,
    required this.inStock,
    this.image,
  });
  final int id;
  final double price;
  final double regularPrice;
  final Map<String, String> attributes;
  final bool inStock;
  final String? image;
}

class _KProduct {
  _KProduct({
    required this.id,
    required this.name,
    required this.price,
    required this.regularPrice,
    required this.image,
    required this.gallery,
    required this.stockStatus,
    required this.stockQuantity,
    required this.totalSales,
    required this.rating,
    required this.ratingCount,
    required this.categoryIds,
    required this.attributes,
    required this.variations,
    required this.shortDescription,
    required this.description,
  });

  final int id;
  final String name;
  final double price;
  final double regularPrice;
  final String image;
  final List<String> gallery;
  final String stockStatus;
  final int? stockQuantity;
  final int totalSales;
  final double rating;
  final int ratingCount;
  final List<int> categoryIds;
  final List<_KAttribute> attributes;
  final List<_KVariation> variations;
  final String shortDescription;
  final String description;

  bool get soldOut => stockStatus == 'outofstock';
  bool get reduced => regularPrice > price && price > 0;
  int get discount => reduced ? (((regularPrice - price) / regularPrice) * 100).floor() : 0;
  List<String> get photos => [image, ...gallery].where((url) => url.isNotEmpty).toSet().toList();

  static double _num(dynamic value) => value is num ? value.toDouble() : double.tryParse('$value') ?? 0;

  factory _KProduct.fromRow(Map<String, dynamic> row) {
    final attributes = <_KAttribute>[];
    for (final raw in (row['attributes'] is List ? row['attributes'] as List : const [])) {
      if (raw is! Map) continue;
      final options = <_KOption>[];
      for (final option in (raw['options'] is List ? raw['options'] as List : const [])) {
        if (option is Map) {
          options.add(_KOption('${option['name'] ?? ''}', option['value']?.toString(), option['image']?.toString()));
        } else {
          options.add(_KOption('$option', null, null));
        }
      }
      if (options.isNotEmpty) attributes.add(_KAttribute('${raw['name'] ?? ''}', options));
    }

    final variations = <_KVariation>[];
    for (final raw in (row['variations'] is List ? row['variations'] as List : const [])) {
      if (raw is! Map) continue;
      final attrs = <String, String>{};
      final rawAttributes = raw['attributes'];
      if (rawAttributes is Map) rawAttributes.forEach((key, value) => attrs['$key'] = '$value');
      variations.add(_KVariation(
        id: (raw['id'] as num?)?.toInt() ?? 0,
        price: _num(raw['price']),
        regularPrice: _num(raw['regular_price']),
        attributes: attrs,
        inStock: raw['is_in_stock'] != false,
        image: raw['image']?.toString(),
      ));
    }

    return _KProduct(
      id: (row['id'] as num).toInt(),
      name: '${row['name'] ?? ''}',
      price: _num(row['price']),
      regularPrice: _num(row['regular_price']),
      image: '${row['image'] ?? ''}',
      gallery: (row['gallery'] is List ? row['gallery'] as List : const []).map((url) => '$url').toList(),
      stockStatus: '${row['stock_status'] ?? 'instock'}',
      stockQuantity: (row['stock_quantity'] as num?)?.toInt(),
      totalSales: (row['total_sales'] as num?)?.toInt() ?? 0,
      rating: _num(row['average_rating']),
      ratingCount: (row['rating_count'] as num?)?.toInt() ?? 0,
      categoryIds: (row['category_ids'] is List ? row['category_ids'] as List : const []).map((id) => id is num ? id.toInt() : int.tryParse('$id') ?? 0).toList(),
      attributes: attributes,
      variations: variations,
      shortDescription: '${row['short_description'] ?? ''}',
      description: '${row['description'] ?? ''}',
    );
  }
}

class _KCategory {
  _KCategory({required this.id, required this.name, required this.slug, required this.parent, required this.count, this.image});
  final int id;
  final String name;
  final String slug;
  final int parent;
  final int count;
  final String? image;

  factory _KCategory.fromRow(Map<String, dynamic> row) => _KCategory(
        id: (row['id'] as num).toInt(),
        name: '${row['name'] ?? ''}',
        slug: '${row['slug'] ?? ''}',
        parent: (row['parent'] as num?)?.toInt() ?? 0,
        count: (row['count'] as num?)?.toInt() ?? 0,
        image: row['image']?.toString(),
      );
}

// ------------------------------------------------------------
//  Supabase queries
// ------------------------------------------------------------

SupabaseClient get _kSupa => Supabase.instance.client;

/// The columns a product card needs; the product page asks for '*'.
const String _kCardColumns =
    'id,name,price,regular_price,image,stock_status,stock_quantity,total_sales,average_rating,rating_count,category_ids';

class _KApi {
  static List<_KCategory>? _categories;

  /// Every category with products in it (a category with none, or with only
  /// empty children, is left out so the app never shows an empty shelf).
  static Future<List<_KCategory>> categories({bool refresh = false}) async {
    if (_categories != null && !refresh) return _categories!;
    final rows = await _kSupa.from('categories').select().order('count', ascending: false);
    final all = (rows as List).map((row) => _KCategory.fromRow(row as Map<String, dynamic>)).toList();
    bool hasProducts(_KCategory category) =>
        category.count > 0 || all.any((child) => child.parent == category.id && hasProducts(child));
    _categories = all.where(hasProducts).toList();
    return _categories!;
  }

  static Future<List<_KCategory>> departments() async =>
      (await categories()).where((category) => category.parent == 0 && category.slug != 'uncategorized').toList();

  static Future<List<_KCategory>> childrenOf(int id) async =>
      (await categories()).where((category) => category.parent == id).toList();

  /// Products, newest first unless [order] says otherwise.
  static Future<List<_KProduct>> products({
    int? categoryId,
    bool onlyReduced = false,
    String order = 'date_created',
    bool ascending = false,
    String search = '',
    int offset = 0,
    int limit = 20,
    List<int> excludeIds = const [],
  }) async {
    var query = _kSupa.from('products').select(_kCardColumns).neq('stock_status', 'outofstock');
    if (categoryId != null) query = query.contains('category_ids', [categoryId]);
    if (onlyReduced) query = query.gt('discount_percent', 0);
    if (search.trim().isNotEmpty) query = query.ilike('name', '%${search.trim()}%');
    if (excludeIds.isNotEmpty) query = query.not('id', 'in', '(${excludeIds.join(',')})');
    final rows = await query.order(order, ascending: ascending).range(offset, offset + limit - 1);
    return (rows as List).map((row) => _KProduct.fromRow(row as Map<String, dynamic>)).toList();
  }

  static Future<_KProduct?> product(int id) async {
    final row = await _kSupa.from('products').select().eq('id', id).maybeSingle();
    return row == null ? null : _KProduct.fromRow(row);
  }
}

// ------------------------------------------------------------
//  Small hand-offs between screens, kept on the device
//  (so FlutterFlow's own Navigate To actions work too)
// ------------------------------------------------------------

class _KKeys {
  static const shopCategory = 'kandi-shop-category';
  static const shopQuery = 'kandi-shop-query';
  static const shopSort = 'kandi-shop-sort';
  static const cart = 'kandi-cart-v2';
  static const address = 'kandi-address-id';
}

class _KNav {
  /// A product slides up as a tall glass sheet over the current screen.
  static Future<void> openProduct(BuildContext context, int id) =>
      sheet(context, _KProductSheet(id: id), height: 0.94);

  /// The address picker, as a sheet. True when an address was chosen.
  static Future<bool> openAddresses(BuildContext context) async =>
      await sheet<bool>(context, const _KAddressSheet(), height: 0.9) == true;

  /// Anything as a floating liquid-glass sheet. [height] is a share of the
  /// screen; null lets the content decide (sign-in, sort, the address form).
  static Future<T?> sheet<T>(BuildContext context, Widget child, {double? height = 0.9, bool dismissible = true}) {
    return showModalBottomSheet<T>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      isDismissible: dismissible,
      enableDrag: dismissible,
      elevation: 0,
      backgroundColor: Colors.transparent,
      barrierColor: const Color(0x38000000),
      builder: (_) {
        final glass = _KGlassSheet(child: child);
        return height == null ? glass : FractionallySizedBox(heightFactor: height, child: glass);
      },
    );
  }

  /// The cart as a page of its own, above whatever is open (a product, say).
  static Future<void> openCart(BuildContext context) =>
      Navigator.of(context).push(CupertinoPageRoute(builder: (_) => const KandiCartScreen()));

  /// Opens Shop already filtered to a category, a search or a sort.
  static Future<void> openShop(BuildContext context, {int? categoryId, String? query, String? sort}) async {
    final prefs = await SharedPreferences.getInstance();
    if (categoryId != null) await prefs.setInt(_KKeys.shopCategory, categoryId);
    if (query != null) await prefs.setString(_KKeys.shopQuery, query);
    if (sort != null) await prefs.setString(_KKeys.shopSort, sort);
    if (!context.mounted) return;
    await Navigator.of(context).push(CupertinoPageRoute(builder: (_) => const KandiShopScreen()));
  }

  /// The four tabs (Home, Shop, Cart, Account) swap the screen rather than
  /// stacking it, instantly, as iOS tab bars do.
  static void tab(BuildContext context, int index) {
    const screens = <Widget>[
      KandiHomeScreen(),
      KandiShopScreen(),
      KandiCartScreen(),
      KandiAccountScreen(),
    ];
    Navigator.of(context).pushAndRemoveUntil(
      PageRouteBuilder(
        pageBuilder: (_, __, ___) => screens[index],
        transitionDuration: Duration.zero,
        reverseTransitionDuration: Duration.zero,
      ),
      (_) => false,
    );
  }
}

// ------------------------------------------------------------
//  The cart, kept on the device
// ------------------------------------------------------------

class _KCartLine {
  _KCartLine({
    required this.productId,
    required this.variationId,
    required this.name,
    required this.image,
    required this.price,
    required this.quantity,
    required this.options,
  });

  final int productId;
  final int variationId;
  final String name;
  final String image;
  final double price;
  int quantity;
  final Map<String, String> options;

  String get key => '$productId:$variationId:${options.entries.map((e) => '${e.key}=${e.value}').join('|')}';
  String get optionText => options.entries.map((e) => '${e.key}: ${e.value}').join(' · ');

  Map<String, dynamic> toJson() => {
        'product_id': productId,
        'variation_id': variationId,
        'name': name,
        'image': image,
        'price': price,
        'quantity': quantity,
        'options': options,
      };

  factory _KCartLine.fromJson(Map<String, dynamic> json) => _KCartLine(
        productId: (json['product_id'] as num).toInt(),
        variationId: (json['variation_id'] as num?)?.toInt() ?? 0,
        name: '${json['name'] ?? ''}',
        image: '${json['image'] ?? ''}',
        price: (json['price'] as num?)?.toDouble() ?? 0,
        quantity: (json['quantity'] as num?)?.toInt() ?? 1,
        options: (json['options'] is Map ? json['options'] as Map : const {}).map((k, v) => MapEntry('$k', '$v')),
      );
}

class _KCart extends ChangeNotifier {
  _KCart._();
  static final _KCart instance = _KCart._();

  final List<_KCartLine> lines = [];

  int get count => lines.fold(0, (sum, line) => sum + line.quantity);
  double get subtotal => lines.fold(0.0, (sum, line) => sum + line.price * line.quantity);

  /// Re-reads the basket from the device. Every screen keeps its own copy of
  /// this class, so the device is the one place the basket really lives, and
  /// each screen reads it fresh before showing or changing it.
  Future<void> load() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_KKeys.cart);
    if (raw != null) {
      try {
        lines
          ..clear()
          ..addAll((jsonDecode(raw) as List).map((e) => _KCartLine.fromJson(e as Map<String, dynamic>)));
      } catch (_) {}
    }
    notifyListeners();
  }

  Future<void> _save() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_KKeys.cart, jsonEncode(lines.map((line) => line.toJson()).toList()));
    notifyListeners();
  }

  Future<void> add(_KCartLine line) async {
    await load();
    final existing = lines.where((l) => l.key == line.key).toList();
    if (existing.isNotEmpty) {
      existing.first.quantity = (existing.first.quantity + line.quantity).clamp(1, 20).toInt();
    } else {
      lines.add(line);
    }
    await _save();
  }

  Future<void> setQuantity(_KCartLine line, int quantity) async {
    if (quantity <= 0) {
      lines.remove(line);
    } else {
      line.quantity = quantity.clamp(1, 20).toInt();
    }
    await _save();
  }

  Future<void> remove(_KCartLine line) async {
    lines.remove(line);
    await _save();
  }

  Future<void> clear() async {
    lines.clear();
    await _save();
  }
}

// ------------------------------------------------------------
//  Sign-in (Google, through Supabase) and the shop's own API
//  (WordPress / WooCommerce: account, addresses, orders, points)
// ------------------------------------------------------------

/// The Kandi Mobile API on WordPress (wordpress/kandi-mobile-api.php).
const String _kWooApi = 'https://shop.kandiug.com/wp-json/kandi/v1/mobile';

class _KAuth {
  static User? get user => _kSupa.auth.currentUser;
  static bool get signedIn => user != null;

  /// The shopper's Supabase access token, sent to WordPress with every call.
  static String get token => _kSupa.auth.currentSession?.accessToken ?? '';

  /// Shown in the app: the Google name, or the email.
  static String get name {
    final meta = user?.userMetadata ?? const {};
    final full = '${meta['full_name'] ?? meta['name'] ?? ''}'.trim();
    return full.isNotEmpty ? full : (user?.email ?? '');
  }

  static String get email => user?.email ?? '';
  static String get photo => '${user?.userMetadata?['avatar_url'] ?? user?.userMetadata?['picture'] ?? ''}';

  /// Signed in already, or signs in now through the sheet. True when signed in.
  static Future<bool> ensure(BuildContext context, {String reason = 'Sign in to continue'}) async {
    if (signedIn) return true;
    final ok = await _KNav.sheet<bool>(context, _KSignInSheet(reason: reason), height: null);
    return ok == true && signedIn;
  }

  static Future<void> signOut() => _kSupa.auth.signOut();

  /// Where Supabase sends the shopper back after Google. The web app comes back
  /// to its own address; the phone app to its deep link. Both must be listed in
  /// Supabase > Authentication > URL Configuration > Redirect URLs.
  static const String appRedirect = 'kandiug://kandiug.com/auth-callback';

  /// Google through Supabase. On the web the page leaves for Google and comes
  /// back signed in; in the app this waits for the browser to hand back.
  static Future<void> signInWithGoogle() async {
    final waiting = kIsWeb
        ? null
        : _kSupa.auth.onAuthStateChange
            .firstWhere((s) => s.event == AuthChangeEvent.signedIn)
            .timeout(const Duration(minutes: 3));
    await _kSupa.auth.signInWithOAuth(
      OAuthProvider.google,
      redirectTo: kIsWeb ? Uri.base.origin : appRedirect,
    );
    if (waiting != null) {
      try {
        await waiting;
      } on TimeoutException {
        // Still signed out; the sheet says it was cancelled.
      }
    }
  }

  /// "0772 123 456" / "772123456" / "+256772123456" → "+256772123456", or null.
  static String? ugPhone(String raw) {
    var digits = raw.replaceAll(RegExp(r'\D'), '');
    if (digits.startsWith('256')) digits = digits.substring(3);
    if (digits.startsWith('0')) digits = digits.substring(1);
    return RegExp(r'^7\d{8}$').hasMatch(digits) ? '+256$digits' : null;
  }
}

/// One bottom sheet, one button: Continue with Google.
class _KSignInSheet extends StatefulWidget {
  const _KSignInSheet({super.key, this.reason = 'Sign in to continue'});
  final String reason;
  @override
  State<_KSignInSheet> createState() => _KSignInSheetState();
}

class _KSignInSheetState extends State<_KSignInSheet> {
  bool _busy = false;
  String? _error;

  Future<void> _google() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await _KAuth.signInWithGoogle();
      if (!mounted) return;
      if (_KAuth.signedIn) {
        Navigator.of(context).pop(true);
      } else {
        setState(() => _error = 'Sign-in was cancelled.');
      }
    } catch (e) {
      if (mounted) setState(() => _error = 'Could not sign in with Google. $e');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 30, 20, 16),
      child: SafeArea(
        top: false,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(widget.reason,
                style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w900, color: _KColors.ink, letterSpacing: -0.5)),
            const SizedBox(height: 6),
            const Text('Use your Google account. No password to remember.',
                style: TextStyle(fontSize: 14, color: _KColors.muted)),
            if (_error != null) ...[
              const SizedBox(height: 12),
              Text(_error!, style: const TextStyle(color: _KColors.sale, fontSize: 13, fontWeight: FontWeight.w600)),
            ],
            const SizedBox(height: 20),
            _KButton(label: 'Continue with Google', icon: Icons.g_mobiledata_rounded, dark: true, busy: _busy, onPressed: _google),
          ],
        ),
      ),
    );
  }
}

/// Calls to the Kandi Mobile API. Every call carries the shopper's sign-in.
/// Errors come back as an exception whose message can be shown as it is.
class _KWoo {
  static Map<String, String> get _headers => {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-Kandi-Token': _KAuth.token,
      };

  static dynamic _read(http.Response response) {
    dynamic data;
    try {
      data = jsonDecode(response.body);
    } catch (_) {
      data = null;
    }
    if (response.statusCode >= 200 && response.statusCode < 300) return data;
    final message = data is Map && data['message'] != null ? '${data['message']}' : 'Something went wrong (${response.statusCode}).';
    throw Exception(message);
  }

  static Future<dynamic> get(String path) async =>
      _read(await http.get(Uri.parse('$_kWooApi$path'), headers: _headers).timeout(const Duration(seconds: 30)));

  static Future<dynamic> post(String path, Map<String, dynamic> body) async => _read(await http
      .post(Uri.parse('$_kWooApi$path'), headers: _headers, body: jsonEncode(body))
      .timeout(const Duration(seconds: 45)));

  static Future<dynamic> delete(String path) async =>
      _read(await http.delete(Uri.parse('$_kWooApi$path'), headers: _headers).timeout(const Duration(seconds: 30)));

  /// "Exception: Choose a delivery address." → "Choose a delivery address."
  static String message(Object error) => '$error'.replaceFirst('Exception: ', '');
}

// ------------------------------------------------------------
//  Building blocks
// ------------------------------------------------------------

/// The app's capsule button: yellow, black, or outlined. Squeezes when pressed.
class _KButton extends StatelessWidget {
  const _KButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.busy = false,
    this.dark = false,
    this.outline = false,
    this.icon,
  });

  final String label;
  final VoidCallback? onPressed;
  final bool busy;
  final bool dark;
  final bool outline;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    final background = outline ? Colors.transparent : (dark ? _KColors.ink : _KColors.yellow);
    final foreground = dark && !outline ? _KColors.white : _KColors.ink;
    return _KPress(
      onTap: busy ? null : onPressed,
      child: AnimatedOpacity(
        duration: const Duration(milliseconds: 160),
        opacity: onPressed == null && !busy ? 0.45 : 1,
        child: Container(
          width: double.infinity,
          height: 52,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: background,
            borderRadius: BorderRadius.circular(999),
            border: outline ? Border.all(color: _KColors.ink, width: 1.5) : null,
            boxShadow: outline || onPressed == null
                ? null
                : [BoxShadow(color: background.withAlpha(dark ? 60 : 90), blurRadius: 18, offset: const Offset(0, 6))],
          ),
          child: busy
              ? CupertinoActivityIndicator(color: foreground)
              : Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    if (icon != null) ...[Icon(icon, size: 20, color: foreground), const SizedBox(width: 8)],
                    Flexible(
                      child: Text(label,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: foreground)),
                    ),
                  ],
                ),
        ),
      ),
    );
  }
}

class _KField extends StatelessWidget {
  const _KField({
    super.key,
    required this.controller,
    required this.label,
    this.hint,
    this.keyboard,
    this.prefix,
    this.maxLines = 1,
    this.onChanged,
  });

  final TextEditingController controller;
  final String label;
  final String? hint;
  final TextInputType? keyboard;
  final String? prefix;
  final int maxLines;
  final ValueChanged<String>? onChanged;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: _KColors.ink)),
        const SizedBox(height: 6),
        TextField(
          controller: controller,
          keyboardType: keyboard,
          maxLines: maxLines,
          onChanged: onChanged,
          style: const TextStyle(fontSize: 16, color: _KColors.ink),
          decoration: InputDecoration(
            hintText: hint,
            prefixText: prefix,
            filled: true,
            fillColor: _KColors.white,
            contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: BorderSide.none),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(14),
              borderSide: const BorderSide(color: _KColors.ink, width: 1.5),
            ),
          ),
        ),
      ],
    );
  }
}

/// A product photo on the shop's grey, with white backgrounds blended in.
class _KPhoto extends StatelessWidget {
  const _KPhoto(this.url, {super.key, this.fit = BoxFit.cover, this.radius = 0});
  final String url;
  final BoxFit fit;
  final double radius;

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(radius),
      child: Container(
        color: _KColors.ground,
        child: url.isEmpty
            ? const Center(child: Icon(Icons.image_outlined, color: _KColors.muted))
            : CachedNetworkImage(
                imageUrl: url,
                fit: fit,
                width: double.infinity,
                height: double.infinity,
                color: _KColors.ground,
                colorBlendMode: BlendMode.multiply,
                fadeInDuration: const Duration(milliseconds: 150),
                errorWidget: (_, __, ___) => const Center(child: Icon(Icons.image_not_supported_outlined, color: _KColors.muted)),
              ),
      ),
    );
  }
}

/// The product tile used everywhere: photo, discount, name, price, sold.
class _KProductCard extends StatelessWidget {
  const _KProductCard(this.product, {super.key, this.width});
  final _KProduct product;
  final double? width;

  @override
  Widget build(BuildContext context) {
    return _KPress(
      onTap: () => _KNav.openProduct(context, product.id),
      child: Container(
        width: width,
        decoration: BoxDecoration(color: _KColors.white, borderRadius: BorderRadius.circular(14)),
        clipBehavior: Clip.antiAlias,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            AspectRatio(
              aspectRatio: 1,
              child: Stack(
                fit: StackFit.expand,
                children: [
                  _KPhoto(product.image),
                  if (product.discount > 0)
                    Positioned(
                      top: 0,
                      left: 0,
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                        decoration: const BoxDecoration(
                          color: _KColors.yellow,
                          borderRadius: BorderRadius.only(bottomRight: Radius.circular(10)),
                        ),
                        child: Text('-${product.discount}%',
                            style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w900, color: _KColors.ink)),
                      ),
                    ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(10, 8, 10, 10),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(product.name,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: _KColors.body)),
                  const SizedBox(height: 3),
                  Text(_kMoney(product.price),
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w900,
                        color: product.reduced ? _KColors.sale : _KColors.ink,
                      )),
                  Row(
                    children: [
                      if (product.reduced)
                        Flexible(
                          child: Text(_kMoney(product.regularPrice),
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(
                                  fontSize: 11, color: _KColors.muted, decoration: TextDecoration.lineThrough)),
                        ),
                      if (product.reduced && product.totalSales > 0) const SizedBox(width: 6),
                      if (product.totalSales > 0)
                        Text('${_kCompact(product.totalSales)} sold',
                            style: const TextStyle(fontSize: 11, color: _KColors.muted)),
                    ],
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

/// A titled, swipeable row of product cards, optionally on a colour.
class _KCarousel extends StatelessWidget {
  const _KCarousel({
    super.key,
    required this.title,
    required this.products,
    this.onSeeAll,
    this.background = _KColors.white,
    this.titleColor = _KColors.ink,
  });

  final String title;
  final List<_KProduct> products;
  final VoidCallback? onSeeAll;
  final Color background;
  final Color titleColor;

  @override
  Widget build(BuildContext context) {
    if (products.length < 3) return const SizedBox.shrink();
    return Container(
      margin: const EdgeInsets.fromLTRB(12, 0, 12, 12),
      padding: const EdgeInsets.fromLTRB(0, 14, 0, 14),
      decoration: BoxDecoration(color: background, borderRadius: BorderRadius.circular(20)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 14),
            child: Row(
              children: [
                Expanded(
                  child: Text(title,
                      style: TextStyle(fontSize: 22, fontWeight: FontWeight.w900, color: titleColor, letterSpacing: -0.5)),
                ),
                if (onSeeAll != null)
                  GestureDetector(
                    onTap: onSeeAll,
                    child: Text('See all ›', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: titleColor)),
                  ),
              ],
            ),
          ),
          const SizedBox(height: 12),
          SizedBox(
            height: 248,
            child: ListView.separated(
              padding: const EdgeInsets.symmetric(horizontal: 14),
              physics: const BouncingScrollPhysics(),
              scrollDirection: Axis.horizontal,
              itemCount: products.length,
              separatorBuilder: (_, __) => const SizedBox(width: 10),
              itemBuilder: (_, index) => _KProductCard(products[index], width: 158),
            ),
          ),
        ],
      ),
    );
  }
}

/// A two-column grid of product cards as a sliver.
class _KProductGrid extends StatelessWidget {
  const _KProductGrid(this.products, {super.key});
  final List<_KProduct> products;

  @override
  Widget build(BuildContext context) {
    return SliverPadding(
      padding: const EdgeInsets.symmetric(horizontal: 12),
      sliver: SliverGrid(
        gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
          crossAxisCount: 2,
          mainAxisSpacing: 10,
          crossAxisSpacing: 10,
          childAspectRatio: 0.66,
        ),
        delegate: SliverChildBuilderDelegate(
          (_, index) => _KProductCard(products[index]),
          childCount: products.length,
        ),
      ),
    );
  }
}

// ------------------------------------------------------------
//  Liquid glass and the iOS feel
//  Apple's glass material made from Flutter's own blur and colour
//  filters, so it needs no package and works on iOS, Android and
//  the web: a saturated frost, a bright rim where light catches
//  the edge, a sheen along the top. Plus spring motion, squeeze-
//  on-press and haptic ticks.
// ------------------------------------------------------------

/// iOS scrolling: rubber-band at the ends, always scrollable (so the
/// pull-to-refresh works even on a short page).
const ScrollPhysics _kPhysics = BouncingScrollPhysics(parent: AlwaysScrollableScrollPhysics());

/// A quick spring with a little overshoot, like UIKit's default.
const Curve _kSpring = Cubic(0.34, 1.36, 0.64, 1);

/// A light tick for taps and selections; [firm] for "added", "placed".
void _kHaptic([bool firm = false]) {
  if (firm) {
    HapticFeedback.mediumImpact();
  } else {
    HapticFeedback.selectionClick();
  }
}

/// Blur plus extra colour: what makes it glass rather than frosted plastic.
/// (The web gets the blur alone, which every browser renders the same.)
ui.ImageFilter _kGlassFilter(double blur) {
  final frost = ui.ImageFilter.blur(sigmaX: blur, sigmaY: blur);
  if (kIsWeb) return frost;
  const s = 1.6; // saturation
  const r = 0.2126 * (1 - s), g = 0.7152 * (1 - s), b = 0.0722 * (1 - s);
  return ui.ImageFilter.compose(
    outer: const ColorFilter.matrix(<double>[
      r + s, g, b, 0, 0, //
      r, g + s, b, 0, 0, //
      r, g, b + s, 0, 0, //
      0, 0, 0, 1, 0, //
    ]),
    inner: frost,
  );
}

/// A pane of liquid glass of any shape: what is behind it shows through,
/// blurred and brightened; [child] sits on top, sharp.
class _KGlass extends StatelessWidget {
  const _KGlass({
    super.key,
    required this.child,
    this.radius = 999,
    this.blur = 18,
    this.tint = _KColors.glass,
    this.padding = EdgeInsets.zero,
    this.shadow = true,
  });

  final Widget child;
  final double radius;
  final double blur;
  final Color tint;
  final EdgeInsetsGeometry padding;
  final bool shadow;

  @override
  Widget build(BuildContext context) {
    final shape = BorderRadius.circular(radius);
    return DecoratedBox(
      decoration: BoxDecoration(
        borderRadius: shape,
        boxShadow: shadow
            ? const [
                BoxShadow(color: Color(0x1A000000), blurRadius: 28, offset: Offset(0, 10)),
                BoxShadow(color: Color(0x0D000000), blurRadius: 3, offset: Offset(0, 1)),
              ]
            : null,
      ),
      child: ClipRRect(
        borderRadius: shape,
        child: BackdropFilter(
          filter: _kGlassFilter(blur),
          child: CustomPaint(
            foregroundPainter: _KRimPainter(radius),
            child: DecoratedBox(
              decoration: BoxDecoration(
                borderRadius: shape,
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [Color.alphaBlend(const Color(0x2EFFFFFF), tint), tint],
                ),
              ),
              child: Padding(padding: padding, child: child),
            ),
          ),
        ),
      ),
    );
  }
}

/// The glass edge: a hairline for definition on white, a bright rim where
/// the light lands (top left) that fades and catches again bottom right,
/// and a soft sheen just inside the top.
class _KRimPainter extends CustomPainter {
  const _KRimPainter(this.radius);
  final double radius;

  @override
  void paint(Canvas canvas, Size size) {
    final rect = Offset.zero & size;
    final corner = Radius.circular(math.min(radius, size.shortestSide / 2));
    final edge = RRect.fromRectAndRadius(rect.deflate(0.5), corner);

    canvas.drawRRect(
      edge,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 0.5
        ..color = const Color(0x1F000000),
    );
    canvas.drawRRect(
      RRect.fromRectAndRadius(rect.deflate(1), corner),
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1.2
        ..shader = const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(0xF2FFFFFF), Color(0x40FFFFFF), Color(0x12FFFFFF), Color(0x99FFFFFF)],
          stops: [0, 0.3, 0.7, 1],
        ).createShader(rect),
    );
    canvas.drawRRect(
      RRect.fromRectAndRadius(rect, corner),
      Paint()
        ..shader = const LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment(0, -0.2),
          colors: [Color(0x38FFFFFF), Color(0x00FFFFFF)],
        ).createShader(rect),
    );
  }

  @override
  bool shouldRepaint(_KRimPainter oldDelegate) => oldDelegate.radius != radius;
}

/// Presses like iOS: a quick squeeze, a springy release, a light tick.
class _KPress extends StatefulWidget {
  const _KPress({super.key, required this.child, this.onTap, this.scale = 0.96});
  final Widget child;
  final VoidCallback? onTap;
  final double scale;

  @override
  State<_KPress> createState() => _KPressState();
}

class _KPressState extends State<_KPress> {
  bool _down = false;

  void _set(bool down) {
    if (widget.onTap != null && _down != down) setState(() => _down = down);
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTapDown: (_) => _set(true),
      onTapUp: (_) => _set(false),
      onTapCancel: () => _set(false),
      onTap: widget.onTap == null
          ? null
          : () {
              _kHaptic();
              widget.onTap!();
            },
      child: AnimatedScale(
        scale: _down ? widget.scale : 1,
        duration: Duration(milliseconds: _down ? 90 : 420),
        curve: _down ? Curves.easeOut : _kSpring,
        child: widget.child,
      ),
    );
  }
}

/// A round glass button (close, cart) that floats over photos and bars.
class _KGlassIcon extends StatelessWidget {
  const _KGlassIcon({super.key, required this.icon, required this.onTap, this.badge = 0, this.size = 44});
  final IconData icon;
  final VoidCallback onTap;
  final int badge;
  final double size;

  @override
  Widget build(BuildContext context) {
    return _KPress(
      onTap: onTap,
      scale: 0.88,
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          _KGlass(
            child: SizedBox(
              width: size,
              height: size,
              child: Icon(icon, color: _KColors.ink, size: size * 0.5),
            ),
          ),
          if (badge > 0)
            Positioned(
              top: -3,
              right: -3,
              child: Container(
                constraints: const BoxConstraints(minWidth: 20),
                height: 20,
                padding: const EdgeInsets.symmetric(horizontal: 5),
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: _KColors.sale,
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: _KColors.white, width: 1.5),
                ),
                child: Text('$badge',
                    style: const TextStyle(color: _KColors.white, fontSize: 11, fontWeight: FontWeight.w900)),
              ),
            ),
        ],
      ),
    );
  }
}

/// A sheet made of glass: inset from the screen's edges, deep corners,
/// a grabber on top. Everything the app slides up goes through this
/// (see [_KNav.sheet]).
class _KGlassSheet extends StatelessWidget {
  const _KGlassSheet({required this.child});
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(6, 0, 6, 6),
      child: _KGlass(
        radius: 34,
        blur: 30,
        tint: _KColors.glassStrong,
        child: Stack(
          fit: StackFit.passthrough,
          children: [
            child,
            Positioned(
              top: 7,
              left: 0,
              right: 0,
              child: IgnorePointer(
                child: Center(
                  child: Container(
                    width: 38,
                    height: 5,
                    decoration: BoxDecoration(color: const Color(0x33000000), borderRadius: BorderRadius.circular(3)),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// The title row at the top of a sheet, with a glass close button.
PreferredSizeWidget _kSheetBar(BuildContext context, String title) => AppBar(
      backgroundColor: Colors.transparent,
      surfaceTintColor: Colors.transparent,
      foregroundColor: _KColors.ink,
      elevation: 0,
      scrolledUnderElevation: 0,
      automaticallyImplyLeading: false,
      toolbarHeight: 70,
      titleSpacing: 20,
      title: Padding(
        padding: const EdgeInsets.only(top: 10),
        child: Text(title,
            style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 24, color: _KColors.ink, letterSpacing: -0.5)),
      ),
      actions: [
        Padding(
          padding: const EdgeInsets.only(right: 14, top: 10),
          child: _KGlassIcon(icon: Icons.close_rounded, size: 38, onTap: () => Navigator.of(context).maybePop()),
        ),
      ],
    );

/// The pinned top bar's background: glass the page scrolls under.
class _KGlassBar extends StatelessWidget {
  const _KGlassBar({super.key});

  @override
  Widget build(BuildContext context) {
    return ClipRect(
      child: BackdropFilter(
        filter: _kGlassFilter(22),
        child: Container(
          decoration: const BoxDecoration(
            color: _KColors.glassBar,
            border: Border(bottom: BorderSide(color: Color(0x14000000), width: 0.5)),
          ),
        ),
      ),
    );
  }
}

/// Room at the end of a scrolling page for whatever floats over its
/// bottom (the tab bar, the cart total), so the last row can be reached.
class _KBarSpace extends StatelessWidget {
  const _KBarSpace({super.key});

  @override
  Widget build(BuildContext context) =>
      SliverToBoxAdapter(child: SizedBox(height: MediaQuery.paddingOf(context).bottom + 20));
}

/// The floating glass tab bar: Home, Shop, Cart, Account. A lens slides
/// to the chosen tab on a spring, like iOS 26. Cart shows its count.
/// Use it with `Scaffold(extendBody: true)` so pages scroll under it.
class _KTabBar extends StatelessWidget {
  const _KTabBar({super.key, required this.current});
  final int current;

  /// The tab shown before this screen, so the lens slides from there.
  static int _from = 0;

  @override
  Widget build(BuildContext context) {
    const items = [
      (Icons.home_outlined, Icons.home_rounded, 'Home'),
      (Icons.grid_view_outlined, Icons.grid_view_rounded, 'Shop'),
      (Icons.shopping_bag_outlined, Icons.shopping_bag_rounded, 'Cart'),
      (Icons.person_outline_rounded, Icons.person_rounded, 'Account'),
    ];
    final from = _from;
    _from = current;
    return SafeArea(
      top: false,
      minimum: const EdgeInsets.only(bottom: 10),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 18),
        child: _KGlass(
          padding: const EdgeInsets.all(5),
          child: SizedBox(
            height: 56,
            child: AnimatedBuilder(
              animation: _KCart.instance,
              builder: (context, _) => Stack(
                children: [
                  TweenAnimationBuilder<double>(
                    tween: Tween(begin: from.toDouble(), end: current.toDouble()),
                    duration: const Duration(milliseconds: 520),
                    curve: _kSpring,
                    builder: (_, at, __) => Align(
                      alignment: Alignment(-1 + 2 * at / (items.length - 1), 0),
                      child: FractionallySizedBox(
                        widthFactor: 1 / items.length,
                        heightFactor: 1,
                        child: Container(
                          decoration: BoxDecoration(color: _KColors.lens, borderRadius: BorderRadius.circular(999)),
                        ),
                      ),
                    ),
                  ),
                  Row(
                    children: [
                      for (var i = 0; i < items.length; i++)
                        Expanded(
                          child: _KPress(
                            scale: 0.88,
                            onTap: i == current ? null : () => _KNav.tab(context, i),
                            child: Column(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Badge(
                                  isLabelVisible: i == 2 && _KCart.instance.count > 0,
                                  label: Text('${_KCart.instance.count}'),
                                  backgroundColor: _KColors.sale,
                                  child: Icon(i == current ? items[i].$2 : items[i].$1,
                                      color: i == current ? _KColors.ink : _KColors.body, size: 25),
                                ),
                                const SizedBox(height: 2),
                                Text(items[i].$3,
                                    style: TextStyle(
                                      fontSize: 11,
                                      fontWeight: i == current ? FontWeight.w800 : FontWeight.w600,
                                      color: i == current ? _KColors.ink : _KColors.body,
                                    )),
                              ],
                            ),
                          ),
                        ),
                    ],
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// A grey placeholder block while data loads.
class _KSkeleton extends StatelessWidget {
  const _KSkeleton({super.key, this.height = 120, this.radius = 16});
  final double height;
  final double radius;
  @override
  Widget build(BuildContext context) => Container(
        height: height,
        margin: const EdgeInsets.fromLTRB(12, 0, 12, 12),
        decoration: BoxDecoration(color: _KColors.line, borderRadius: BorderRadius.circular(radius)),
      );
}

/// A centred message with an optional action, for empty and error states.
class _KEmpty extends StatelessWidget {
  const _KEmpty({super.key, required this.icon, required this.title, this.message, this.action, this.onAction});
  final IconData icon;
  final String title;
  final String? message;
  final String? action;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(32),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 72,
            height: 72,
            decoration: const BoxDecoration(color: _KColors.yellowSoft, shape: BoxShape.circle),
            child: Icon(icon, size: 34, color: _KColors.ink),
          ),
          const SizedBox(height: 16),
          Text(title,
              textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w900, color: _KColors.ink)),
          if (message != null) ...[
            const SizedBox(height: 6),
            Text(message!, textAlign: TextAlign.center, style: const TextStyle(fontSize: 14, color: _KColors.muted)),
          ],
          if (action != null) ...[
            const SizedBox(height: 18),
            SizedBox(width: 220, child: _KButton(label: action!, onPressed: onAction)),
          ],
        ],
      ),
    );
  }
}

/// A short message in a dark glass capsule that drops in at the top of the
/// screen, above any open sheet, and leaves on its own.
OverlayEntry? _kToastEntry;

void _kToast(BuildContext context, String message) {
  final overlay = Overlay.maybeOf(context, rootOverlay: true);
  if (overlay == null) return;
  _kToastEntry?.remove();
  late final OverlayEntry entry;
  entry = OverlayEntry(
    builder: (_) => _KToast(
      message: message,
      onDone: () {
        if (_kToastEntry == entry) {
          entry.remove();
          _kToastEntry = null;
        }
      },
    ),
  );
  _kToastEntry = entry;
  overlay.insert(entry);
}

class _KToast extends StatefulWidget {
  const _KToast({required this.message, required this.onDone});
  final String message;
  final VoidCallback onDone;

  @override
  State<_KToast> createState() => _KToastState();
}

class _KToastState extends State<_KToast> {
  bool _shown = false;
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) setState(() => _shown = true);
    });
    _timer = Timer(const Duration(milliseconds: 2400), () {
      if (!mounted) return;
      setState(() => _shown = false);
      _timer = Timer(const Duration(milliseconds: 300), widget.onDone);
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Positioned(
      top: MediaQuery.paddingOf(context).top + 8,
      left: 16,
      right: 16,
      child: IgnorePointer(
        child: Material(
          type: MaterialType.transparency,
          child: AnimatedSlide(
            offset: _shown ? Offset.zero : const Offset(0, -1.6),
            duration: const Duration(milliseconds: 420),
            curve: _shown ? _kSpring : Curves.easeIn,
            child: AnimatedOpacity(
              opacity: _shown ? 1 : 0,
              duration: const Duration(milliseconds: 220),
              child: Center(
                child: _KGlass(
                  tint: const Color(0xD9161616),
                  padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 12),
                  child: Text(widget.message,
                      textAlign: TextAlign.center,
                      style: const TextStyle(color: _KColors.white, fontSize: 14, fontWeight: FontWeight.w700)),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

// ------------------------------------------------------------
//  The two bottom sheets: a product, and the delivery addresses
// ------------------------------------------------------------

String _kNorm(String value) => value.toLowerCase().replaceAll(RegExp(r'[^a-z0-9]'), '');

/// A product: photos, price, sizes and colours (matched to the real
/// WooCommerce variation), add to cart, and more like it.
class _KProductSheet extends StatefulWidget {
  const _KProductSheet({super.key, required this.id});
  final int id;

  @override
  State<_KProductSheet> createState() => _KProductSheetState();
}

class _KProductSheetState extends State<_KProductSheet> {
  _KProduct? _product;
  List<_KProduct> _related = [];
  bool _loading = true;
  final Map<String, String> _picked = {};
  int _quantity = 1;
  int _photo = 0;
  final _pages = PageController();
  bool _adding = false;

  @override
  void initState() {
    super.initState();
    _KCart.instance.load(); // the bottom bar and cart badge read it
    _load();
  }

  @override
  void dispose() {
    _pages.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    final id = widget.id;
    try {
      final product = await _KApi.product(id);
      if (!mounted) return;
      setState(() {
        _product = product;
        _loading = false;
      });
      if (product != null && product.categoryIds.isNotEmpty) {
        final related = await _KApi.products(
          categoryId: product.categoryIds.last,
          excludeIds: [product.id],
          order: 'total_sales',
          limit: 12,
        );
        if (mounted) setState(() => _related = related);
      }
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  /// The attributes a shopper has to choose (the ones variations depend on).
  List<_KAttribute> get _choices {
    final product = _product!;
    if (product.variations.isEmpty) return const [];
    final keys = product.variations.expand((v) => v.attributes.keys).map(_kNorm).toSet();
    return product.attributes.where((a) => keys.contains(_kNorm(a.name))).toList();
  }

  bool _matches(_KVariation variation, Map<String, String> picked) {
    for (final entry in variation.attributes.entries) {
      final chosen = picked.entries.where((p) => _kNorm(p.key) == _kNorm(entry.key)).toList();
      if (chosen.isEmpty || _kNorm(chosen.first.value) != _kNorm(entry.value)) return false;
    }
    return true;
  }

  _KVariation? get _variation {
    final product = _product!;
    if (product.variations.isEmpty || _picked.length < _choices.length) return null;
    for (final variation in product.variations) {
      if (_matches(variation, _picked)) return variation;
    }
    return null;
  }

  /// False when no in-stock variation has this option alongside the others chosen.
  bool _available(_KAttribute attribute, _KOption option) {
    final product = _product!;
    if (product.variations.isEmpty) return true;
    final trial = Map<String, String>.from(_picked)..[attribute.name] = option.name;
    return product.variations.any((variation) {
      if (!variation.inStock) return false;
      for (final entry in variation.attributes.entries) {
        final chosen = trial.entries.where((p) => _kNorm(p.key) == _kNorm(entry.key)).toList();
        if (chosen.isNotEmpty && _kNorm(chosen.first.value) != _kNorm(entry.value)) return false;
      }
      return true;
    });
  }

  Future<void> _add({bool thenCart = false}) async {
    final product = _product!;
    final missing = _choices.where((a) => !_picked.containsKey(a.name)).toList();
    if (missing.isNotEmpty) {
      _kToast(context, 'Choose a ${missing.first.name.toLowerCase()} first');
      return;
    }
    final variation = _variation;
    if (product.variations.isNotEmpty && (variation == null || !variation.inStock)) {
      _kToast(context, 'That combination is sold out');
      return;
    }
    setState(() => _adding = true);
    await _KCart.instance.add(_KCartLine(
      productId: product.id,
      variationId: variation?.id ?? 0,
      name: product.name,
      image: (variation?.image?.isNotEmpty ?? false) ? variation!.image! : product.image,
      price: variation?.price ?? product.price,
      quantity: _quantity,
      options: Map.of(_picked),
    ));
    if (!mounted) return;
    setState(() => _adding = false);
    if (thenCart) {
      _KNav.openCart(context);
    } else {
      _kHaptic(true);
      _kToast(context, 'Added to your cart');
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Center(child: CupertinoActivityIndicator(radius: 14));
    }
    final product = _product;
    if (product == null) {
      return Center(
        child: _KEmpty(
          icon: Icons.search_off_rounded,
          title: 'This product is gone',
          message: 'It may have sold out or been removed.',
          action: 'Back to shopping',
          onAction: () => Navigator.of(context).pop(),
        ),
      );
    }

    final variation = _variation;
    final price = variation?.price ?? product.price;
    final regular = (variation?.regularPrice ?? 0) > 0 ? variation!.regularPrice : product.regularPrice;
    final reduced = regular > price;
    final soldOut = product.soldOut || (variation != null && !variation.inStock);
    final photos = [
      if (variation?.image?.isNotEmpty ?? false) variation!.image!,
      ...product.photos,
    ].toSet().toList();
    final bottom = MediaQuery.paddingOf(context).bottom;

    return Stack(
      children: [
        CustomScrollView(
          physics: _kPhysics,
          slivers: [
            // The photos run edge to edge, under the glass buttons.
            SliverToBoxAdapter(
              child: AspectRatio(
                aspectRatio: 1,
                child: Stack(
                  children: [
                    PageView.builder(
                      controller: _pages,
                      itemCount: photos.isEmpty ? 1 : photos.length,
                      onPageChanged: (index) => setState(() => _photo = index),
                      itemBuilder: (_, index) => _KPhoto(photos.isEmpty ? '' : photos[index], fit: BoxFit.contain),
                    ),
                    if (photos.length > 1)
                      Positioned(
                        bottom: 14,
                        left: 0,
                        right: 0,
                        child: Center(
                          child: _KGlass(
                            shadow: false,
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 7),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                for (var i = 0; i < photos.length; i++)
                                  AnimatedContainer(
                                    duration: const Duration(milliseconds: 260),
                                    curve: _kSpring,
                                    margin: const EdgeInsets.symmetric(horizontal: 3),
                                    width: i == _photo ? 18 : 6,
                                    height: 6,
                                    decoration: BoxDecoration(
                                      color: i == _photo ? _KColors.ink : const Color(0x55000000),
                                      borderRadius: BorderRadius.circular(3),
                                    ),
                                  ),
                              ],
                            ),
                          ),
                        ),
                      ),
                  ],
                ),
              ),
            ),
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        Text(_kMoney(price),
                            style: TextStyle(
                              fontSize: 28,
                              fontWeight: FontWeight.w900,
                              color: reduced ? _KColors.sale : _KColors.ink,
                              letterSpacing: -0.5,
                            )),
                        if (reduced) ...[
                          const SizedBox(width: 8),
                          Padding(
                            padding: const EdgeInsets.only(bottom: 4),
                            child: Text(_kMoney(regular),
                                style: const TextStyle(fontSize: 14, color: _KColors.muted, decoration: TextDecoration.lineThrough)),
                          ),
                          const SizedBox(width: 8),
                          Container(
                            margin: const EdgeInsets.only(bottom: 4),
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                            decoration: BoxDecoration(color: _KColors.yellow, borderRadius: BorderRadius.circular(6)),
                            child: Text('-${(((regular - price) / regular) * 100).floor()}%',
                                style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 13)),
                          ),
                        ],
                      ],
                    ),
                    if (reduced)
                      Padding(
                        padding: const EdgeInsets.only(top: 4),
                        child: Text('You save ${_kMoney(regular - price)}',
                            style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: _KColors.green)),
                      ),
                    const SizedBox(height: 10),
                    Text(product.name,
                        style: const TextStyle(fontSize: 17, height: 1.35, fontWeight: FontWeight.w600, color: _KColors.ink)),
                    const SizedBox(height: 8),
                    Row(
                      children: [
                        if (product.ratingCount > 0) ...[
                          const Icon(Icons.star_rounded, size: 18, color: Color(0xFFF59E0B)),
                          const SizedBox(width: 2),
                          Text('${product.rating.toStringAsFixed(1)} (${product.ratingCount})',
                              style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700)),
                          const SizedBox(width: 12),
                        ],
                        if (product.totalSales > 0)
                          Text('${_kCompact(product.totalSales)} sold', style: const TextStyle(fontSize: 13, color: _KColors.muted)),
                        const Spacer(),
                        Text(
                          soldOut
                              ? 'Sold out'
                              : (product.stockQuantity != null && product.stockQuantity! <= 5)
                                  ? 'Only ${product.stockQuantity} left'
                                  : 'In stock',
                          style: TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w800,
                            color: soldOut || (product.stockQuantity ?? 99) <= 5 ? _KColors.sale : _KColors.green,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
            for (final attribute in _choices)
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        _picked[attribute.name] == null ? attribute.name : '${attribute.name}: ${_picked[attribute.name]}',
                        style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w800),
                      ),
                      const SizedBox(height: 10),
                      Wrap(
                        spacing: 8,
                        runSpacing: 8,
                        children: [
                          for (final option in attribute.options)
                            _KOptionChip(
                              option: option,
                              selected: _picked[attribute.name] == option.name,
                              available: _available(attribute, option),
                              onTap: () => setState(() {
                                if (_picked[attribute.name] == option.name) {
                                  _picked.remove(attribute.name);
                                } else {
                                  _picked[attribute.name] = option.name;
                                }
                                _photo = 0;
                                if (_pages.hasClients) _pages.jumpToPage(0);
                              }),
                            ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
            SliverToBoxAdapter(
              child: Container(
                margin: const EdgeInsets.fromLTRB(16, 16, 16, 0),
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(color: _KColors.white, borderRadius: BorderRadius.circular(18)),
                child: const Column(
                  children: [
                    _KPromise(Icons.local_shipping_outlined, 'Delivery across Uganda', 'Fee shown at checkout'),
                    SizedBox(height: 10),
                    _KPromise(Icons.payments_outlined, 'Pay on delivery in Kampala', 'Or MTN MoMo, Airtel Money, card'),
                    SizedBox(height: 10),
                    _KPromise(Icons.stars_outlined, 'Earn reward points', 'On every delivered order'),
                  ],
                ),
              ),
            ),
            if (_kPlain(product.description).isNotEmpty || _kPlain(product.shortDescription).isNotEmpty)
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(16, 20, 16, 0),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('Details', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w900)),
                      const SizedBox(height: 8),
                      Text(
                        _kPlain(product.description.isNotEmpty ? product.description : product.shortDescription),
                        style: const TextStyle(fontSize: 14, height: 1.55, color: _KColors.body),
                      ),
                    ],
                  ),
                ),
              ),
            if (_related.length >= 3)
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.only(top: 20),
                  child: _KCarousel(title: 'You may also like', products: _related, background: _KColors.white),
                ),
              ),
            // Room for the floating glass bar.
            SliverToBoxAdapter(child: SizedBox(height: 96 + bottom)),
          ],
        ),
        Positioned(
          top: 16,
          left: 16,
          child: _KGlassIcon(icon: Icons.close_rounded, onTap: () => Navigator.of(context).pop()),
        ),
        Positioned(
          top: 16,
          right: 16,
          child: AnimatedBuilder(
            animation: _KCart.instance,
            builder: (_, __) => _KGlassIcon(
              icon: Icons.shopping_bag_outlined,
              badge: _KCart.instance.count,
              onTap: () => _KNav.openCart(context),
            ),
          ),
        ),
        // Quantity and Add to cart float on glass over the page.
        Positioned(
          left: 10,
          right: 10,
          bottom: 10 + bottom,
          child: _KGlass(
            padding: const EdgeInsets.all(6),
            child: Row(
              children: [
                Container(
                  height: 52,
                  decoration: BoxDecoration(color: const Color(0x0F000000), borderRadius: BorderRadius.circular(999)),
                  child: Row(
                    children: [
                      IconButton(
                        onPressed: _quantity > 1
                            ? () {
                                _kHaptic();
                                setState(() => _quantity--);
                              }
                            : null,
                        icon: const Icon(Icons.remove_rounded),
                      ),
                      Text('$_quantity', style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w900)),
                      IconButton(
                        onPressed: _quantity < 20
                            ? () {
                                _kHaptic();
                                setState(() => _quantity++);
                              }
                            : null,
                        icon: const Icon(Icons.add_rounded),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: soldOut
                      ? const _KButton(label: 'Sold out', onPressed: null, dark: true)
                      : _KButton(label: 'Add to cart', busy: _adding, onPressed: () => _add()),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

class _KOptionChip extends StatelessWidget {
  const _KOptionChip({required this.option, required this.selected, required this.available, required this.onTap});
  final _KOption option;
  final bool selected;
  final bool available;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final image = option.image ?? '';
    return GestureDetector(
      onTap: available || selected
          ? () {
              _kHaptic();
              onTap();
            }
          : null,
      child: Opacity(
        opacity: available ? 1 : 0.35,
        child: Container(
          padding: EdgeInsets.symmetric(horizontal: image.isNotEmpty ? 4 : 16, vertical: 4),
          constraints: const BoxConstraints(minWidth: 52, minHeight: 44),
          decoration: BoxDecoration(
            color: selected ? _KColors.ink : _KColors.white,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: selected ? _KColors.ink : _KColors.line, width: 1.5),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (image.isNotEmpty)
                SizedBox(width: 36, height: 36, child: _KPhoto(image, radius: 8))
              else if ((option.value ?? '').startsWith('#'))
                Container(
                  width: 18,
                  height: 18,
                  margin: const EdgeInsets.only(right: 8),
                  decoration: BoxDecoration(
                    color: Color(int.tryParse('FF${option.value!.substring(1)}', radix: 16) ?? 0xFFCCCCCC),
                    shape: BoxShape.circle,
                    border: Border.all(color: _KColors.line),
                  ),
                ),
              if (image.isNotEmpty) const SizedBox(width: 8),
              Text(option.name,
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                    color: selected ? _KColors.white : _KColors.ink,
                    decoration: available ? null : TextDecoration.lineThrough,
                  )),
              if (image.isNotEmpty) const SizedBox(width: 8),
            ],
          ),
        ),
      ),
    );
  }
}

class _KPromise extends StatelessWidget {
  const _KPromise(this.icon, this.title, this.subtitle);
  final IconData icon;
  final String title;
  final String subtitle;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Icon(icon, color: _KColors.ink, size: 22),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(title, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w800)),
              Text(subtitle, style: const TextStyle(fontSize: 12, color: _KColors.muted)),
            ],
          ),
        ),
      ],
    );
  }
}


/// The shopper's saved delivery addresses (kept in WooCommerce), and a form
/// to add one. The area is searched with the website's place search, so
/// delivery is priced from the real spot. Choosing one saves its id under
/// `kandi-address-id` and closes the sheet with true.
class _KAddressSheet extends StatefulWidget {
  const _KAddressSheet({super.key});

  @override
  State<_KAddressSheet> createState() => _KAddressSheetState();
}


class _KAddressSheetState extends State<_KAddressSheet> {
  List<Map<String, dynamic>> _addresses = [];
  String? _selected;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    // Let the first frame build: the sign-in sheet cannot open from initState.
    await Future<void>.delayed(Duration.zero);
    if (!mounted) return;
    if (!_KAuth.signedIn) {
      final ok = await _KAuth.ensure(context, reason: 'Sign in to save addresses');
      if (!ok) {
        if (mounted) Navigator.of(context).pop();
        return;
      }
    }
    final prefs = await SharedPreferences.getInstance();
    List<Map<String, dynamic>> rows = [];
    try {
      final data = await _KWoo.get('/addresses');
      rows = ((data is Map ? data['addresses'] : null) as List? ?? const [])
          .map((row) => Map<String, dynamic>.from(row as Map))
          .toList();
    } catch (e) {
      if (mounted) _kToast(context, _KWoo.message(e));
    }
    if (!mounted) return;
    setState(() {
      _addresses = rows;
      _selected = prefs.getString(_KKeys.address);
      _loading = false;
    });
  }

  Future<void> _choose(Map<String, dynamic> address) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_KKeys.address, address['id'] as String);
    if (mounted) Navigator.of(context).pop(true);
  }

  Future<void> _edit([Map<String, dynamic>? address]) async {
    final saved = await _KNav.sheet<Map<String, dynamic>>(context, _KAddressForm(existing: address), height: null);
    if (saved != null) {
      await _load();
      if (address == null) await _choose(saved);
    }
  }

  Future<void> _delete(Map<String, dynamic> address) async {
    try {
      await _KWoo.delete('/addresses/${address['id']}');
    } catch (e) {
      if (mounted) _kToast(context, _KWoo.message(e));
    }
    await _load();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.transparent,
      appBar: _kSheetBar(context, 'Delivery address'),
      body: _loading
          ? const Center(child: CupertinoActivityIndicator(radius: 14))
          : ListView(
              physics: _kPhysics,
              padding: const EdgeInsets.fromLTRB(12, 4, 12, 24),
              children: [
                for (final address in _addresses)
                  Container(
                    margin: const EdgeInsets.only(bottom: 10),
                    decoration: BoxDecoration(
                      color: _KColors.white,
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(
                        color: address['id'] == _selected ? _KColors.ink : Colors.transparent,
                        width: 2,
                      ),
                    ),
                    child: InkWell(
                      borderRadius: BorderRadius.circular(16),
                      onTap: () => _choose(address),
                      child: Padding(
                        padding: const EdgeInsets.fromLTRB(14, 12, 4, 12),
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Icon(
                              address['id'] == _selected ? Icons.radio_button_checked : Icons.radio_button_off,
                              color: _KColors.ink,
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Row(
                                    children: [
                                      Text('${address['label']}',
                                          style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w900)),
                                      if (address['lat'] != null) ...[
                                        const SizedBox(width: 6),
                                        const Icon(Icons.location_on_rounded, size: 16, color: _KColors.green),
                                      ],
                                    ],
                                  ),
                                  const SizedBox(height: 2),
                                  Text('${address['recipient']} · ${address['phone']}',
                                      style: const TextStyle(fontSize: 13, color: _KColors.body)),
                                  Text(
                                    [address['street'], address['area'], address['city']]
                                        .where((part) => part != null && '$part'.isNotEmpty)
                                        .join(', '),
                                    style: const TextStyle(fontSize: 13, color: _KColors.muted),
                                  ),
                                ],
                              ),
                            ),
                            PopupMenuButton<String>(
                              onSelected: (value) => value == 'edit' ? _edit(address) : _delete(address),
                              itemBuilder: (_) => const [
                                PopupMenuItem(value: 'edit', child: Text('Edit')),
                                PopupMenuItem(value: 'delete', child: Text('Delete')),
                              ],
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                const SizedBox(height: 6),
                _KButton(label: 'Add a new address', icon: Icons.add_location_alt_outlined, outline: true, onPressed: () => _edit()),
              ],
            ),
    );
  }
}

class _KAddressForm extends StatefulWidget {
  const _KAddressForm({this.existing});
  final Map<String, dynamic>? existing;
  @override
  State<_KAddressForm> createState() => _KAddressFormState();
}

class _KAddressFormState extends State<_KAddressForm> {
  late final _label = TextEditingController(text: '${widget.existing?['label'] ?? 'Home'}');
  late final _recipient = TextEditingController(text: '${widget.existing?['recipient'] ?? ''}');
  late final _phone = TextEditingController(
      text: '${widget.existing?['phone'] ?? (_KAuth.user?.phone ?? '').replaceFirst(RegExp(r'^\+?256'), '0')}');
  late final _area = TextEditingController(text: '${widget.existing?['area'] ?? ''}');
  late final _street = TextEditingController(text: '${widget.existing?['street'] ?? ''}');
  late final _landmark = TextEditingController(text: '${widget.existing?['landmark'] ?? ''}');
  late String _city = '${widget.existing?['city'] ?? 'Kampala'}';
  late double? _lat = (widget.existing?['lat'] as num?)?.toDouble();
  late double? _lng = (widget.existing?['lng'] as num?)?.toDouble();

  List<Map<String, dynamic>> _places = [];
  Timer? _debounce;
  bool _saving = false;
  String? _error;

  @override
  void dispose() {
    _debounce?.cancel();
    super.dispose();
  }

  void _searchPlaces(String text) {
    _lat = null;
    _lng = null;
    _debounce?.cancel();
    if (text.trim().length < 3) {
      setState(() => _places = []);
      return;
    }
    _debounce = Timer(const Duration(milliseconds: 350), () async {
      try {
        final response = await http
            .get(Uri.parse('$_kSiteUrl/api/delivery/suggest').replace(queryParameters: {'q': text.trim()}))
            .timeout(const Duration(seconds: 10));
        final data = jsonDecode(response.body);
        if (!mounted) return;
        setState(() => _places = ((data['places'] as List?) ?? const []).cast<Map<String, dynamic>>());
      } catch (_) {}
    });
  }

  /// Picks a suggestion. When it came without coordinates, the website's
  /// delivery quote looks them up (one lookup, at the moment of choosing).
  Future<void> _pick(Map<String, dynamic> place) async {
    final label = '${place['label'] ?? ''}';
    setState(() {
      _area.text = label.split(',').first.trim();
      _places = [];
      final parts = label.split(',');
      if (parts.length > 1) _city = parts[1].trim();
    });
    final point = place['point'];
    if (point is Map && point['lat'] is num) {
      _lat = (point['lat'] as num).toDouble();
      _lng = (point['lng'] as num).toDouble();
      return;
    }
    try {
      final response = await http.post(
        Uri.parse('$_kSiteUrl/api/delivery/quote'),
        headers: const {'Content-Type': 'application/json'},
        body: jsonEncode({'subtotal': 0, 'address': label}),
      );
      final data = jsonDecode(response.body);
      if (data['point'] is Map) {
        _lat = (data['point']['lat'] as num?)?.toDouble();
        _lng = (data['point']['lng'] as num?)?.toDouble();
      }
    } catch (_) {}
  }

  Future<void> _save() async {
    final phone = _KAuth.ugPhone(_phone.text);
    if (_recipient.text.trim().isEmpty || _street.text.trim().isEmpty || _area.text.trim().isEmpty) {
      setState(() => _error = 'Fill in the name, area and street.');
      return;
    }
    if (phone == null) {
      setState(() => _error = 'Enter a Ugandan mobile number the rider can call.');
      return;
    }
    setState(() {
      _saving = true;
      _error = null;
    });
    final row = <String, dynamic>{
      if (widget.existing != null) 'id': widget.existing!['id'],
      'label': _label.text.trim().isEmpty ? 'Home' : _label.text.trim(),
      'recipient': _recipient.text.trim(),
      'phone': phone,
      'area': _area.text.trim(),
      'street': _street.text.trim(),
      'landmark': _landmark.text.trim(),
      'city': _city.isEmpty ? 'Kampala' : _city,
      'lat': _lat,
      'lng': _lng,
    };
    try {
      final data = await _KWoo.post('/addresses', row);
      final saved = Map<String, dynamic>.from((data as Map)['address'] as Map);
      if (mounted) Navigator.of(context).pop(saved);
    } catch (e) {
      if (mounted) {
        setState(() {
          _saving = false;
          _error = _KWoo.message(e);
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
      child: Container(
        constraints: BoxConstraints(maxHeight: MediaQuery.of(context).size.height * 0.86),
        child: SafeArea(
          top: false,
          child: ListView(
            shrinkWrap: true,
            physics: _kPhysics,
            padding: const EdgeInsets.fromLTRB(20, 30, 20, 16),
            children: [
              Text(widget.existing == null ? 'New address' : 'Edit address',
                  style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w900)),
              const SizedBox(height: 16),
              _KField(controller: _recipient, label: 'Name of the person receiving'),
              const SizedBox(height: 12),
              _KField(controller: _phone, label: 'Their phone', hint: '0772 123 456', keyboard: TextInputType.phone),
              const SizedBox(height: 12),
              _KField(controller: _area, label: 'Area', hint: 'Start typing: Ntinda, Kira, Mukono…', onChanged: _searchPlaces),
              if (_places.isNotEmpty)
                Container(
                  margin: const EdgeInsets.only(top: 6),
                  decoration: BoxDecoration(border: Border.all(color: _KColors.line), borderRadius: BorderRadius.circular(14)),
                  child: Column(
                    children: [
                      for (final place in _places)
                        ListTile(
                          dense: true,
                          leading: const Icon(Icons.place_outlined),
                          title: Text('${place['label']}'),
                          onTap: () => _pick(place),
                        ),
                    ],
                  ),
                ),
              const SizedBox(height: 12),
              _KField(controller: _street, label: 'Street, building or house', hint: 'Plot 12, Kira Road'),
              const SizedBox(height: 12),
              _KField(controller: _landmark, label: 'Landmark (optional)', hint: 'Opposite the Shell station'),
              const SizedBox(height: 12),
              _KField(controller: _label, label: 'Save as', hint: 'Home, Work…'),
              if (_error != null) ...[
                const SizedBox(height: 12),
                Text(_error!, style: const TextStyle(color: _KColors.sale, fontWeight: FontWeight.w700)),
              ],
              const SizedBox(height: 18),
              _KButton(label: 'Save address', busy: _saving, onPressed: _save),
            ],
          ),
        ),
      ),
    );
  }
}

