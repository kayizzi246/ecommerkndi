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

// Navigation only. No design, model or helper is shared between pages.
import '/custom_code/widgets/kandi_cart_screen.dart';
import '/custom_code/widgets/kandi_checkout_screen.dart';

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
  static const Color canvas = Color(0xFFF5F5F5);
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

  /// The discount flag and the delivery badge. Black on it is 11:1, the most
  /// legible pairing the palette can manage at 9px.
  static const Color express = Color(0xFFFFE000);
  static const Color saveSoft = Color(0xFFECFDF3);

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
  static const Color flameSoft = Color(0xFFFFF1ED);
}

class _KSpace {
  const _KSpace._();
  static const double sm = 8;
  static const double md = 12;
  static const double lg = 16;
  static const double xl = 24;
}

const double _rChip = 8;

/// Panel and photograph corners. This page had neither until it grew a price
/// card and a grid of tiles; both match the rest of the app.
const double _rPanel = 12;
const double _rPhoto = 8;

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
    required this.price,
    this.wasPriceLabel,
    this.savingLabel,
    this.discountPercent = 0,
    this.inStock = true,
    this.stockQuantity,
    this.rating = 0,
    this.ratingCount = 0,
    this.totalSales = 0,
    this.isNew = false,
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

  /// Units left, when WooCommerce is tracking stock for this one. Null means
  /// "not tracked", which is a different thing from zero.
  final int? stockQuantity;
  final num rating;
  final int ratingCount;
  final int totalSales;
  final bool isNew;
  final bool hasOptions;

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
        price: entry['price'] is num ? entry['price'] as num : 0,
        wasPriceLabel: entry['wasPriceLabel']?.toString(),
        savingLabel: entry['savingLabel']?.toString(),
        discountPercent: entry['discountPercent'] is int
            ? entry['discountPercent'] as int
            : 0,
        inStock: entry['inStock'] != false,
        stockQuantity:
            entry['stockQuantity'] is int ? entry['stockQuantity'] as int : null,
        rating: entry['rating'] is num ? entry['rating'] as num : 0,
        ratingCount:
            entry['ratingCount'] is int ? entry['ratingCount'] as int : 0,
        totalSales:
            entry['totalSales'] is int ? entry['totalSales'] as int : 0,
        isNew: entry['isNew'] == true,
        hasOptions: entry['hasOptions'] == true,
      ));
    }
    return out;
  }
}

// ---- The saved list, and adding a recommendation to the basket ----
//
// The same key and the same shape the other pages use. Duplicated rather than
// imported, like everything else here.
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

