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
import 'package:url_launcher/url_launcher.dart';

// Navigation only.
import '/custom_code/widgets/kandi_product_screen.dart';

// ============================================================
//  KANDI — SHOP BY STORE
//
//  Self-contained like every page here: its own palette, HTTP
//  and models, all file-private. The architecture is written out
//  in full at the head of kandi_home_screen.dart.
//
//  ---- Why the directory shows merchandise ----
//
//  A list of store names is not a place to shop. Nobody knows
//  what "Sports Kicks" sells, and "14 products" does not tell
//  them — the only way to find out was to open the store and
//  come back, and a directory whose every entry costs a round
//  trip to evaluate is a directory nobody uses.
//
//  So each row carries four of the store's actual products, and
//  they are tappable in place: the products are the answer to
//  the only question the row raises, and tapping one goes
//  straight to it rather than through the store page.
//
//  This is the same argument, and the same layout, as the
//  website's `/sellers`. One marketplace, one directory.
//
//  ---- On the empty stores ----
//
//  Two of this shop's stores have nothing listed yet. They stay
//  in the list rather than being hidden — they are real approved
//  sellers with real pages — sorted to the bottom, and the row
//  says they are setting up instead of drawing four grey boxes.
//
//  ---- The store's own page opens in a browser ----
//
//  A store page is a masthead, a policy block and a filtered
//  grid. The app already has the grid on its Shop screen, and
//  the rest is reading — so this hands over rather than
//  reimplementing, the same split SETUP.md draws for adding a
//  product and store settings.
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
  static const Color primarySoft = Color(0xFFFFF3EA);

  /// ---- The money colour ----
  ///
  /// #D62200 rather than a brighter red: white on it is 5.1:1, so the same
  /// value works as a ground under white button text AND as text on white.
  static const Color flame = Color(0xFFD62200);

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

/// The `Accept` header every photograph in this app is fetched with. See the
/// note in kandi_search_screen.dart — Dart's HTTP client sends none of its own,
/// so without this the storefront's optimiser has to guess and sends JPEG.
const Map<String, String> _kImageHeaders = <String, String>{
  'Accept': 'image/webp,image/*;q=0.8',
};

/// The brand gradient: Kandi orange running into the deep red.
const LinearGradient _brandGradient = LinearGradient(
  begin: Alignment.centerLeft,
  end: Alignment.centerRight,
  colors: [Color(0xFFFF6A00), Color(0xFFD62200)],
);

/// Fully rounded. The primary calls to action are pills, which is what tells
/// them apart from the square panels they sit on.
const double _rPill = 999;
const String _apiBase = 'https://kandiug.com';

// The keys every page in this app agrees on. Repeated verbatim in each file.
const String _openProductKey = 'kandi-open-product';

Future<void> _handoff(String key, String value) async {
  try {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(key, value);
  } catch (_) {
    // The destination falls back to its own empty state.
  }
}

/// A store's colour, as the seller chose it.
///
/// WordPress refuses anything but a six-digit hex and falls back to the shop
/// default, so this only has to cope with the leading hash and with the field
/// being absent entirely on an older payload.
Color _storeColor(String hex) {
  final cleaned = hex.replaceAll('#', '').trim();
  if (cleaned.length != 6) return _KColors.primary;
  final value = int.tryParse(cleaned, radix: 16);
  if (value == null) return _KColors.primary;
  return Color(0xFF000000 | value);
}

/// Black or white, whichever is legible on `background`.
///
/// A seller picks their own colour and some of them pick pale yellow. White
/// initials on that are invisible, which is a store with no name on the row
/// that is supposed to identify it. The threshold is the standard relative
/// luminance one, not a guess at "light-looking".
Color _inkOn(Color background) {
  final r = background.r;
  final g = background.g;
  final b = background.b;
  final luminance = 0.299 * r + 0.587 * g + 0.114 * b;
  return luminance > 0.6 ? _KColors.ink : Colors.white;
}

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

class _KStore {
  const _KStore({
    required this.id,
    required this.name,
    required this.slug,
    required this.logo,
    required this.color,
    required this.productCount,
    required this.url,
    required this.products,
  });

