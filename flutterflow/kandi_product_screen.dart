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

// Navigation only. No design, model or helper is shared between pages.
import '/custom_code/widgets/kandi_cart_screen.dart';

// ============================================================
//  KANDI — PRODUCT PAGE
//
//  One product: its pictures, its price, the choice a shopper
//  has to make before buying, and the button that buys it.
//
//  Self-contained like every page in this app — its own
//  palette, HTTP and model, all file-private so two pages
//  cannot collide in FlutterFlow's flat widget folder. The
//  reasoning is written out in full at the head of
//  kandi_home_screen.dart.
//
//  ---- How it knows which product, with NOTHING passed in ----
//
//  From the device. Whichever page opened this one wrote the id
//  to `kandi-open-product` first, and `initState` reads it.
//
//  This was a route argument for one build, and route arguments
//  are the wrong channel here. They only survive if navigation
//  happens through this code — the moment the builder wires a
//  page with FlutterFlow's own "Navigate To" action, the
//  argument is gone and this screen opens blank. A handoff on
//  disk works however the shopper got here, including from a
//  push notification or a deep link the app has not been taught
//  about yet.
//
//  With no id stored — which is what FlutterFlow's own preview
//  does — the screen says so rather than spinning forever.
// ============================================================

class _KColors {
  const _KColors._();
  static const Color canvas = Color(0xFFF8F7F4);
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
  static const Color saveSoft = Color(0xFFF0FDF4);
  static const Color dealFlag = Color(0xFFFACC15);
  static const Color star = Color(0xFFF59E0B);
}

class _KSpace {
  const _KSpace._();
  static const double sm = 8;
  static const double md = 12;
  static const double lg = 16;
  static const double xl = 24;
}

const double _radiusChip = 8;
const String _apiBase = 'https://kandiug.com';

// The keys every page in this app agrees on. Repeated verbatim in each file;
// if one changes it must change in all of them at once.
const String _basketKey = 'kandi-cart-v1';
const String _wishlistKey = 'kandi-wishlist-v1';
const String _openProductKey = 'kandi-open-product';

String _money(num amount) {
  final whole = amount.round().toString();
  final out = StringBuffer();
  for (int i = 0; i < whole.length; i++) {
    if (i > 0 && (whole.length - i) % 3 == 0) out.write(',');
    out.write(whole[i]);
  }
  return 'UGX $out';
}

/// A neighbouring product, for the rail at the foot of the page.
///
/// Deliberately thinner than the full product model: this rail needs a picture,
/// a name, a price and an id to open. Parsing the rest would be carrying fields
/// nothing on this screen draws.
class _KRelated {
  const _KRelated({
    required this.id,
    required this.name,
    required this.image,
    required this.priceLabel,
  });

  final int id;
  final String name;
  final String image;
  final String priceLabel;

  static List<_KRelated> listFrom(dynamic json) {
    if (json is! List) return const [];
    final out = <_KRelated>[];
    for (final entry in json) {
      if (entry is! Map) continue;
      final id = entry['id'];
      if (id is! int) continue;
      out.add(_KRelated(
        id: id,
        name: (entry['name'] ?? '').toString(),
        image: (entry['image'] ?? '').toString(),
        priceLabel: (entry['priceLabel'] ?? '').toString(),
      ));
    }
    return out;
  }
}

/// One selectable attribute — "Size", with its values.
class _KAttribute {
  const _KAttribute({required this.name, required this.values});
  final String name;
  final List<String> values;

  static List<_KAttribute> listFrom(dynamic json) {
    if (json is! List) return const [];
    final out = <_KAttribute>[];
    for (final entry in json) {
      if (entry is! Map) continue;
      final name = (entry['name'] ?? '').toString();
      final values = (entry['values'] is List)
          ? (entry['values'] as List).map((v) => v.toString()).toList()
          : <String>[];
      if (name.isEmpty || values.isEmpty) continue;
      out.add(_KAttribute(name: name, values: values));
    }
    return out;
  }
}

