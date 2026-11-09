// Automatic FlutterFlow imports
import '/flutter_flow/flutter_flow_theme.dart';
import '/flutter_flow/flutter_flow_util.dart';
import '/custom_code/widgets/index.dart'; // Imports other custom widgets
import '/flutter_flow/custom_functions.dart'; // Imports custom functions
import 'package:flutter/material.dart';
// Begin custom widget code
// DO NOT REMOVE OR MODIFY THE CODE ABOVE!


// ============================================================
//  KANDI — PRODUCT
//  Photos, price, sizes and colours (matched to the real
//  WooCommerce variation), add to cart, and more like it.
//  Which product: the id the previous screen saved under
//  `kandi-open-product`.
// ============================================================

import 'dart:convert';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

// Other Kandi screens are reached through '/custom_code/widgets/index.dart' above.

class KandiProductScreen extends StatefulWidget {
  const KandiProductScreen({super.key, this.width, this.height});
  final double? width;
  final double? height;

  @override
  State<KandiProductScreen> createState() => _KandiProductScreenState();
}

String _norm(String value) => value.toLowerCase().replaceAll(RegExp(r'[^a-z0-9]'), '');

class _KandiProductScreenState extends State<KandiProductScreen> {
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
    final prefs = await SharedPreferences.getInstance();
    final id = prefs.getInt(_KKeys.openProduct);
    if (id == null) {
      setState(() => _loading = false);
      return;
    }
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
    final keys = product.variations.expand((v) => v.attributes.keys).map(_norm).toSet();
    return product.attributes.where((a) => keys.contains(_norm(a.name))).toList();
  }

  bool _matches(_KVariation variation, Map<String, String> picked) {
    for (final entry in variation.attributes.entries) {
      final chosen = picked.entries.where((p) => _norm(p.key) == _norm(entry.key)).toList();
      if (chosen.isEmpty || _norm(chosen.first.value) != _norm(entry.value)) return false;
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
        final chosen = trial.entries.where((p) => _norm(p.key) == _norm(entry.key)).toList();
        if (chosen.isNotEmpty && _norm(chosen.first.value) != _norm(entry.value)) return false;
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
      Navigator.of(context).push(MaterialPageRoute(builder: (_) => const KandiCartScreen()));
    } else {
      _kToast(context, 'Added to your cart');
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Scaffold(backgroundColor: _KColors.white, body: Center(child: CircularProgressIndicator(color: _KColors.ink)));
    }
    final product = _product;
    if (product == null) {
      return Scaffold(
        backgroundColor: _KColors.white,
        appBar: AppBar(backgroundColor: _KColors.white, foregroundColor: _KColors.ink, elevation: 0),
        body: Center(
          child: _KEmpty(
            icon: Icons.search_off_rounded,
            title: 'This product is gone',
            message: 'It may have sold out or been removed.',
            action: 'Back to shopping',
            onAction: () => Navigator.of(context).pop(),
          ),
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

    return Scaffold(
      backgroundColor: _KColors.white,
      body: CustomScrollView(
        slivers: [
          SliverAppBar(
            pinned: true,
            expandedHeight: MediaQuery.of(context).size.width,
            backgroundColor: _KColors.white,
            foregroundColor: _KColors.ink,
            elevation: 0,
            leading: Padding(
              padding: const EdgeInsets.all(6),
              child: CircleAvatar(
                backgroundColor: _KColors.white,
                child: IconButton(
                  icon: const Icon(Icons.arrow_back_rounded, color: _KColors.ink),
                  onPressed: () => Navigator.of(context).pop(),
                ),
              ),
            ),
            actions: [
              Padding(
                padding: const EdgeInsets.all(6),
                child: CircleAvatar(
                  backgroundColor: _KColors.white,
                  child: IconButton(
                    onPressed: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const KandiCartScreen())),
                    icon: AnimatedBuilder(
                      animation: _KCart.instance,
                      builder: (_, __) => Badge(
                        isLabelVisible: _KCart.instance.count > 0,
                        label: Text('${_KCart.instance.count}'),
                        backgroundColor: _KColors.sale,
                        child: const Icon(Icons.shopping_bag_outlined, color: _KColors.ink),
                      ),
                    ),
                  ),
                ),
              ),
            ],
            flexibleSpace: FlexibleSpaceBar(
              background: Stack(
                children: [
                  PageView.builder(
                    controller: _pages,
                    itemCount: photos.isEmpty ? 1 : photos.length,
                    onPageChanged: (index) => setState(() => _photo = index),
                    itemBuilder: (_, index) => _KPhoto(photos.isEmpty ? '' : photos[index], fit: BoxFit.contain),
                  ),
                  if (photos.length > 1)
                    Positioned(
                      bottom: 12,
                      left: 0,
                      right: 0,
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          for (var i = 0; i < photos.length; i++)
                            AnimatedContainer(
                              duration: const Duration(milliseconds: 200),
                              margin: const EdgeInsets.symmetric(horizontal: 3),
                              width: i == _photo ? 18 : 6,
                              height: 6,
                              decoration: BoxDecoration(
                                color: i == _photo ? _KColors.ink : _KColors.muted.withOpacity(0.4),
                                borderRadius: BorderRadius.circular(3),
                              ),
                            ),
                        ],
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
                          _OptionChip(
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
              decoration: BoxDecoration(color: _KColors.ground, borderRadius: BorderRadius.circular(16)),
              child: const Column(
                children: [
                  _Promise(Icons.local_shipping_outlined, 'Delivery across Uganda', 'Fee shown at checkout'),
                  SizedBox(height: 10),
                  _Promise(Icons.payments_outlined, 'Pay on delivery in Kampala', 'Or MTN MoMo, Airtel Money, card'),
                  SizedBox(height: 10),
                  _Promise(Icons.stars_outlined, 'Earn reward points', 'On every delivered order'),
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
                child: _KCarousel(title: 'You may also like', products: _related, background: _KColors.ground),
              ),
            ),
          const SliverToBoxAdapter(child: SizedBox(height: 24)),
        ],
      ),
      bottomNavigationBar: Container(
        decoration: const BoxDecoration(color: _KColors.white, border: Border(top: BorderSide(color: _KColors.line))),
        child: SafeArea(
          top: false,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(12, 10, 12, 10),
            child: Row(
              children: [
                Container(
                  height: 52,
                  decoration: BoxDecoration(color: _KColors.ground, borderRadius: BorderRadius.circular(999)),
                  child: Row(
                    children: [
                      IconButton(
                        onPressed: _quantity > 1 ? () => setState(() => _quantity--) : null,
                        icon: const Icon(Icons.remove_rounded),
                      ),
                      Text('$_quantity', style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w900)),
                      IconButton(
                        onPressed: _quantity < 20 ? () => setState(() => _quantity++) : null,
                        icon: const Icon(Icons.add_rounded),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: soldOut
                      ? const _KButton(label: 'Sold out', onPressed: null, dark: true)
                      : _KButton(label: 'Add to cart', busy: _adding, onPressed: () => _add()),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _OptionChip extends StatelessWidget {
  const _OptionChip({required this.option, required this.selected, required this.available, required this.onTap});
  final _KOption option;
  final bool selected;
  final bool available;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final image = option.image ?? '';
    return GestureDetector(
      onTap: available || selected ? onTap : null,
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

class _Promise extends StatelessWidget {
  const _Promise(this.icon, this.title, this.subtitle);
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

// ============================================================
//  Shared building blocks, private to this file
//  (the same in every Kandi screen; change one, change all)
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
    for (final raw in (row['attributes'] as List? ?? const [])) {
      if (raw is! Map) continue;
      final options = <_KOption>[];
      for (final option in (raw['options'] as List? ?? const [])) {
        if (option is Map) {
          options.add(_KOption('${option['name'] ?? ''}', option['value']?.toString(), option['image']?.toString()));
        } else {
          options.add(_KOption('$option', null, null));
        }
      }
      if (options.isNotEmpty) attributes.add(_KAttribute('${raw['name'] ?? ''}', options));
    }

    final variations = <_KVariation>[];
    for (final raw in (row['variations'] as List? ?? const [])) {
      if (raw is! Map) continue;
      final attrs = <String, String>{};
      (raw['attributes'] as Map? ?? const {}).forEach((key, value) => attrs['$key'] = '$value');
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
      gallery: (row['gallery'] as List? ?? const []).map((url) => '$url').toList(),
      stockStatus: '${row['stock_status'] ?? 'instock'}',
      stockQuantity: (row['stock_quantity'] as num?)?.toInt(),
      totalSales: (row['total_sales'] as num?)?.toInt() ?? 0,
      rating: _num(row['average_rating']),
      ratingCount: (row['rating_count'] as num?)?.toInt() ?? 0,
      categoryIds: (row['category_ids'] as List? ?? const []).map((id) => (id as num).toInt()).toList(),
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
    'id,name,price,regular_price,image,gallery,stock_status,stock_quantity,total_sales,average_rating,rating_count,category_ids,attributes,variations,short_description,description';

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
  static const openProduct = 'kandi-open-product';
  static const shopCategory = 'kandi-shop-category';
  static const shopQuery = 'kandi-shop-query';
  static const shopSort = 'kandi-shop-sort';
  static const cart = 'kandi-cart-v2';
  static const address = 'kandi-address-id';
}

class _KNav {
  static Future<void> openProduct(BuildContext context, int id) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setInt(_KKeys.openProduct, id);
    if (!context.mounted) return;
    await Navigator.of(context).push(MaterialPageRoute(builder: (_) => const KandiProductScreen()));
  }

  /// Opens Shop already filtered to a category, a search or a sort.
  static Future<void> openShop(BuildContext context, {int? categoryId, String? query, String? sort}) async {
    final prefs = await SharedPreferences.getInstance();
    if (categoryId != null) await prefs.setInt(_KKeys.shopCategory, categoryId);
    if (query != null) await prefs.setString(_KKeys.shopQuery, query);
    if (sort != null) await prefs.setString(_KKeys.shopSort, sort);
    if (!context.mounted) return;
    await Navigator.of(context).push(MaterialPageRoute(builder: (_) => const KandiShopScreen()));
  }

  /// The bottom bar's tabs swap the screen rather than stacking it.
  static void tab(BuildContext context, int index) {
    const screens = <Widget>[
      KandiHomeScreen(),
      KandiShopScreen(),
      KandiRewardsScreen(),
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
        options: (json['options'] as Map? ?? const {}).map((k, v) => MapEntry('$k', '$v')),
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
      existing.first.quantity = (existing.first.quantity + line.quantity).clamp(1, 20);
    } else {
      lines.add(line);
    }
    await _save();
  }

  Future<void> setQuantity(_KCartLine line, int quantity) async {
    if (quantity <= 0) {
      lines.remove(line);
    } else {
      line.quantity = quantity.clamp(1, 20);
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
//  Phone sign-in (Supabase Auth, SMS code)
// ------------------------------------------------------------

class _KAuth {
  static User? get user => _kSupa.auth.currentUser;
  static bool get signedIn => user != null;

  /// Signed in already, or signs in now through the sheet. True when signed in.
  static Future<bool> ensure(BuildContext context, {String reason = 'Sign in to continue'}) async {
    if (signedIn) return true;
    final ok = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _KPhoneSignInSheet(reason: reason),
    );
    return ok == true && signedIn;
  }

  /// "0772 123 456" / "772123456" / "+256772123456" → "+256772123456", or null.
  static String? ugPhone(String raw) {
    var digits = raw.replaceAll(RegExp(r'\D'), '');
    if (digits.startsWith('256')) digits = digits.substring(3);
    if (digits.startsWith('0')) digits = digits.substring(1);
    return RegExp(r'^7\d{8}$').hasMatch(digits) ? '+256$digits' : null;
  }
}

class _KPhoneSignInSheet extends StatefulWidget {
  const _KPhoneSignInSheet({super.key, this.reason = 'Sign in to continue'});
  final String reason;
  @override
  State<_KPhoneSignInSheet> createState() => _KPhoneSignInSheetState();
}

class _KPhoneSignInSheetState extends State<_KPhoneSignInSheet> {
  final _phone = TextEditingController();
  final _code = TextEditingController();
  String? _sentTo;
  bool _busy = false;
  String? _error;

  Future<void> _send() async {
    final phone = _KAuth.ugPhone(_phone.text);
    if (phone == null) {
      setState(() => _error = 'Enter an MTN or Airtel number, like 0772 123 456.');
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await _kSupa.auth.signInWithOtp(phone: phone);
      setState(() => _sentTo = phone);
    } on AuthException catch (e) {
      setState(() => _error = e.message);
    } catch (_) {
      setState(() => _error = 'Could not send the code. Check your connection and try again.');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _verify() async {
    final code = _code.text.trim();
    if (code.length < 4 || _sentTo == null) {
      setState(() => _error = 'Enter the code from the SMS.');
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await _kSupa.auth.verifyOTP(phone: _sentTo!, token: code, type: OtpType.sms);
      if (mounted) Navigator.of(context).pop(true);
    } on AuthException catch (e) {
      setState(() => _error = e.message);
    } catch (_) {
      setState(() => _error = 'That code did not work. Try again.');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final sent = _sentTo != null;
    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
      child: Container(
        padding: const EdgeInsets.fromLTRB(20, 12, 20, 24),
        decoration: const BoxDecoration(
          color: _KColors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
        ),
        child: SafeArea(
          top: false,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Center(
                child: Container(
                  width: 40,
                  height: 4,
                  decoration: BoxDecoration(color: _KColors.line, borderRadius: BorderRadius.circular(2)),
                ),
              ),
              const SizedBox(height: 18),
              Text(widget.reason,
                  style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w900, color: _KColors.ink, letterSpacing: -0.5)),
              const SizedBox(height: 6),
              Text(
                sent ? 'We sent a code to $_sentTo.' : 'We will text you a code. No password needed.',
                style: const TextStyle(fontSize: 14, color: _KColors.muted),
              ),
              const SizedBox(height: 18),
              if (!sent)
                _KField(
                  controller: _phone,
                  label: 'Phone number',
                  hint: '0772 123 456',
                  keyboard: TextInputType.phone,
                  prefix: '+256 ',
                )
              else
                _KField(
                  controller: _code,
                  label: 'Code',
                  hint: '6-digit code',
                  keyboard: TextInputType.number,
                ),
              if (_error != null) ...[
                const SizedBox(height: 10),
                Text(_error!, style: const TextStyle(color: _KColors.sale, fontSize: 13, fontWeight: FontWeight.w600)),
              ],
              const SizedBox(height: 18),
              _KButton(
                label: sent ? 'Sign in' : 'Send code',
                busy: _busy,
                onPressed: sent ? _verify : _send,
              ),
              if (sent)
                TextButton(
                  onPressed: _busy ? null : () => setState(() => _sentTo = null),
                  child: const Text('Use a different number', style: TextStyle(color: _KColors.ink)),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

// ------------------------------------------------------------
//  Building blocks
// ------------------------------------------------------------

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
    final background = outline ? _KColors.white : (dark ? _KColors.ink : _KColors.yellow);
    final foreground = dark && !outline ? _KColors.white : _KColors.ink;
    return SizedBox(
      width: double.infinity,
      height: 52,
      child: ElevatedButton(
        onPressed: busy ? null : onPressed,
        style: ElevatedButton.styleFrom(
          elevation: 0,
          backgroundColor: background,
          foregroundColor: foreground,
          disabledBackgroundColor: background.withOpacity(0.6),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(999),
            side: outline ? const BorderSide(color: _KColors.ink, width: 1.5) : BorderSide.none,
          ),
        ),
        child: busy
            ? SizedBox(
                width: 22,
                height: 22,
                child: CircularProgressIndicator(strokeWidth: 2.5, color: foreground),
              )
            : Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  if (icon != null) ...[Icon(icon, size: 20), const SizedBox(width: 8)],
                  Text(label, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800)),
                ],
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
            fillColor: _KColors.ground,
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
    return GestureDetector(
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

/// The app's five tabs. Cart shows its count.
class _KBottomNav extends StatelessWidget {
  const _KBottomNav({super.key, required this.current});
  final int current;

  @override
  Widget build(BuildContext context) {
    const items = [
      (Icons.home_outlined, Icons.home, 'Home'),
      (Icons.grid_view_outlined, Icons.grid_view_rounded, 'Shop'),
      (Icons.stars_outlined, Icons.stars_rounded, 'Rewards'),
      (Icons.shopping_bag_outlined, Icons.shopping_bag, 'Cart'),
      (Icons.person_outline, Icons.person, 'Account'),
    ];
    return AnimatedBuilder(
      animation: _KCart.instance,
      builder: (context, _) => Container(
        decoration: const BoxDecoration(
          color: _KColors.white,
          border: Border(top: BorderSide(color: _KColors.line)),
        ),
        child: SafeArea(
          top: false,
          child: SizedBox(
            height: 62,
            child: Row(
              children: [
                for (var i = 0; i < items.length; i++)
                  Expanded(
                    child: InkWell(
                      onTap: i == current ? null : () => _KNav.tab(context, i),
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Badge(
                            isLabelVisible: i == 3 && _KCart.instance.count > 0,
                            label: Text('${_KCart.instance.count}'),
                            backgroundColor: _KColors.sale,
                            child: Icon(i == current ? items[i].$2 : items[i].$1,
                                color: i == current ? _KColors.ink : _KColors.muted, size: 26),
                          ),
                          const SizedBox(height: 2),
                          Text(items[i].$3,
                              style: TextStyle(
                                fontSize: 11,
                                fontWeight: i == current ? FontWeight.w800 : FontWeight.w500,
                                color: i == current ? _KColors.ink : _KColors.muted,
                              )),
                        ],
                      ),
                    ),
                  ),
              ],
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

/// A short message at the bottom of the screen.
void _kToast(BuildContext context, String message) {
  ScaffoldMessenger.of(context)
    ..hideCurrentSnackBar()
    ..showSnackBar(SnackBar(
      content: Text(message, style: const TextStyle(fontWeight: FontWeight.w600)),
      behavior: SnackBarBehavior.floating,
      backgroundColor: _KColors.ink,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
    ));
}