  final int id;
  final String name;
  final String slug;
  final String logo;
  final String color;
  final int productCount;
  final String url;
  final List<_KMini> products;

  static _KStore? from(dynamic json) {
    if (json is! Map) return null;
    final id = json['id'];
    final name = (json['name'] ?? '').toString();
    if (id is! int || name.isEmpty) return null;
    return _KStore(
      id: id,
      name: name,
      slug: (json['slug'] ?? '').toString(),
      logo: (json['logo'] ?? '').toString(),
      color: (json['color'] ?? '').toString(),
      productCount:
          json['productCount'] is int ? json['productCount'] as int : 0,
      url: (json['url'] ?? '').toString(),
      products: json['products'] is List
          ? (json['products'] as List)
              .map(_KMini.from)
              .whereType<_KMini>()
              .toList()
          : const <_KMini>[],
    );
  }
}

class KandiStoresScreen extends StatefulWidget {
  const KandiStoresScreen({super.key, this.width, this.height});

  final double? width;
  final double? height;

  @override
  State<KandiStoresScreen> createState() => _KandiStoresScreenState();
}

class _KandiStoresScreenState extends State<KandiStoresScreen> {
  bool _loading = true;
  bool _failed = false;
  List<_KStore> _stores = const [];

  @override
  void initState() {
    super.initState();
    _load();
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
          .get(Uri.parse('$_apiBase/api/app/stores'))
          .timeout(const Duration(seconds: 20));
      status = response.statusCode;
      data = jsonDecode(response.body);
    } catch (_) {
      status = 0;
    }

    if (!mounted) return;

    setState(() {
      _loading = false;
      if (status == 200 && data is Map && data['stores'] is List) {
        _stores = (data['stores'] as List)
            .map(_KStore.from)
            .whereType<_KStore>()
            .toList();
        _failed = _stores.isEmpty;
      } else {
        _stores = const [];
        _failed = true;
      }
    });
  }

  Future<void> _openProduct(int id) async {
    await _handoff(_openProductKey, '$id');
    if (!mounted) return;
    await Navigator.of(context)
        .push(MaterialPageRoute(builder: (_) => const KandiProductScreen()));
  }

  Future<void> _openStore(_KStore store) async {
    if (store.url.isEmpty) return;
    final uri = Uri.tryParse(store.url);
    if (uri == null) return;
    try {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Could not open the store page.'),
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
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
          title: const Text('Shop by store',
              style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w700,
                  color: Colors.white)),
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

    if (_failed) {
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
                child: const Icon(Icons.storefront_outlined,
                    size: 34, color: _KColors.primary),
              ),
              const SizedBox(height: _KSpace.lg),
              const Text('Could not load the stores',
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

    final stocked = _stores.where((store) => store.productCount > 0).length;

    return RefreshIndicator(
      color: _KColors.primary,
      onRefresh: _load,
      child: ListView.separated(
        padding: const EdgeInsets.all(_KSpace.md),
        itemCount: _stores.length + 1,
        separatorBuilder: (_, __) => const SizedBox(height: _KSpace.md),
        itemBuilder: (context, index) {
          if (index == 0) {
            return Padding(
              padding: const EdgeInsets.only(bottom: 2),
              child: Text(
                stocked == _stores.length
                    ? '${_stores.length} ${_stores.length == 1 ? 'store' : 'stores'} on Kandi'
                    : '$stocked of ${_stores.length} stores are selling today',
                style: const TextStyle(fontSize: 13, color: _KColors.muted),
              ),
            );
          }
          return _StoreCard(
            store: _stores[index - 1],
            onOpenStore: () => _openStore(_stores[index - 1]),
            onOpenProduct: _openProduct,
          );
        },
      ),
    );
  }
}

/// One store: who they are on the left, what they sell across the foot.
class _StoreCard extends StatelessWidget {
  const _StoreCard({
    required this.store,
    required this.onOpenStore,
    required this.onOpenProduct,
  });

  final _KStore store;
  final VoidCallback onOpenStore;
  final ValueChanged<int> onOpenProduct;