class KandiProductScreen extends StatefulWidget {
  const KandiProductScreen({super.key, this.width, this.height});

  final double? width;
  final double? height;

  @override
  State<KandiProductScreen> createState() => _KandiProductScreenState();
}

class _KandiProductScreenState extends State<KandiProductScreen> {
  int? _productId;
  bool _loading = true;
  bool _failed = false;

  String _name = '';
  String _priceLabel = '';
  num _price = 0;
  String? _wasPriceLabel;
  String? _savingLabel;
  int _discountPercent = 0;
  bool _inStock = true;
  int? _stockQuantity;
  num _rating = 0;
  int _ratingCount = 0;
  String _shortDescription = '';
  List<String> _images = const [];
  List<_KAttribute> _attributes = const [];
  String? _sellerName;
  int _returnsDays = 0;
  num _freeDeliveryFrom = 0;

  /// Other products from the same category.
  ///
  /// The API has been sending these all along and the screen was throwing them
  /// away — a request paid for and discarded, and a product page with no onward
  /// path except the back button. A shopper who does not want THIS item is one
  /// tap from leaving; a rail of alternatives is the cheapest thing that keeps
  /// them in the shop.
  List<_KRelated> _related = const [];

  /// What the shopper has picked, keyed by attribute name.
  final Map<String, String> _chosen = {};

  int _gallery = 0;
  bool _adding = false;

  /// True when this product is in the saved list.
  bool _saved = false;

  @override
  void initState() {
    super.initState();
    _restore();
  }

  /// Reads the id the opening page left on the device.
  ///
  /// NOT consumed. The basket page and the saved page can both push this screen
  /// again on the way back, and a shopper who taps back and forward twice must
  /// land on the same product each time — clearing the key would make the
  /// second visit fail. It is overwritten by whoever opens the page next, which
  /// is the only moment its value should change.
  Future<void> _restore() async {
    int? id;
    bool saved = false;
    try {
      final prefs = await SharedPreferences.getInstance();
      id = int.tryParse(prefs.getString(_openProductKey) ?? '');
      if (id != null) {
        final raw = prefs.getString(_wishlistKey);
        if (raw != null) {
          final decoded = jsonDecode(raw);
          if (decoded is List) {
            saved = decoded
                .whereType<Map>()
                .any((entry) => entry['id'] == id);
          }
        }
      }
    } catch (_) {
      id = null;
    }

    if (!mounted) return;
    if (id == null) {
      setState(() {
        _loading = false;
        _failed = true;
      });
      return;
    }
    setState(() {
      _productId = id;
      _saved = saved;
    });
    _load();
  }

  /// Adds or removes this product from the saved list.
  ///
  /// Stores enough to draw a tile — name, image, price — so the saved page
  /// opens with no network at all. See the note at the head of
  /// kandi_wishlist_screen.dart for why that trade is the right one there.
  Future<void> _toggleSaved() async {
    final id = _productId;
    if (id == null) return;
    bool added = false;
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
      final index = items.indexWhere((item) => item['id'] == id);
      added = index < 0;
      if (added) {
        items.add({
          'id': id,
          'name': _name,
          'image': _images.isNotEmpty ? _images.first : '',
          'priceLabel': _priceLabel,
          'price': _price,
        });
      } else {
        items.removeAt(index);
      }
      await prefs.setString(_wishlistKey, jsonEncode(items));
    } catch (_) {
      return;
    }

