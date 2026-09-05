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
import 'dart:async';
import 'dart:convert';

import 'package:flutter/services.dart';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

// Navigation only.
import '/custom_code/widgets/kandi_product_screen.dart';
import '/custom_code/widgets/kandi_cart_screen.dart';

// ============================================================
//  KANDI — SEARCH PAGE
//
//  Self-contained like every page here: its own palette, HTTP
//  and model, all file-private. The architecture is written out
//  in full at the head of kandi_home_screen.dart.
//
//  ---- Nothing is passed in ----
//
//  The term to run, if there is one, is read from
//  `kandi-open-search` on the device. Home writes an empty
//  string when the shopper taps the search bar, which opens
//  this page with the keyboard up and no results yet — the
//  correct state for "I want to search" as distinct from "show
//  me these results".
//
//  ---- Typing does not search ----
//
//  There is a 400ms debounce and a minimum of two characters.
//  A request per keystroke on a Ugandan mobile connection means
//  the answer to "sho" arrives after the answer to "shoes" and
//  overwrites it, which is the classic way a search box ends up
//  showing results for a prefix of what is in the field.
//  `_generation` guards the same race for the responses that do
//  come back out of order.
// ============================================================

class _KColors {
  const _KColors._();
  static const Color canvas = Color(0xFFFFFFFF);
  static const Color panel = Color(0xFFFFFFFF);
  static const Color ink = Color(0xFF0B0B0B);
  static const Color body = Color(0xFF414346);
  static const Color muted = Color(0xFF5D6066);
  static const Color faint = Color(0xFF8E9196);
  static const Color line = Color(0xFFE0E0E0);
  static const Color primary = Color(0xFFFF6A00);
  static const Color save = Color(0xFF15803D);
  static const Color express = Color(0xFFFFE000);


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
  static const double sm = 8;
  static const double md = 12;
  static const double xl = 24;
}


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

// The keys every page in this app agrees on. Repeated verbatim in each file;
// if one changes it must change in all of them at once.
const String _basketKey = 'kandi-cart-v1';
const String _wishlistKey = 'kandi-wishlist-v1';
const String _openProductKey = 'kandi-open-product';
const String _openSearchKey = 'kandi-open-search';


// ---- The saved list ----
//
// The same two operations Home performs on the same key. Duplicated rather
// than imported: nothing crosses a file boundary in this app, and the key
// below is the whole contract between the two pages.
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

  /// Units left, when WooCommerce is tracking stock for this product.
  ///
  /// Null means "not tracked", which is different from zero — the website's
  /// tile draws the scarcity line only for a real count, and a product with
  /// untracked stock is not nearly gone, it is simply uncounted.
  final int? stockQuantity;
  final num rating;
  final int ratingCount;

  /// How many have sold. The one number on a tile that is about other
  /// shoppers rather than about the shop, and the API has been sending it all
  /// along.
  final int totalSales;
  final bool isNew;
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
      stockQuantity:
          json['stockQuantity'] is int ? json['stockQuantity'] as int : null,
      rating: json['rating'] is num ? json['rating'] as num : 0,
      ratingCount: json['ratingCount'] is int ? json['ratingCount'] as int : 0,
      totalSales: json['totalSales'] is int ? json['totalSales'] as int : 0,
      isNew: json['isNew'] == true,
      hasOptions: json['hasOptions'] == true,
    );
  }

  static List<_KProduct> listFrom(dynamic json) {
    if (json is! List) return const [];
    return json.map(_KProduct.from).whereType<_KProduct>().toList();
  }
}

Future<void> _handoff(String key, String value) async {
  try {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(key, value);
  } catch (_) {
    // The destination falls back to its own empty state.
  }
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
  } catch (_) {
    // Recoverable — the shopper can tap again.
  }
}

class KandiSearchScreen extends StatefulWidget {
  const KandiSearchScreen({super.key, this.width, this.height});

  final double? width;
  final double? height;

  @override
  State<KandiSearchScreen> createState() => _KandiSearchScreenState();
}

class _KandiSearchScreenState extends State<KandiSearchScreen> {
  final TextEditingController _field = TextEditingController();
  final FocusNode _focus = FocusNode();

  Timer? _debounce;

  /// Bumped on every search. A response whose generation is stale is discarded,
  /// which is what stops a slow "sho" overwriting a fast "shoes".
  int _generation = 0;

  bool _loading = false;
  bool _searched = false;
  List<_KProduct> _results = const [];
  int _total = 0;

  @override
  void initState() {
    super.initState();
    _restore();
    _refreshWishlist();
  }

