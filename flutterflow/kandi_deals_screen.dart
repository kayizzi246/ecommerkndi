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
import '/custom_code/widgets/kandi_product_screen.dart';
import '/custom_code/widgets/kandi_cart_screen.dart';

// ============================================================
//  KANDI — TODAY'S DEALS
//
//  Self-contained like every page here: its own palette, HTTP
//  and model, all file-private. The architecture is written out
//  in full at the head of kandi_home_screen.dart.
//
//  ---- What this is, against the Shop page ----
//
//  Shop can sort by discount, so on the surface this page is a
//  Shop page with two parameters pre-set. What makes it its own
//  screen is the QUESTION it answers. Shop is "show me shoes",
//  and the shopper arrives with a thing in mind; this is "show
//  me what is cheap today", and the shopper arrives with money
//  and no plan. The website keeps them apart for the same
//  reason (`/sale`), and a marketplace without a deals screen
//  has nowhere to send anybody on payday.
//
//  ---- The depth chips are the whole control ----
//
//  Not a sort — a FLOOR. "Reduced at all" and "at least half
//  price" are different promises, and only one of them is worth
//  a shopper's afternoon. `min_discount` is applied by the
//  server, in the same code path the website's own sale page
//  uses, so the two cannot drift into disagreeing about what
//  counts as 30% off.
//
//  Ordered by discount inside every chip, deepest first. A deals
//  page ordered by anything else buries its best row.
//
//  ---- Paging ----
//
//  Twenty-four a page, appended as the shopper reaches the foot
//  of the grid. A "load more" button would be one more tap
//  between somebody and the next twenty-four things they might
//  buy, and this is the one screen where the whole point is to
//  keep scrolling.
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
  static const Color save = Color(0xFF15803D);
  static const Color express = Color(0xFFFFE000);

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

  /// The tint behind a selected chip.
  static const Color flameSoft = Color(0xFFFFF1ED);
}

class _KSpace {
  const _KSpace._();
  static const double sm = 8;
  static const double md = 12;
  static const double lg = 16;
  static const double xl = 24;
}

const double _rPanel = 12;
const double _rPhoto = 8;
const double _rChip = 8;

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
const String _basketKey = 'kandi-cart-v1';
const String _wishlistKey = 'kandi-wishlist-v1';
const String _openProductKey = 'kandi-open-product';

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
  /// shoppers rather than about the shop.
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

/// One depth chip: a floor under the discount, and the label for it.
class _Depth {
  const _Depth(this.label, this.minDiscount);

  final String label;

  /// Whole percent. Zero means "reduced at all", which is `sale=1` rather than
  /// a floor of nothing — the two are the same set today and the first is what
  /// the endpoint is built to answer.
  final int minDiscount;
}

const List<_Depth> _depths = <_Depth>[
  _Depth('All deals', 0),
  _Depth('20% off or more', 20),
  _Depth('30% off or more', 30),
  _Depth('Half price or more', 50),
];

class KandiDealsScreen extends StatefulWidget {
  const KandiDealsScreen({super.key, this.width, this.height});

  final double? width;
  final double? height;

  @override
  State<KandiDealsScreen> createState() => _KandiDealsScreenState();
}

class _KandiDealsScreenState extends State<KandiDealsScreen> {
  bool _loading = true;
  bool _appending = false;
  bool _failed = false;

  List<_KProduct> _products = const [];
  int _depth = 0;
  int _page = 1;
  int _totalPages = 1;

  num _freeDeliveryFrom = 0;
  Set<int> _wishlist = <int>{};

  final ScrollController _scroll = ScrollController();

  /// Bumped on every fresh load. An answer for a chip the shopper has already
  /// moved off is dropped rather than rendered — the same guard the search page
  /// uses, and it matters here for the same reason: these requests take
  /// different times and the taps are one after another.
  int _generation = 0;

  @override
  void initState() {
    super.initState();
    _scroll.addListener(_onScroll);
    _load();
    _refreshWishlist();
  }

  @override
  void dispose() {
    _scroll.removeListener(_onScroll);
    _scroll.dispose();
    super.dispose();
  }

  void _onScroll() {
    if (!_scroll.hasClients || _appending || _loading) return;
    if (_page >= _totalPages) return;
    // 600px before the end: far enough that the next page usually lands before
    // the shopper reaches the foot of the grid, close enough that a shopper who
    // opens the screen and stops is not made to pay for a page they never see.
    if (_scroll.position.pixels >=
        _scroll.position.maxScrollExtent - 600) {
      _loadMore();
    }
  }

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

  String _url(int page) {
    final depth = _depths[_depth];
    final query = StringBuffer('$_apiBase/api/app/products?sort=discount');
    if (depth.minDiscount > 0) {
      query.write('&min_discount=${depth.minDiscount}');
    } else {
      query.write('&sale=1');
    }
    // Sold-out stock has no business on a deals page: the whole promise is
    // "buy this today".
    query.write('&stock=1&page=$page');
    return query.toString();
  }

