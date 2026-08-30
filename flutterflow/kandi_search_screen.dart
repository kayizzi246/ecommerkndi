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
  static const Color canvas = Color(0xFFF2F4F7);
  static const Color panel = Color(0xFFFFFFFF);
  static const Color ink = Color(0xFF111827);
  static const Color body = Color(0xFF4B5563);
  static const Color muted = Color(0xFF6B7280);
  static const Color faint = Color(0xFF9CA3AF);
  static const Color line = Color(0xFFE5E7EB);
  static const Color hairline = Color(0xFFF3F4F6);
  static const Color primary = Color(0xFFFF6A00);
  static const Color save = Color(0xFF15803D);
  static const Color saveSoft = Color(0xFFECFDF3);
  static const Color star = Color(0xFFF59E0B);
}

class _KSpace {
  const _KSpace._();
  static const double sm = 8;
  static const double md = 12;
  static const double xl = 24;
}

const double _rPanel = 14;
const double _rPhoto = 10;
const double _rChip = 8;
const String _apiBase = 'https://kandiug.com';

// The keys every page in this app agrees on. Repeated verbatim in each file;
// if one changes it must change in all of them at once.
const String _basketKey = 'kandi-cart-v1';
const String _openProductKey = 'kandi-open-product';
const String _openSearchKey = 'kandi-open-search';

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
          backgroundColor: _KColors.panel,
          surfaceTintColor: _KColors.panel,
          elevation: 0,
          scrolledUnderElevation: 0.5,
          iconTheme: const IconThemeData(color: _KColors.ink),
          titleSpacing: 0,
          title: Container(
            height: 42,
            margin: const EdgeInsets.only(right: _KSpace.md),
            padding: const EdgeInsets.symmetric(horizontal: _KSpace.md),
            decoration: BoxDecoration(
              color: _KColors.hairline,
              borderRadius: BorderRadius.circular(_rChip),
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
              childAspectRatio: 0.52,
            ),
            delegate: SliverChildBuilderDelegate(
              (context, index) {
                final product = _results[index];
                return _Card(
                  product: product,
                  onOpen: () => _open(product),
                  onAdd: () => _add(product),
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
    required this.onOpen,
    required this.onAdd,
  });

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
        // Opaque so the whole card is the tap target, gaps included.
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
                          // A product with options opens rather than adding —
                          // a card cannot show a size picker.
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