  /// The free-delivery threshold, and the saved list.
  ///
  /// `/api/app/products` has been returning `commerce` on every response all
  /// along; this page was throwing it away. Both are needed by the tile, which
  /// is now the same tile Home draws.
  num _freeDeliveryFrom = 0;
  Set<int> _wishlist = <int>{};

  Future<void> _refreshWishlist() async {
    final wishlist = await _readWishlistIds();
    if (mounted) setState(() => _wishlist = wishlist);
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


  Future<void> _restore() async {
    String initial = '';
    try {
      final prefs = await SharedPreferences.getInstance();
      initial = prefs.getString(_openSearchKey) ?? '';
      // Consumed on read. Leaving it set means every later visit re-runs a
      // search the shopper has moved on from.
      await prefs.remove(_openSearchKey);
    } catch (_) {
      initial = '';
    }

    if (!mounted) return;
    if (initial.isNotEmpty) {
      _field.text = initial;
      _run(initial);
    } else {
      // No term: open with the keyboard up, which is what "tapped the search
      // bar" means.
      _focus.requestFocus();
    }
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _field.dispose();
    _focus.dispose();
    super.dispose();
  }

  void _onChanged(String value) {
    _debounce?.cancel();
    final query = value.trim();
    if (query.length < 2) {
      setState(() {
        _results = const [];
        _searched = false;
        _loading = false;
      });
      return;
    }
    _debounce = Timer(const Duration(milliseconds: 400), () => _run(query));
  }

  Future<void> _run(String query) async {
    final generation = ++_generation;
    setState(() {
      _loading = true;
      _searched = true;
    });

    dynamic data;
    int status = 0;
    try {
      final response = await http
          .get(Uri.parse(
              '$_apiBase/api/app/products?q=${Uri.encodeQueryComponent(query)}'))
          .timeout(const Duration(seconds: 20));
      status = response.statusCode;
      data = jsonDecode(response.body);
    } catch (_) {
      status = 0;
    }

    // A stale answer is dropped rather than rendered.
    if (!mounted || generation != _generation) return;

    setState(() {
      _loading = false;
      if (status == 200 && data is Map) {
      final commerce = data['commerce'];
      if (commerce is Map) {
        _freeDeliveryFrom = commerce['freeDeliveryFrom'] is num
            ? commerce['freeDeliveryFrom'] as num
            : 0;
      }
        _results = _KProduct.listFrom(data['products']);
        _total = data['total'] is int ? data['total'] as int : _results.length;
      } else {
        _results = const [];
        _total = 0;
      }
    });
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

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: widget.width,
      height: widget.height,
      child: Scaffold(
        backgroundColor: _KColors.canvas,
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
          titleSpacing: 0,
          title: Container(
            height: 42,
            // A margin on BOTH sides. With titleSpacing at 0 and no leading
            // widget the pill ran flush off the left edge of the screen; the
            // back arrow usually fills that gap, but "usually" is not a
            // layout.
            margin: const EdgeInsets.fromLTRB(_KSpace.sm, 0, _KSpace.md, 0),
            padding: const EdgeInsets.symmetric(horizontal: _KSpace.md),
            decoration: BoxDecoration(
              // White and fully rounded: on the gradient a grey field reads as
              // a disabled one, and the pill is what says 'search' before the
              // hint text has been read.
              color: _KColors.panel,
              borderRadius: BorderRadius.circular(_rPill),
            ),
            child: Row(
              children: [
                const Icon(Icons.search_rounded, size: 20, color: _KColors.muted),
                const SizedBox(width: _KSpace.sm),
                Expanded(
                  child: TextField(
                    controller: _field,
                    focusNode: _focus,
                    onChanged: _onChanged,
                    onSubmitted: (value) {
                      final query = value.trim();
                      if (query.length >= 2) _run(query);
                    },
                    textInputAction: TextInputAction.search,
                    style: const TextStyle(fontSize: 14.5, color: _KColors.ink),
                    decoration: const InputDecoration(
                      isDense: true,
                      border: InputBorder.none,
                      hintText: 'Search the shop',
                      hintStyle:
                          TextStyle(fontSize: 14.5, color: _KColors.muted),
                    ),
                  ),
                ),
                if (_field.text.isNotEmpty)
                  GestureDetector(
                    onTap: () {
                      _field.clear();
                      _onChanged('');
                      _focus.requestFocus();
                    },
                    child: const Icon(Icons.close_rounded,
                        size: 19, color: _KColors.muted),
                  ),
              ],
            ),
          ),
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

    if (!_searched) {
      return const Center(
        child: Padding(
          padding: EdgeInsets.all(_KSpace.xl),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.search_rounded, size: 44, color: _KColors.faint),
              SizedBox(height: _KSpace.md),
              Text('What are you looking for?',
                  style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w700,
                      color: _KColors.ink)),
              SizedBox(height: _KSpace.sm),
              Text('Type at least two letters to search.',
                  textAlign: TextAlign.center,
                  style: TextStyle(fontSize: 13.5, color: _KColors.body)),
            ],
          ),
        ),
      );
    }

    if (_results.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(_KSpace.xl),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.sentiment_dissatisfied_rounded,
                  size: 44, color: _KColors.faint),
              const SizedBox(height: _KSpace.md),
              Text('Nothing for "${_field.text.trim()}"',
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w700,
                      color: _KColors.ink)),
              const SizedBox(height: _KSpace.sm),
              const Text(
                'Try a shorter word, or check the spelling.',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 13.5, color: _KColors.body),
              ),
            ],
          ),
        ),
      );
    }

    return CustomScrollView(
      slivers: [
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(
                _KSpace.md, _KSpace.md, _KSpace.md, _KSpace.sm),
            child: Text(
              '$_total ${_total == 1 ? 'result' : 'results'}',
              style: const TextStyle(fontSize: 13, color: _KColors.muted),
            ),
          ),
        ),
        SliverPadding(
          padding: const EdgeInsets.fromLTRB(
              _KSpace.md, 0, _KSpace.md, _KSpace.xl),
          sliver: SliverGrid(
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 2,
              mainAxisSpacing: _KSpace.md,
              crossAxisSpacing: _KSpace.md,
              // ---- 0.64, where this was 0.62 ----
              //
              // The tile lost the Spacer that held the price at the foot of the cell, so
              // what is left over now shows as a gap BELOW the last row rather than as a
              // hole in the middle of the card — which means the cell wants to sit as
              // close to the content as it safely can.
              //
              // Added up at 177px wide: 2 of border, 12 of padding, a 163 photograph, 8 to
              // the name, a 30 name box, 3, a 13 price, 16 for the reserved sold-and-stars
              // row, and 16 more for the stock line when there is one. That is 247 at rest
              // and 263 at its fullest, in a 276 cell.
              //
              // The 13px on top of the fullest tile is not spare — it is what the rows
              // grow by at a 1.3 text scale, which is as far as this has been measured.
              // Past that the tile clips, and the figure to raise is this one.
              //
              // Reserving the meta row is what keeps the resting and fullest numbers only
              // 16 apart. If it goes back to being conditional, this has to rise again or
              // sparse tiles reopen the gap.
              childAspectRatio: 0.64,
            ),
            delegate: SliverChildBuilderDelegate(
              (context, index) {
                final product = _results[index];
                return _Card(
                  product: product,
                  freeDeliveryFrom: _freeDeliveryFrom,
                  saved: _wishlist.contains(product.id),
                  onOpen: () => _open(product),
                  onAdd: () => _add(product),
                  onSave: () => _toggleSaved(product),
                );
              },
              childCount: _results.length,
            ),
          ),
        ),
      ],
    );
  }
}