    if (!mounted) return;
    setState(() => _saved = added);
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(added ? 'Saved' : 'Removed from saved'),
        duration: const Duration(seconds: 1),
        behavior: SnackBarBehavior.floating,
      ),
    );
  }

  Future<void> _load() async {
    final id = _productId;
    if (id == null) return;
    if (mounted) setState(() => _loading = true);

    dynamic data;
    int status = 0;
    try {
      final response = await http
          .get(Uri.parse('$_apiBase/api/app/product/$id'))
          .timeout(const Duration(seconds: 20));
      status = response.statusCode;
      data = jsonDecode(response.body);
    } catch (_) {
      status = 0;
    }

    if (!mounted) return;

    final product = (data is Map) ? data['product'] : null;
    if (status != 200 || product is! Map) {
      setState(() {
        _loading = false;
        _failed = true;
      });
      return;
    }

    final reviews = (data as Map)['reviews'];
    final commerce = data['commerce'];
    final seller = product['seller'];

    setState(() {
      _loading = false;
      _failed = false;
      _name = (product['name'] ?? '').toString();
      _priceLabel = (product['priceLabel'] ?? '').toString();
      _price = product['price'] is num ? product['price'] as num : 0;
      _wasPriceLabel = product['wasPriceLabel']?.toString();
      _savingLabel = product['savingLabel']?.toString();
      _discountPercent =
          product['discountPercent'] is int ? product['discountPercent'] as int : 0;
      _inStock = product['inStock'] != false;
      _stockQuantity =
          product['stockQuantity'] is int ? product['stockQuantity'] as int : null;
      _shortDescription = (product['shortDescription'] ?? '')
          .toString()
          // The API sends WordPress HTML. Stripping tags is enough for a short
          // description; rendering it properly is a job for a webview, and a
          // webview inside a product page costs more than the formatting is
          // worth.
          .replaceAll(RegExp(r'<[^>]*>'), ' ')
          .replaceAll(RegExp(r'\s+'), ' ')
          .trim();

      final images = product['images'];
      _images = images is List
          ? images.map((e) => e.toString()).where((e) => e.isNotEmpty).toList()
          : <String>[];
      if (_images.isEmpty) {
        final single = (product['image'] ?? '').toString();
        if (single.isNotEmpty) _images = [single];
      }

      _attributes = _KAttribute.listFrom(product['attributes']);
      _related = _KRelated.listFrom(data['related']);
      // A one-value attribute is a fact about the product ("Material: Cotton"),
      // not a question — it is pre-selected rather than asked, which is the
      // same threshold the tile's `hasOptions` uses.
      for (final attribute in _attributes) {
        if (attribute.values.length == 1) {
          _chosen[attribute.name] = attribute.values.first;
        }
      }

      if (seller is Map) _sellerName = seller['name']?.toString();
      if (reviews is Map) {
        _rating = reviews['average'] is num ? reviews['average'] as num : 0;
        _ratingCount = reviews['count'] is int ? reviews['count'] as int : 0;
      }
      if (commerce is Map) {
        _returnsDays =
            commerce['returnsDays'] is int ? commerce['returnsDays'] as int : 0;
        _freeDeliveryFrom = commerce['freeDeliveryFrom'] is num
            ? commerce['freeDeliveryFrom'] as num
            : 0;
      }
    });
  }

  /// Which choices are still outstanding.
  List<String> get _missing => _attributes
      .where((attribute) => !_chosen.containsKey(attribute.name))
      .map((attribute) => attribute.name)
      .toList();

  Future<void> _add() async {
    if (!_inStock || _adding) return;

    // Naming what is missing rather than just disabling the button: a greyed
    // button with no explanation is the most common way a shopper gives up on
    // a product page.
    if (_missing.isNotEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Choose ${_missing.join(' and ')} first'),
          behavior: SnackBarBehavior.floating,
        ),
      );
      return;
    }

    setState(() => _adding = true);

    final variantLabel = _attributes.isEmpty
        ? null
        : _attributes
            .map((a) => '${a.name}: ${_chosen[a.name]}')
            .join(' · ');

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

      // Keyed on id AND variant: the same shoe in two sizes is two lines, and
      // merging on id alone silently drops a size from the order.
      final key = '${_productId}::${variantLabel ?? ''}';
      final index = lines.indexWhere((line) => line['key'] == key);
      if (index >= 0) {
        final current = lines[index]['quantity'];
        lines[index]['quantity'] = (current is int ? current : 1) + 1;
      } else {
        lines.add({
          'key': key,
          'productId': _productId,
          'name': _name,
          'image': _images.isNotEmpty ? _images.first : '',
          'price': _price,
          'priceLabel': _priceLabel,
          'quantity': 1,
          'variantLabel': variantLabel,
        });
      }

      await prefs.setString(_basketKey, jsonEncode(lines));
    } catch (_) {
      // Recoverable — the shopper can tap again. Throwing would take out the
      // screen they are buying from.
    }

    if (!mounted) return;
    setState(() => _adding = false);
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: const Text('Added to basket'),
        behavior: SnackBarBehavior.floating,
        action: SnackBarAction(
          label: 'Basket',
          textColor: Colors.white,
          onPressed: () => Navigator.of(context).push(
            MaterialPageRoute(builder: (_) => const KandiCartScreen()),
          ),
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
          iconTheme: const IconThemeData(color: _KColors.ink),
          title: const Text('Product',
              style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w700,
                  color: _KColors.ink)),
          actions: [
            // Hidden until the product has loaded: a heart over a blank screen
            // saves a product with no name and no price into the list.
            if (!_loading && !_failed)
              IconButton(
                onPressed: _toggleSaved,
                tooltip: _saved ? 'Remove from saved' : 'Save',
                icon: Icon(
                  _saved ? Icons.favorite_rounded : Icons.favorite_border_rounded,
                  color: _saved ? _KColors.primary : _KColors.ink,
                ),
              ),
          ],
        ),
        body: _buildBody(),
        bottomNavigationBar: _loading || _failed ? null : _buildBuyBar(),
      ),
    );
  }

  Widget _buildBody() {
    if (_loading) {
      return const Center(
        child: CircularProgressIndicator(color: _KColors.primary),
      );
    }

    if (_failed) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(_KSpace.xl),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.error_outline_rounded,
                  size: 44, color: _KColors.muted),
              const SizedBox(height: _KSpace.md),
              Text(
                _productId == null
                    ? 'No product was opened'
                    : 'Could not load this product',
                textAlign: TextAlign.center,
                style: const TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w700,
                    color: _KColors.ink),
              ),
              const SizedBox(height: _KSpace.sm),
              Text(
                _productId == null
                    // The honest message for FlutterFlow's own preview, which
                    // opens widgets with no route arguments at all.
                    ? 'Open this screen from a product on the home page.'
                    : 'Check your connection and try again.',
                textAlign: TextAlign.center,
                style: const TextStyle(fontSize: 13.5, color: _KColors.body),
              ),
              if (_productId != null) ...[
                const SizedBox(height: _KSpace.lg),
                FilledButton(
                  onPressed: _load,
                  style: FilledButton.styleFrom(
                      backgroundColor: _KColors.primary),
                  child: const Text('Try again'),
                ),
              ],
            ],
          ),
        ),
      );
    }

    return ListView(
      padding: EdgeInsets.zero,
      children: [
        _buildGallery(),
        Container(
          color: _KColors.panel,
          padding: const EdgeInsets.all(_KSpace.lg),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(_name,
                  style: const TextStyle(
                      fontSize: 17,
                      height: 1.35,
                      fontWeight: FontWeight.w600,
                      color: _KColors.ink)),
              const SizedBox(height: _KSpace.md),
              Row(
                crossAxisAlignment: CrossAxisAlignment.baseline,
                textBaseline: TextBaseline.alphabetic,
                children: [
                  Text(_priceLabel,
                      style: const TextStyle(
                          fontSize: 24,
                          height: 1.1,
                          fontWeight: FontWeight.w800,
                          color: _KColors.ink)),
                  if (_wasPriceLabel != null) ...[
                    const SizedBox(width: _KSpace.sm),
                    Text(_wasPriceLabel!,
                        style: const TextStyle(
                            fontSize: 14,
                            color: _KColors.faint,
                            decoration: TextDecoration.lineThrough)),
                  ],
                  if (_discountPercent > 0) ...[
                    const SizedBox(width: _KSpace.sm),
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 7, vertical: 4),
                      decoration: BoxDecoration(
                        color: _KColors.dealFlag,
                        borderRadius: BorderRadius.circular(_radiusChip),
                      ),
                      child: Text('-$_discountPercent%',
                          style: const TextStyle(
                              fontSize: 12,
                              height: 1,
                              fontWeight: FontWeight.w800,
                              color: _KColors.ink)),
                    ),
                  ],
                ],
              ),
              if (_savingLabel != null) ...[
                const SizedBox(height: _KSpace.sm),
                Container(
                  padding: const EdgeInsets.symmetric(
                      horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: _KColors.saveSoft,
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Text('You save $_savingLabel',
                      style: const TextStyle(
                          fontSize: 12.5,
                          fontWeight: FontWeight.w700,
                          color: _KColors.save)),
                ),
              ],
              if (_ratingCount > 0) ...[
                const SizedBox(height: _KSpace.md),
                Row(
                  children: [
                    const Icon(Icons.star_rounded,
                        size: 17, color: _KColors.star),
                    const SizedBox(width: 3),
                    Text(_rating.toStringAsFixed(1),
                        style: const TextStyle(
                            fontSize: 13.5,
                            fontWeight: FontWeight.w700,
                            color: _KColors.ink)),
                    const SizedBox(width: 5),
                    Text('($_ratingCount reviews)',
                        style: const TextStyle(
                            fontSize: 12.5, color: _KColors.muted)),
                  ],
                ),
              ],
              if (!_inStock) ...[
                const SizedBox(height: _KSpace.md),
                const Text('Out of stock',
                    style: TextStyle(
                        fontSize: 13.5,
                        fontWeight: FontWeight.w700,
                        color: _KColors.ink)),
              ] else if (_stockQuantity != null && _stockQuantity! <= 5) ...[
                const SizedBox(height: _KSpace.md),
                Row(
                  children: [
                    Container(
                      width: 7,
                      height: 7,
                      decoration: const BoxDecoration(
                          color: _KColors.primary, shape: BoxShape.circle),
                    ),
                    const SizedBox(width: 6),
                    Text('Only $_stockQuantity left',
                        style: const TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                            color: _KColors.ink)),
                  ],
                ),
              ],
              if (_sellerName != null) ...[
                const SizedBox(height: _KSpace.md),
                Text('Sold by $_sellerName',
                    style: const TextStyle(
                        fontSize: 12.5, color: _KColors.muted)),
              ],
            ],
          ),
        ),
        if (_attributes.isNotEmpty) _buildOptions(),
        if (_returnsDays > 0 || _freeDeliveryFrom > 0) _buildTerms(),
        if (_shortDescription.isNotEmpty) _buildDescription(),
        if (_related.isNotEmpty) _buildRelated(),
        const SizedBox(height: _KSpace.xl),
      ],
    );
  }

  Widget _buildGallery() {
    if (_images.isEmpty) {
      return Container(
        height: 320,
        color: _KColors.hairline,
        child: const Center(
          child: Icon(Icons.image_not_supported_outlined,
              size: 40, color: _KColors.faint),
        ),
      );
    }

    return Container(
      color: _KColors.panel,
      child: Column(
        children: [
          SizedBox(
            height: 340,
            child: PageView.builder(
              itemCount: _images.length,
              onPageChanged: (index) => setState(() => _gallery = index),
              itemBuilder: (context, index) => CachedNetworkImage(
                imageUrl: _images[index],
                fit: BoxFit.contain,
                placeholder: (_, __) =>
                    const ColoredBox(color: _KColors.hairline),
                errorWidget: (_, __, ___) =>
                    const ColoredBox(color: _KColors.hairline),
              ),
            ),
          ),
          if (_images.length > 1)
            Padding(
              padding: const EdgeInsets.only(bottom: _KSpace.md),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  for (int i = 0; i < _images.length; i++)
                    Container(
                      width: i == _gallery ? 18 : 6,
                      height: 6,
                      margin: const EdgeInsets.symmetric(horizontal: 3),
                      decoration: BoxDecoration(
                        color:
                            i == _gallery ? _KColors.primary : _KColors.line,
                        borderRadius: BorderRadius.circular(3),
                      ),
                    ),
                ],
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildOptions() {
    return Container(
      margin: const EdgeInsets.only(top: _KSpace.md),
      color: _KColors.panel,
      padding: const EdgeInsets.all(_KSpace.lg),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          for (final attribute in _attributes) ...[
            Row(
              children: [
                Text(attribute.name,
                    style: const TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w700,
                        color: _KColors.ink)),
                const SizedBox(width: 6),
                // The chosen value beside the label, so a scrolled-past choice
                // is still readable without scrolling back.
                if (_chosen[attribute.name] != null)
                  Text(_chosen[attribute.name]!,
                      style: const TextStyle(
                          fontSize: 13, color: _KColors.muted)),
              ],
            ),
            const SizedBox(height: _KSpace.sm),
            Wrap(
              spacing: _KSpace.sm,
              runSpacing: _KSpace.sm,
              children: [
                for (final value in attribute.values)
                  _OptionChip(
                    label: value,
                    selected: _chosen[attribute.name] == value,
                    onTap: () =>
                        setState(() => _chosen[attribute.name] = value),
                  ),
              ],
            ),
            const SizedBox(height: _KSpace.lg),
          ],
        ],
      ),
    );
  }

  Widget _buildTerms() {
    return Container(
      margin: const EdgeInsets.only(top: _KSpace.md),
      color: _KColors.panel,
      padding: const EdgeInsets.all(_KSpace.lg),
      child: Column(
        children: [
          if (_freeDeliveryFrom > 0)
            _TermRow(
              icon: Icons.local_shipping_outlined,
              title: 'Free delivery over ${_money(_freeDeliveryFrom)}',
              detail: 'Countrywide, pay on delivery available',
            ),
          if (_returnsDays > 0) ...[
            const SizedBox(height: _KSpace.md),
            _TermRow(
              icon: Icons.assignment_return_outlined,
              title: '$_returnsDays-day returns',
              detail: 'Faulty or wrong, we cover the courier both ways',
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildDescription() {
    return Container(
      margin: const EdgeInsets.only(top: _KSpace.md),
      color: _KColors.panel,
      padding: const EdgeInsets.all(_KSpace.lg),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('About this item',
              style: TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w700,
                  color: _KColors.ink)),
          const SizedBox(height: _KSpace.sm),
          Text(_shortDescription,
              style: const TextStyle(
                  fontSize: 13.5, height: 1.5, color: _KColors.body)),
        ],
      ),
    );
  }

  /// Other products in the same category, at the foot of the page.
  Widget _buildRelated() {
    return Container(
      margin: const EdgeInsets.only(top: _KSpace.md),
      color: _KColors.panel,
      padding: const EdgeInsets.symmetric(vertical: _KSpace.lg),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Padding(
            padding: EdgeInsets.symmetric(horizontal: _KSpace.lg),
            child: Text('You might also like',
                style: TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w800,
                    color: _KColors.ink)),
          ),
          const SizedBox(height: _KSpace.md),
          SizedBox(
            height: 196,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: _KSpace.lg),
              itemCount: _related.length,
              separatorBuilder: (_, __) => const SizedBox(width: _KSpace.md),
              itemBuilder: (context, index) {
                final item = _related[index];
                return SizedBox(
                  width: 124,
                  child: GestureDetector(
                    // Replaces this screen rather than stacking another on top.
                    // Browsing sideways through six related products should not
                    // leave six product pages on the back stack, so that one
                    // back tap returns to where the shopper actually came from.
                    onTap: () => _openRelated(item),
                    behavior: HitTestBehavior.opaque,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        ClipRRect(
                          borderRadius: BorderRadius.circular(_radiusChip),
                          child: SizedBox(
                            width: 124,
                            height: 124,
                            child: item.image.isEmpty
                                ? const ColoredBox(color: _KColors.hairline)
                                : CachedNetworkImage(
                                    imageUrl: item.image,
                                    fit: BoxFit.contain,
                                    placeholder: (_, __) => const ColoredBox(
                                        color: _KColors.hairline),
                                    errorWidget: (_, __, ___) =>
                                        const ColoredBox(
                                            color: _KColors.hairline),
                                  ),
                          ),
                        ),
                        const SizedBox(height: 6),
                        Text(item.name,
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                                fontSize: 12, height: 1.3, color: _KColors.ink)),
                        const SizedBox(height: 3),
                        Text(item.priceLabel,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                                fontSize: 13.5,
                                fontWeight: FontWeight.w800,
                                color: _KColors.ink)),
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

  /// Opens another product IN PLACE.
  ///
  /// `pushReplacement` with the id written first, so the replacement screen
  /// reads the new id in its own `initState` exactly as a fresh open would.
  Future<void> _openRelated(_KRelated item) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_openProductKey, '${item.id}');
    } catch (_) {
      return;
    }
    if (!mounted) return;
    await Navigator.of(context).pushReplacement(
      MaterialPageRoute(builder: (_) => const KandiProductScreen()),
    );
  }

  Widget _buildBuyBar() {
    final blocked = !_inStock;
    return Container(
      padding: EdgeInsets.fromLTRB(
        _KSpace.lg,
        _KSpace.md,
        _KSpace.lg,
        // Clears the home indicator on a gesture-navigation phone, where a
        // fixed bar otherwise sits under the system handle.
        _KSpace.md + MediaQuery.of(context).padding.bottom,
      ),
      decoration: const BoxDecoration(
        color: _KColors.panel,
        border: Border(top: BorderSide(color: _KColors.line)),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(_priceLabel,
                    style: const TextStyle(
                        fontSize: 18,
                        height: 1.1,
                        fontWeight: FontWeight.w800,
                        color: _KColors.ink)),
                if (_missing.isNotEmpty)
                  Padding(
                    padding: const EdgeInsets.only(top: 2),
                    child: Text('Choose ${_missing.join(' and ')}',
                        style: const TextStyle(
                            fontSize: 11.5, color: _KColors.muted)),
                  ),
              ],
            ),
          ),
          const SizedBox(width: _KSpace.md),
          SizedBox(
            height: 48,
            width: 170,
            child: FilledButton(
              onPressed: blocked || _adding ? null : _add,
              style: FilledButton.styleFrom(
                backgroundColor: _KColors.primary,
                disabledBackgroundColor: _KColors.line,
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(_radiusChip)),
              ),
              child: Text(
                blocked ? 'Out of stock' : 'Add to basket',
                style: const TextStyle(
                    fontSize: 15, fontWeight: FontWeight.w700),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _OptionChip extends StatelessWidget {
  const _OptionChip({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(_radiusChip),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        decoration: BoxDecoration(
          // Selected is a filled tint with a brand border, not a colour swap on
          // the text alone: at a glance a shopper has to see WHICH size is
          // chosen, and a one-shade text difference does not carry that.
          color: selected ? _KColors.primarySoft : _KColors.panel,
          borderRadius: BorderRadius.circular(_radiusChip),
          border: Border.all(
            color: selected ? _KColors.primary : _KColors.line,
            width: selected ? 1.6 : 1.2,
          ),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 13.5,
            fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
            color: _KColors.ink,
          ),
        ),
      ),
    );
  }
}

class _TermRow extends StatelessWidget {
  const _TermRow({
    required this.icon,
    required this.title,
    required this.detail,
  });

  final IconData icon;
  final String title;
  final String detail;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          width: 36,
          height: 36,
          decoration: const BoxDecoration(
              color: _KColors.primarySoft, shape: BoxShape.circle),
          child: Icon(icon, size: 18, color: _KColors.primary),
        ),
        const SizedBox(width: _KSpace.md),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(title,
                  style: const TextStyle(
                      fontSize: 13.5,
                      fontWeight: FontWeight.w700,
                      color: _KColors.ink)),
              const SizedBox(height: 2),
              Text(detail,
                  style: const TextStyle(
                      fontSize: 12, height: 1.35, color: _KColors.muted)),
            ],
          ),
        ),
      ],
    );
  }
}