  @override
  Widget build(BuildContext context) {
    final colour = _storeColor(store.color);
    final initial =
        store.name.trim().isEmpty ? '?' : store.name.trim().substring(0, 1);

    return Container(
      padding: const EdgeInsets.all(_KSpace.lg),
      decoration: BoxDecoration(
        color: _KColors.panel,
        borderRadius: BorderRadius.circular(_rPanel),
        border: Border.all(color: _KColors.edge),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              // The seller's own colour, with a legible ink chosen for it. A
              // logo where there is one, the initial where there is not —
              // never a grey square, which reads as a broken image rather than
              // as a store that has not uploaded one.
              ClipRRect(
                borderRadius: BorderRadius.circular(_rPhoto),
                child: Container(
                  width: 46,
                  height: 46,
                  color: colour,
                  child: store.logo.isEmpty
                      ? Center(
                          child: Text(initial.toUpperCase(),
                              style: TextStyle(
                                  fontSize: 20,
                                  fontWeight: FontWeight.w900,
                                  color: _inkOn(colour))),
                        )
                      : CachedNetworkImage(
                          imageUrl: store.logo,
                          httpHeaders: _kImageHeaders,
                          fit: BoxFit.cover,
                          placeholder: (_, __) => ColoredBox(color: colour),
                          errorWidget: (_, __, ___) => Center(
                            child: Text(initial.toUpperCase(),
                                style: TextStyle(
                                    fontSize: 20,
                                    fontWeight: FontWeight.w900,
                                    color: _inkOn(colour))),
                          ),
                        ),
                ),
              ),
              const SizedBox(width: _KSpace.md),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(store.name,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                            fontSize: 15.5,
                            fontWeight: FontWeight.w800,
                            color: _KColors.ink)),
                    const SizedBox(height: 1),
                    Text(
                      store.productCount > 0
                          ? '${store.productCount} ${store.productCount == 1 ? 'product' : 'products'}'
                          : 'Setting up their shelves',
                      style: const TextStyle(
                          fontSize: 12.5, color: _KColors.muted),
                    ),
                  ],
                ),
              ),
              GestureDetector(
                onTap: onOpenStore,
                child: Container(
                  padding: const EdgeInsets.symmetric(
                      horizontal: _KSpace.md, vertical: 7),
                  decoration: BoxDecoration(
                    border: Border.all(color: _KColors.line),
                    borderRadius: BorderRadius.circular(_rPill),
                  ),
                  child: const Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text('Visit',
                          style: TextStyle(
                              fontSize: 12.5,
                              fontWeight: FontWeight.w700,
                              color: _KColors.ink)),
                      SizedBox(width: 4),
                      // Says out loud that this leaves the app, which is the
                      // one thing a shopper should never discover afterwards.
                      Icon(Icons.open_in_new_rounded,
                          size: 14, color: _KColors.muted),
                    ],
                  ),
                ),
              ),
            ],
          ),
          if (store.products.isNotEmpty) ...[
            const SizedBox(height: _KSpace.md),
            SizedBox(
              height: 78,
              child: Row(
                children: [
                  for (int index = 0; index < store.products.length; index++)
                    Expanded(
                      child: Padding(
                        padding: EdgeInsets.only(
                            right: index == store.products.length - 1
                                ? 0
                                : _KSpace.sm),
                        child: GestureDetector(
                          onTap: () =>
                              onOpenProduct(store.products[index].id),
                          child: ClipRRect(
                            borderRadius: BorderRadius.circular(_rPhoto),
                            child: Container(
                              color: _KColors.photo,
                              child: store.products[index].image.isEmpty
                                  ? const Icon(
                                      Icons.image_not_supported_outlined,
                                      size: 18,
                                      color: _KColors.faint)
                                  : CachedNetworkImage(
                                      imageUrl: store.products[index].image,
                                      httpHeaders: _kImageHeaders,
                                      // Contain, never cover: a supplier
                                      // photograph cropped to a small square
                                      // loses the shoe and keeps the box.
                                      fit: BoxFit.contain,
                                      placeholder: (_, __) => const ColoredBox(
                                          color: _KColors.photo),
                                      errorWidget: (_, __, ___) =>
                                          const ColoredBox(
                                              color: _KColors.photo),
                                    ),
                            ),
                          ),
                        ),
                      ),
                    ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }
}