/// The product card. Kept in step with the home page's by eye rather than by
/// import — see the note on duplication at the head of kandi_home_screen.dart.
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
              // ---- The price sits under the name, not at the foot ----
              //
              // This was a `Spacer`, pinning the price to the bottom of the
              // cell the way `mt-auto` does on the site. The site can afford
              // that because its phone grid is a masonry: each column sizes
              // itself to its own content, so a pinned price has almost no
              // slack above it. This grid gives every cell the same height, so
              // the same trick opened a visible hole between the name and the
              // price on every tile that was not the tallest in its row.
              //
              // The alignment the pin was buying is still there, and bought
              // more cheaply: everything above the price is a FIXED height —
              // the square photograph, an 8px gap, a name box locked to two
              // lines — so the price lands on the same baseline in every tile
              // whether the name filled one line or two. That is why the name
              // box is a SizedBox rather than a clamp, and it is load-bearing
              // now rather than tidy.
              const SizedBox(height: 3),
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
              // ---- Reserved, not conditional ----
              //
              // The row draws nothing when a product has no sales and no
              // reviews, but it still takes its height. That is the site's own
              // solution — "an empty box of the right height, rather than a
              // missing row that shortens the tile" — and it matters more here
              // than there: a cell in this grid is a fixed height, so a row
              // that sometimes vanishes does not make the tile shorter, it
              // makes the empty space at the foot of the tile taller. Holding
              // the row keeps that gap to a few pixels on almost every tile.
              const SizedBox(height: 2),
              SizedBox(
                height: 14,
                child: Row(
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
              ),
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
      fit: BoxFit.contain,
      fadeInDuration: const Duration(milliseconds: 160),
      placeholder: (_, __) => const ColoredBox(color: _KColors.photo),
      errorWidget: (_, __, ___) => const ColoredBox(color: _KColors.photo),
    );
  }
}