  Future<void> _load() async {
    final generation = ++_generation;
    setState(() {
      _loading = true;
      _failed = false;
    });

    final result = await _fetch(1);
    if (!mounted || generation != _generation) return;

    setState(() {
      _loading = false;
      if (result == null) {
        _failed = true;
        _products = const [];
        _totalPages = 1;
      } else {
        _products = result.products;
        _totalPages = result.totalPages;
        _freeDeliveryFrom = result.freeDeliveryFrom;
        _page = 1;
      }
    });

    if (_scroll.hasClients) _scroll.jumpTo(0);
  }

  Future<void> _loadMore() async {
    final generation = _generation;
    setState(() => _appending = true);

    final result = await _fetch(_page + 1);
    if (!mounted || generation != _generation) return;

    setState(() {
      _appending = false;
      if (result != null) {
        // Appended rather than replaced, and the page number only moves when
        // the answer actually arrives — a failed page must not skip a page of
        // the catalogue.
        _products = <_KProduct>[..._products, ...result.products];
        _totalPages = result.totalPages;
        _page += 1;
      }
    });
  }

  Future<_Answer?> _fetch(int page) async {
    dynamic data;
    int status = 0;
    try {
      final response = await http
          .get(Uri.parse(_url(page)))
          .timeout(const Duration(seconds: 20));
      status = response.statusCode;
      data = jsonDecode(response.body);
    } catch (_) {
      status = 0;
    }

    if (status != 200 || data is! Map) return null;

    num freeDeliveryFrom = _freeDeliveryFrom;
    final commerce = data['commerce'];
    if (commerce is Map && commerce['freeDeliveryFrom'] is num) {
      freeDeliveryFrom = commerce['freeDeliveryFrom'] as num;
    }

    return _Answer(
      products: _KProduct.listFrom(data['products']),
      totalPages: data['totalPages'] is int ? data['totalPages'] as int : 1,
      freeDeliveryFrom: freeDeliveryFrom,
    );
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
          title: const Text("Today's deals",
              style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w700,
                  color: Colors.white)),
        ),
        body: Column(
          children: [
            _buildChips(),
            Expanded(child: _buildBody()),
          ],
        ),
      ),
    );
  }

  /// The depth chips, in a horizontal scroller.
  ///
  /// A scroller rather than a wrap: four chips is two lines wrapped on a 390px
  /// phone, and two lines of controls above a grid pushes the first row of
  /// merchandise off the screen on the one page that exists to show it.
  Widget _buildChips() {
    return Container(
      color: _KColors.panel,
      padding: const EdgeInsets.symmetric(vertical: _KSpace.sm),
      child: SizedBox(
        height: 36,
        child: ListView.separated(
          scrollDirection: Axis.horizontal,
          padding: const EdgeInsets.symmetric(horizontal: _KSpace.md),
          itemCount: _depths.length,
          separatorBuilder: (_, __) => const SizedBox(width: _KSpace.sm),
          itemBuilder: (context, index) {
            final depth = _depths[index];
            final selected = index == _depth;
            return _Pill(
              label: depth.label,
              selected: selected,
              onTap: selected
                  ? null
                  : () {
                      setState(() => _depth = index);
                      _load();
                    },
            );
          },
        ),
      ),
    );
  }

  Widget _buildBody() {
    if (_loading) {
      return const Center(
          child: CircularProgressIndicator(color: _KColors.primary));
    }

    if (_failed) {
      return _message(
        icon: Icons.wifi_off_rounded,
        title: 'Could not load the deals',
        message: 'Check your connection and try again.',
        actionLabel: 'Try again',
        onAction: _load,
      );
    }

    if (_products.isEmpty) {
      return _message(
        icon: Icons.local_offer_outlined,
        title: 'Nothing this deep today',
        message:
            'No item is reduced by that much right now. Try a smaller discount.',
        actionLabel: 'Show all deals',
        onAction: () {
          setState(() => _depth = 0);
          _load();
        },
      );
    }

    return RefreshIndicator(
      color: _KColors.primary,
      onRefresh: _load,
      child: CustomScrollView(
        controller: _scroll,
        slivers: [
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(
                  _KSpace.md, _KSpace.md, _KSpace.md, _KSpace.sm),
              child: Text(
                _page < _totalPages
                    ? '${_products.length} deals so far, deepest first'
                    : '${_products.length} ${_products.length == 1 ? 'deal' : 'deals'}, deepest first',
                style: const TextStyle(fontSize: 13, color: _KColors.muted),
              ),
            ),
          ),
          SliverPadding(
            padding: const EdgeInsets.fromLTRB(
                _KSpace.md, 0, _KSpace.md, _KSpace.md),
            sliver: SliverGrid(
              gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: 2,
                mainAxisSpacing: _KSpace.md,
                crossAxisSpacing: _KSpace.md,
                // A tile is 300px tall on a 390-wide phone. That is the fullest
                // card added up row by row, not a guess — add a row to the card
                // and this has to move with it or the bottom one is clipped.
                childAspectRatio: 0.57,
              ),
              delegate: SliverChildBuilderDelegate(
                (context, index) {
                  final product = _products[index];
                  return _Card(
                    product: product,
                    freeDeliveryFrom: _freeDeliveryFrom,
                    saved: _wishlist.contains(product.id),
                    onOpen: () => _open(product),
                    onAdd: () => _add(product),
                    onSave: () => _toggleSaved(product),
                  );
                },
                childCount: _products.length,
              ),
            ),
          ),
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.only(bottom: _KSpace.xl),
              child: Center(
                child: _appending
                    ? const Padding(
                        padding: EdgeInsets.all(_KSpace.md),
                        child: SizedBox(
                          width: 22,
                          height: 22,
                          child: CircularProgressIndicator(
                              strokeWidth: 2.4, color: _KColors.primary),
                        ),
                      )
                    : (_page >= _totalPages
                        ? const Text('That is every deal on the shop today.',
                            style: TextStyle(
                                fontSize: 12.5, color: _KColors.muted))
                        : const SizedBox(height: _KSpace.md)),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _message({
    required IconData icon,
    required String title,
    required String message,
    required String actionLabel,
    required VoidCallback onAction,
  }) {
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
                  color: _KColors.flameSoft, shape: BoxShape.circle),
              child: Icon(icon, size: 34, color: _KColors.flame),
            ),
            const SizedBox(height: _KSpace.lg),
            Text(title,
                textAlign: TextAlign.center,
                style: const TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.w800,
                    color: _KColors.ink)),
            const SizedBox(height: _KSpace.sm),
            Text(message,
                textAlign: TextAlign.center,
                style: const TextStyle(
                    fontSize: 13.5, height: 1.5, color: _KColors.body)),
            const SizedBox(height: _KSpace.xl),
            SizedBox(
              width: 220,
              height: 48,
              child: FilledButton(
                onPressed: onAction,
                style: FilledButton.styleFrom(
                  backgroundColor: _KColors.flame,
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(_rPill)),
                ),
                child: Text(actionLabel,
                    style: const TextStyle(
                        fontSize: 15, fontWeight: FontWeight.w700)),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// One page of the catalogue, as this screen needs it.
class _Answer {
  const _Answer({
    required this.products,
    required this.totalPages,
    required this.freeDeliveryFrom,
  });

  final List<_KProduct> products;
  final int totalPages;
  final num freeDeliveryFrom;
}

/// A filter chip. The same control the Shop page uses, drawn the same way — a
/// filled tint with a brand border, because at a glance a shopper has to see
/// WHICH filter they are in and a one-shade difference does not carry that.
class _Pill extends StatelessWidget {
  const _Pill({required this.label, required this.selected, required this.onTap});

  final String label;
  final bool selected;

  /// Null on the chip already selected, so InkWell draws no ripple — the
  /// honest signal for "nothing will happen".
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        alignment: Alignment.center,
        padding: const EdgeInsets.symmetric(horizontal: _KSpace.lg),
        decoration: BoxDecoration(
          color: selected ? _KColors.flameSoft : _KColors.panel,
          borderRadius: BorderRadius.circular(_rPill),
          border: Border.all(
              color: selected ? _KColors.flame : _KColors.line,
              width: selected ? 1.5 : 1),
        ),
        child: Text(label,
            style: TextStyle(
                fontSize: 13,
                fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
                color: selected ? _KColors.flame : _KColors.ink)),
      ),
    );
  }
}

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

  /// The chip that rides the name line.
  ///
  /// One at most, in order of usefulness to a shopper who has not decided: a
  /// deep cut, then a new listing. A chip on every card is a chip that means
  /// nothing, which is why there is no fallback.
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
                  // The corners are on the Stack, not on the picture. The deal
                  // strip is a sibling of the picture, and clipping only the
                  // picture would leave the strip with square ends hanging off
                  // a rounded photograph.
                  borderRadius: BorderRadius.circular(_rPhoto),
                  child: Stack(
                    fit: StackFit.expand,
                    children: [
                      _Photo(url: product.image),

                      // Top LEFT: the heart, on its own white disc. Drawn
                      // straight on the photograph the outline vanishes
                      // against anything dark, and a control that is only
                      // sometimes visible is not a control.
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

                      // Top RIGHT: the cut, the loudest mark on a resting tile.
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

                      // ---- The deal strip ----
                      //
                      // Full width across the foot of the photograph, the way
                      // the reference draws it. The right padding clears the
                      // basket button, which floats over the strip's end
                      // rather than being pushed off the tile by it.
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
                            // A product with options cannot be added from a
                            // card — it opens instead, where the picker is.
                            onTap: product.hasOptions ? onOpen : onAdd,
                            behavior: HitTestBehavior.opaque,
                            child: Container(
                              width: 34,
                              height: 34,
                              // A circle with a drawn ring. This floats over a
                              // photograph that can be white — most of this
                              // catalogue is shot on it — so an edgeless white
                              // disc is an invisible button.
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
      httpHeaders: _kImageHeaders,
      imageUrl: url,
      fit: BoxFit.contain,
      fadeInDuration: const Duration(milliseconds: 160),
      placeholder: (_, __) => const ColoredBox(color: _KColors.hairline),
      errorWidget: (_, __, ___) => const ColoredBox(color: _KColors.hairline),
    );
  }
}