Future<bool> _toggleWishlistItem(_KRelated item) async {
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
    final index = items.indexWhere((entry) => entry['id'] == item.id);
    final added = index < 0;
    if (added) {
      items.add({
        'id': item.id,
        'name': item.name,
        'image': item.image,
        'priceLabel': item.priceLabel,
        'price': item.price,
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

/// Puts a recommendation straight in the basket.
///
/// Keyed with an empty variant, exactly as the grids do it — a product with
/// options never reaches here, because its card opens the product instead of
/// adding it.
Future<void> _addRelatedToBasket(_KRelated item) async {
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
    final key = '${item.id}::';
    final index = lines.indexWhere((line) => line['key'] == key);
    if (index >= 0) {
      final current = lines[index]['quantity'];
      lines[index]['quantity'] = (current is int ? current : 1) + 1;
    } else {
      lines.add({
        'key': key,
        'productId': item.id,
        'name': item.name,
        'image': item.image,
        'price': item.price,
        'priceLabel': item.priceLabel,
        'quantity': 1,
        'variantLabel': null,
      });
    }
    await prefs.setString(_basketKey, jsonEncode(lines));
  } catch (_) {}
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

  /// How many have sold. The one figure on this page that is about other
  /// shoppers rather than about the shop, and the API has been sending it.
  int _totalSales = 0;

  /// Which of the recommendations below are already in the saved list, so
  /// their hearts are filled on arrival rather than after the first tap.
  Set<int> _relatedSaved = <int>{};
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
    _refreshRelatedSaved();
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

      _totalSales =
          product['totalSales'] is int ? product['totalSales'] as int : 0;
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

  /// Puts the product in the basket.
  ///
  /// `thenCheckout` is the "Buy now" path. It is the SAME write — the basket
  /// is the only thing checkout reads — followed by a push, rather than a
  /// second express route through the shop. One code path means a shopper
  /// cannot end up with an order that the basket does not agree with.
  Future<void> _add({bool thenCheckout = false}) async {
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

    if (thenCheckout) {
      // No snackbar on this path: the next screen IS the confirmation, and a
      // toast that arrives on top of it is a message about a screen the
      // shopper has already left.
      await Navigator.of(context).push(
        MaterialPageRoute(builder: (_) => const KandiCheckoutScreen()),
      );
      return;
    }

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
        // ---- The bar floats ON the photograph ----
        //
        // `extendBodyBehindAppBar` puts the gallery under it, so the picture
        // runs to the very top of the screen and the two controls sit on it as
        // discs. That is what the reference does, and it buys back the 56px a
        // solid bar was spending to say "Product" — a heading that told a
        // shopper looking at a photograph of the product nothing.
        //
        // The status-bar icons go DARK here, unlike everywhere else in the
        // app: this bar has no gradient behind it any more, and this
        // catalogue is photographed on white.
        extendBodyBehindAppBar: true,
        appBar: AppBar(
          backgroundColor: Colors.transparent,
          surfaceTintColor: Colors.transparent,
          elevation: 0,
          scrolledUnderElevation: 0,
          systemOverlayStyle: SystemUiOverlayStyle.dark,
          leadingWidth: 52,
          leading: Center(
            child: _GlassButton(
              icon: Icons.arrow_back_rounded,
              tooltip: 'Back',
              onTap: () => Navigator.of(context).maybePop(),
            ),
          ),
          actions: [
            // Hidden until the product has loaded: a heart over a blank screen
            // saves a product with no name and no price into the list.
            if (!_loading && !_failed)
              Padding(
                padding: const EdgeInsets.only(right: _KSpace.sm),
                child: Center(
                  child: _GlassButton(
                    icon: _saved
                        ? Icons.favorite_rounded
                        : Icons.favorite_border_rounded,
                    tint: _saved ? _KColors.flame : _KColors.ink,
                    tooltip: _saved ? 'Remove from saved' : 'Save',
                    onTap: _toggleSaved,
                  ),
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
                      backgroundColor: _KColors.flame),
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
        // ---- The price banner ----
        //
        // The price leads the page and the name follows it, which is the
        // reverse of what this used to be. A shopper who has scrolled to a
        // product already knows roughly what it is — the picture told them —
        // and the one fact they came for is what it costs.
        //
        // The banner around it only appears when there IS a reduction. A
        // permanent "SALE" strip on every product is a sale on nothing, and a
        // shop that always says it is having one is a shop nobody hurries in.
        Padding(
          padding: const EdgeInsets.fromLTRB(
              _KSpace.md, _KSpace.md, _KSpace.md, 0),
          child: Container(
            decoration: BoxDecoration(
              gradient: _discountPercent > 0 ? _brandGradient : null,
              color: _discountPercent > 0 ? null : _KColors.panel,
              borderRadius: BorderRadius.circular(_rPanel),
            ),
            padding: EdgeInsets.all(_discountPercent > 0 ? 3 : 0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (_discountPercent > 0)
                  Padding(
                    padding: const EdgeInsets.fromLTRB(11, 5, 11, 7),
                    child: Row(
                      children: [
                        const Text('PRICE DROP',
                            style: TextStyle(
                                fontSize: 12,
                                height: 1.1,
                                letterSpacing: 0.4,
                                fontWeight: FontWeight.w900,
                                color: Colors.white)),
                        const Spacer(),
                        Text('-$_discountPercent%',
                            style: const TextStyle(
                                fontSize: 12,
                                height: 1.1,
                                fontWeight: FontWeight.w900,
                                color: Colors.white)),
                      ],
                    ),
                  ),
                Container(
                  width: double.infinity,
                  decoration: BoxDecoration(
                    color: _KColors.panel,
                    borderRadius: BorderRadius.circular(_rPanel - 2),
                  ),
                  padding: const EdgeInsets.all(_KSpace.lg),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.baseline,
                        textBaseline: TextBaseline.alphabetic,
                        children: [
                          Flexible(
                            child: _Price(
                              label: _priceLabel,
                              reduced: _discountPercent > 0,
                              size: 30,
                            ),
                          ),
                          if (_wasPriceLabel != null) ...[
                            const SizedBox(width: _KSpace.sm),
                            Text(_wasPriceLabel!,
                                style: const TextStyle(
                                    fontSize: 14,
                                    color: _KColors.muted,
                                    decoration: TextDecoration.lineThrough)),
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
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: _KSpace.md),
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
              if (_ratingCount > 0 || _totalSales > 0) ...[
                const SizedBox(height: _KSpace.md),
                Row(
                  children: [
                    if (_ratingCount > 0) ...[
                      _Stars(rating: _rating, size: 15),
                      const SizedBox(width: 5),
                      Text(_rating.toStringAsFixed(1),
                          style: const TextStyle(
                              fontSize: 13.5,
                              fontWeight: FontWeight.w700,
                              color: _KColors.ink)),
                      const SizedBox(width: 4),
                      Text('($_ratingCount)',
                          style: const TextStyle(
                              fontSize: 12.5, color: _KColors.muted)),
                    ],
                    if (_ratingCount > 0 && _totalSales > 0)
                      const Padding(
                        padding: EdgeInsets.symmetric(horizontal: 7),
                        child: Text('|',
                            style: TextStyle(
                                fontSize: 12.5, color: _KColors.line)),
                      ),
                    if (_totalSales > 0)
                      Text('$_totalSales sold',
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
        height: 420,
        color: _KColors.hairline,
        child: const Center(
          child: Icon(Icons.image_not_supported_outlined,
              size: 40, color: _KColors.faint),
        ),
      );
    }

    // ---- Full bleed, and taller ----
    //
    // The bar floats on top of this now, so the picture runs to the top of the
    // screen. 420 rather than 340 because roughly 90px of it is under the
    // status bar and the toolbar, and the product should not be crowded into
    // what is left.
    //
    // The page counter moved ONTO the picture as a pill. As a row of its own
    // it cost 22px on every product to say something two thirds of them —
    // the single-image ones — never needed to say at all.
    return Container(
      color: _KColors.panel,
      child: Stack(
        children: [
          SizedBox(
            height: 420,
            width: double.infinity,
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
            Positioned(
              bottom: _KSpace.md,
              right: _KSpace.md,
              child: Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
                decoration: BoxDecoration(
                  color: const Color(0x8A000000),
                  borderRadius: BorderRadius.circular(_rPill),
                ),
                child: Text("${_gallery + 1}/${_images.length}",
                    style: const TextStyle(
                        fontSize: 11.5,
                        height: 1.1,
                        fontWeight: FontWeight.w700,
                        color: Colors.white)),
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
  /// ---- The recommendation grid ----
  ///
  /// This was a horizontal strip of six thumbnails with a name and a price.
  /// It is now the shop's own tile, two across, running to the foot of the
  /// page — which is what the reference does and what the strip could never
  /// do: a sideways row shows three products and asks the shopper to work for
  /// the rest, and the foot of a product page is exactly where somebody who
  /// has decided against THIS one is looking for another.
  ///
  /// The tiles are the real thing, not a cut-down copy: the discount flag, the
  /// deal strip, the sold count, the heart and the basket button all work
  /// here. The API has always sent the whole product shape for these; the old
  /// model was reading four fields of it.
  Widget _buildRelated() {
    return Container(
      margin: const EdgeInsets.only(top: _KSpace.md),
      // The page ground, not white — these are white tiles, and white tiles on
      // a white panel have no edges.
      color: _KColors.canvas,
      padding: const EdgeInsets.fromLTRB(
          _KSpace.md, _KSpace.lg, _KSpace.md, _KSpace.lg),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
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
              const Text('You may also like',
                  style: TextStyle(
                      fontSize: 17,
                      letterSpacing: -0.2,
                      fontWeight: FontWeight.w900,
                      color: _KColors.ink)),
            ],
          ),
          const SizedBox(height: _KSpace.md),
          GridView.builder(
            // Inside the page's own ListView, so it must not scroll and must
            // take exactly the height of its rows.
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            padding: EdgeInsets.zero,
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 2,
              mainAxisSpacing: _KSpace.md,
              crossAxisSpacing: _KSpace.md,
              // The same 300px tile the rest of the app draws, added up row by
              // row. See the note in SETUP.md before changing it.
              childAspectRatio: 0.57,
            ),
            itemCount: _related.length,
            itemBuilder: (context, index) {
              final item = _related[index];
              return _Card(
                product: item,
                freeDeliveryFrom: _freeDeliveryFrom,
                saved: _relatedSaved.contains(item.id),
                onOpen: () => _openRelated(item),
                onAdd: () => _addRelated(item),
                onSave: () => _toggleRelatedSaved(item),
              );
            },
          ),
        ],
      ),
    );
  }

  Future<void> _refreshRelatedSaved() async {
    final ids = await _readWishlistIds();
    if (mounted) setState(() => _relatedSaved = ids);
  }

  Future<void> _toggleRelatedSaved(_KRelated item) async {
    final added = await _toggleWishlistItem(item);
    if (!mounted) return;
    setState(() {
      if (added) {
        _relatedSaved.add(item.id);
      } else {
        _relatedSaved.remove(item.id);
      }
      // A recommendation can be the product this page is showing, on a page
      // reached from another recommendation — so the bar's heart has to agree
      // with the tile's.
      if (item.id == _productId) _saved = added;
    });
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(added ? 'Saved' : 'Removed from saved'),
        duration: const Duration(seconds: 1),
        behavior: SnackBarBehavior.floating,
      ),
    );
  }

  Future<void> _addRelated(_KRelated item) async {
    await _addRelatedToBasket(item);
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('${item.name} added'),
        duration: const Duration(seconds: 2),
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
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Named above the buttons rather than beside them. A greyed button
          // with no explanation is the most common way a shopper gives up on a
          // product page, and with two buttons there is no longer a column
          // free to put the reason in.
          if (_missing.isNotEmpty && !blocked) ...[
            Row(
              children: [
                const Icon(Icons.info_outline_rounded,
                    size: 15, color: _KColors.flame),
                const SizedBox(width: 5),
                Expanded(
                  child: Text('Choose ${_missing.join(' and ')} first',
                      style: const TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                          color: _KColors.flame)),
                ),
              ],
            ),
            const SizedBox(height: _KSpace.sm),
          ],
          Row(
            children: [
              // ---- Basket, then buy ----
              //
              // Two calls to action, in the order a shopper reads: the
              // cautious one on the left, the committing one on the right,
              // under the thumb. They are not the same weight — "Buy now"
              // carries the gradient and "Add to basket" carries an outline in
              // the same colour — because two identical buttons side by side
              // is a choice a shopper has to stop and make, and stopping is
              // the thing this bar exists to prevent.
              _BasketOrBuy(
                label: blocked ? 'Out of stock' : 'Add to basket',
                filled: false,
                enabled: !blocked && !_adding,
                onTap: _add,
              ),
              if (!blocked) ...[
                const SizedBox(width: _KSpace.sm),
                _BasketOrBuy(
                  label: 'Buy now',
                  filled: true,
                  enabled: !_adding,
                  onTap: () => _add(thenCheckout: true),
                ),
              ],
            ],
          ),
        ],
      ),
    );
  }
}

/// One of the two buttons on the buy bar.
///
/// A pill, not a rounded rectangle — the pill is what separates a call to
/// action from the panels and chips everywhere else in the app.
class _BasketOrBuy extends StatelessWidget {
  const _BasketOrBuy({
    required this.label,
    required this.filled,
    required this.enabled,
    required this.onTap,
  });

  final String label;
  final bool filled;
  final bool enabled;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: GestureDetector(
        onTap: enabled ? onTap : null,
        behavior: HitTestBehavior.opaque,
        child: Opacity(
          opacity: enabled ? 1 : 0.45,
          child: Container(
            height: 46,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              gradient: filled ? _brandGradient : null,
              color: filled ? null : _KColors.panel,
              borderRadius: BorderRadius.circular(_rPill),
              border: filled
                  ? null
                  : Border.all(color: _KColors.flame, width: 1.4),
            ),
            child: Text(
              label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                  fontSize: 14.5,
                  fontWeight: FontWeight.w800,
                  color: filled ? Colors.white : _KColors.flame),
            ),
          ),
        ),
      ),
    );
  }
}


/// The shop's product tile.
///
/// A copy of the one the grids draw. Nothing crosses a file boundary in this
/// app — see the note at the head of kandi_home_screen.dart — so this page
/// carries its own, and the two have to be kept in step by hand.
class _Card extends StatelessWidget {
  const _Card({
    required this.product,
    required this.freeDeliveryFrom,
    required this.saved,
    required this.onOpen,
    required this.onAdd,
    required this.onSave,
  });

  final _KRelated product;
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

  bool get _freeDelivery =>
      freeDeliveryFrom > 0 && product.price >= freeDeliveryFrom;

  /// The strip across the bottom of the photograph.
  ///
  /// This is where the shilling saving went. It would not fit beside the old
  /// price — "UGX 55,000  Save UGX 19,000" is about 170px of text in a 154px
  /// card — and it is the figure a Ugandan shopper actually weighs, more than
  /// a percentage. On the photograph it costs the card no height at all.
  ///
  /// Suppressed when the product is out of stock: a saving on something that
  /// cannot be bought is noise, and the corner is needed for the sold-out
  /// mark instead.
  String? get _ribbon {
    if (!product.inStock) return null;
    final parts = <String>[
      if (product.savingLabel != null) 'SAVE ${product.savingLabel}',
      if (_freeDelivery) 'FREE DELIVERY',
    ];
    return parts.isEmpty ? null : parts.join(' · ');
  }

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

  @override
  Widget build(BuildContext context) {
    final chip = _chip;

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
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(_rPhoto),
                  child: Stack(
                    fit: StackFit.expand,
                    children: [
                      _TilePhoto(url: product.image),
                      Positioned(
                        top: 4,
                        left: 4,
                        child: GestureDetector(
                          onTap: onSave,
                          behavior: HitTestBehavior.opaque,
                          child: Container(
                            width: 30,
                            height: 30,
                            decoration: BoxDecoration(
                              color: const Color(0xF2FFFFFF),
                              shape: BoxShape.circle,
                              border: Border.all(color: _KColors.line),
                            ),
                            child: Icon(
                              saved
                                  ? Icons.favorite_rounded
                                  : Icons.favorite_border_rounded,
                              size: 17,
                              color: saved ? _KColors.flame : _KColors.body,
                            ),
                          ),
                        ),
                      ),
                      if (product.inStock && product.discountPercent > 0)
                        Positioned(
                          top: 4,
                          right: 4,
                          child: Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 7, vertical: 4),
                            decoration: BoxDecoration(
                              color: _KColors.express,
                              borderRadius: BorderRadius.circular(_rChip),
                            ),
                            child: Text('-${product.discountPercent}%',
                                style: const TextStyle(
                                    fontSize: 11,
                                    height: 1,
                                    fontWeight: FontWeight.w800,
                                    color: _KColors.ink)),
                          ),
                        ),
                      if (!product.inStock)
                        Positioned(
                          top: 4,
                          right: 4,
                          child: Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 7, vertical: 4),
                            decoration: BoxDecoration(
                              color: _KColors.ink,
                              borderRadius: BorderRadius.circular(_rChip),
                            ),
                            child: const Text('Sold out',
                                style: TextStyle(
                                    fontSize: 10,
                                    height: 1,
                                    fontWeight: FontWeight.w800,
                                    color: Colors.white)),
                          ),
                        ),
                      if (_ribbon != null)
                        Positioned(
                          left: 0,
                          right: 0,
                          bottom: 0,
                          child: Container(
                            padding:
                                const EdgeInsets.fromLTRB(7, 3.5, 44, 3.5),
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
                          bottom: 4,
                          right: 4,
                          child: GestureDetector(
                            onTap: product.hasOptions ? onOpen : onAdd,
                            behavior: HitTestBehavior.opaque,
                            child: Container(
                              width: 34,
                              height: 34,
                              decoration: BoxDecoration(
                                color: _KColors.panel,
                                shape: BoxShape.circle,
                                border: Border.all(color: _KColors.line),
                              ),
                              child: Icon(
                                  product.hasOptions
                                      ? Icons.tune_rounded
                                      : Icons.add_shopping_cart_rounded,
                                  size: 18,
                                  color: _KColors.ink),
                            ),
                          ),
                        ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: _KSpace.sm),

              // The programme chip rides the name rather than sitting on the
              // photograph, so it costs the card no height. `WidgetSpan` puts
              // it in the same run as the text, which is what makes the name
              // wrap around it instead of under it.
              RichText(
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                text: TextSpan(
                  style: const TextStyle(
                      fontSize: 12.5, height: 1.35, color: _KColors.ink),
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
                                    fontSize: 9.5,
                                    height: 1.2,
                                    fontWeight: FontWeight.w800,
                                    color: chip.foreground)),
                          ),
                        ),
                      ),
                    TextSpan(text: product.name),
                  ],
                ),
              ),
              const SizedBox(height: 5),

              // ---- What other people did, ABOVE what it costs ----
              //
              // The reference's order, and it is the right one. A shopper
              // scanning a grid decides whether a tile is worth reading at all
              // from the sold count and the stars, and only then reads the
              // price. This card had the price first and the crowd last, which
              // is the order the shop cares about, not the order they read in.
              //
              // Drawn only when there is a number to carry. A row that renders
              // empty on most tiles is a row of debris at forty different
              // heights down the grid.
              if (product.totalSales > 0 || product.ratingCount > 0) ...[
                Row(
                  children: [
                    if (product.totalSales > 0)
                      Text('${product.totalSales} sold',
                          style: const TextStyle(
                              fontSize: 11, color: _KColors.muted)),
                    if (product.totalSales > 0 && product.ratingCount > 0)
                      const Padding(
                        padding: EdgeInsets.symmetric(horizontal: 5),
                        child: Text('|',
                            style:
                                TextStyle(fontSize: 11, color: _KColors.line)),
                      ),
                    if (product.ratingCount > 0) ...[
                      _Stars(rating: product.rating, size: 11),
                      const SizedBox(width: 3),
                      Text(product.rating.toStringAsFixed(1),
                          style: const TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w700,
                              color: _KColors.ink)),
                      const SizedBox(width: 2),
                      Flexible(
                        child: Text('(${product.ratingCount})',
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                                fontSize: 11, color: _KColors.muted)),
                      ),
                    ],
                  ],
                ),
                const SizedBox(height: 4),
              ],

              _Price(
                label: product.priceLabel,
                reduced: product.discountPercent > 0,
                size: 17,
              ),
              if (product.wasPriceLabel != null)
                Padding(
                  padding: const EdgeInsets.only(top: 2),
                  child: Text(product.wasPriceLabel!,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                          fontSize: 11,
                          color: _KColors.faint,
                          decoration: TextDecoration.lineThrough)),
                ),

              // ---- The scarcity line, and the bar under it ----
              //
              // The same fact drawn twice, on purpose: "Only 2 left" is a
              // number a shopper weighs against nothing, and a bar two-fifths
              // full is a quantity they read without stopping.
              //
              // The bar's full width is the low-stock threshold, not an
              // invented starting stock — it begins the moment the product
              // becomes scarce and empties from there, so it can never claim
              // "nearly gone" about a product with plenty in the back.
              if (_lowStock) ...[
                const SizedBox(height: 5),
                Row(
                  children: [
                    Container(
                      width: 6,
                      height: 6,
                      decoration: const BoxDecoration(
                          color: _KColors.primary, shape: BoxShape.circle),
                    ),
                    const SizedBox(width: 5),
                    Text('Only ${product.stockQuantity} left',
                        style: const TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w600,
                            color: _KColors.body)),
                  ],
                ),
                const SizedBox(height: 4),
                ClipRRect(
                  borderRadius: BorderRadius.circular(2),
                  child: SizedBox(
                    width: 78,
                    height: 3,
                    child: LinearProgressIndicator(
                      value: (product.stockQuantity! / _lowStockAt)
                          .clamp(0.12, 1.0)
                          .toDouble(),
                      backgroundColor: _KColors.hairline,
                      valueColor:
                          const AlwaysStoppedAnimation<Color>(_KColors.primary),
                    ),
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

/// The picture inside a tile.
///
/// Named apart from the gallery's image so the two cannot be confused: this
/// one is a 155px square that must never crop, the gallery's is 400px tall.
class _TilePhoto extends StatelessWidget {
  const _TilePhoto({required this.url});
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

/// A round white button that floats on the product photograph.
///
/// Slightly translucent with a soft shadow, so it stays findable over a dark
/// picture and over a white one. The 36px disc is the whole hit area.
class _GlassButton extends StatelessWidget {
  const _GlassButton({
    required this.icon,
    required this.tooltip,
    required this.onTap,
    this.tint = _KColors.ink,
  });

  final IconData icon;
  final String tooltip;
  final VoidCallback onTap;
  final Color tint;

  @override
  Widget build(BuildContext context) {
    return Tooltip(
      message: tooltip,
      child: GestureDetector(
        onTap: onTap,
        behavior: HitTestBehavior.opaque,
        child: Container(
          width: 36,
          height: 36,
          // A drawn ring as well as a shadow. The bar stays transparent all
          // the way down the page, so once a shopper has scrolled past the
          // photograph these discs are white on white — the same problem the
          // basket button on a tile has, and the same answer.
          decoration: BoxDecoration(
            color: const Color(0xF2FFFFFF),
            shape: BoxShape.circle,
            border: Border.all(color: _KColors.line),
            boxShadow: const [
              BoxShadow(color: Color(0x1F000000), blurRadius: 8),
            ],
          ),
          child: Icon(icon, size: 20, color: tint),
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

/// A price, with the currency set smaller than the figure.
///
/// The API sends one string — "UGX 36,000" — and this splits it at the first
/// space, then closes the gap. The unit is the part a Ugandan shopper already
/// knows; the number is what they came for, and setting both at the same size
/// makes the number harder to find.
///
/// ---- Red means REDUCED ----
///
/// Not "red means price". Every price in the money colour is the same as none
/// of them in it — the colour stops carrying anything. A full price is set in
/// ink and a cut one in red, which puts the colour in agreement with the
/// yellow flag on the photograph instead of shouting over it.
class _Price extends StatelessWidget {
  const _Price({required this.label, required this.reduced, this.size = 17});

  final String label;
  final bool reduced;
  final double size;

  @override
  Widget build(BuildContext context) {
    final space = label.indexOf(' ');
    final unit = space > 0 ? label.substring(0, space) : '';
    final figure = space > 0 ? label.substring(space + 1) : label;
    final colour = reduced ? _KColors.flame : _KColors.ink;

    return RichText(
      maxLines: 1,
      overflow: TextOverflow.ellipsis,
      text: TextSpan(
        style: TextStyle(
          fontWeight: FontWeight.w900,
          letterSpacing: -0.3,
          height: 1.15,
          color: colour,
        ),
        children: [
          if (unit.isNotEmpty)
            TextSpan(text: unit, style: TextStyle(fontSize: size * 0.66)),
          TextSpan(text: figure, style: TextStyle(fontSize: size)),
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
      borderRadius: BorderRadius.circular(_rChip),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        decoration: BoxDecoration(
          // Selected is a filled tint with a brand border, not a colour swap on
          // the text alone: at a glance a shopper has to see WHICH size is
          // chosen, and a one-shade text difference does not carry that.
          color: selected ? _KColors.flameSoft : _KColors.panel,
          borderRadius: BorderRadius.circular(_rChip),
          border: Border.all(
            color: selected ? _KColors.flame : _KColors.line,
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
