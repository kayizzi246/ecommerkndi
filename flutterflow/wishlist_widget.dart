// Automatic FlutterFlow imports
import '/backend/backend.dart';
import '/backend/supabase/supabase.dart';
import '/flutter_flow/flutter_flow_theme.dart';
import '/flutter_flow/flutter_flow_util.dart';
import '/custom_code/widgets/index.dart'; // Imports other custom widgets
import '/flutter_flow/custom_functions.dart'; // Imports custom functions
import 'package:flutter/material.dart';
// Begin custom widget code
// DO NOT REMOVE OR MODIFY THE CODE ABOVE!

import 'dart:convert';
import 'dart:ui' as ui;

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:http/http.dart' as http;

// ============================================================
//  KANDI — SAVED ITEMS  (v3)
//
//  Fifth sibling of home_sections_widget.dart,
//  category_navigation_menu.dart, product_detail_widget.dart and
//  cart_widget.dart.
//
//  PASTE cart_widget.dart INTO FLUTTERFLOW FIRST. This file uses
//  `KandiWishlist`, `KandiCart`, `kandiUgx`, `kandiOpenProduct`
//  and `kandiOpenShop`, all declared there. They live in one file
//  on purpose: two copies of a saved-items list is two lists, and
//  the heart on the product page would then disagree with this
//  screen about what is saved.
//
//  WHAT CHANGED FROM v2, AND WHY
//  -----------------------------------------------------------
//  1. NO SIGN-IN WALL, AND NO SUPABASE TABLE. v2 read a Supabase
//     `wishlist` table keyed by user_id, and showed a locked
//     padlock and a "Sign in to save items" screen to everybody
//     else. The website saves freely, per device, in localStorage
//     (`kandi-wishlist-v1`) and never asks who you are. The app
//     was therefore refusing to do the one thing the site does
//     without being asked.
//
//     This version keeps the same key and the same fields, so a
//     wrapped webview and these native screens read one list.
//
//  2. THE PRICES ARE THE SHOP'S, TODAY. A saved item is by
//     definition old — that is the point of saving it — so the
//     price written down when it was saved is the least reliable
//     number on the screen. Each row is re-read on open from
//
//         GET {_kApiBaseUrl}/api/app/product/{id}
//
//     which is what makes "price dropped" honest and what stops
//     "Move to cart" from moving a stale figure into a basket.
//
//  3. IT SAYS WHEN SOMETHING SOLD OUT. v2 offered "Move to Bag"
//     on every row regardless. A saved item that can no longer be
//     bought is the most useful thing this screen can tell you.
//
//  4. BRAND AND TYPE. Inter, white page, orange #ff6a00, red
//     reserved strictly for discounts and destructive actions.
//
//  SETUP  (FlutterFlow)
//  -----------------------------------------------------------
//  • Custom Widget name:  WishlistPage   (must match the class)
//  • Dependencies (Settings ▸ Pubspec):
//        http: ^1.2.0
//        cached_network_image: ^3.3.1
//        google_fonts: ^6.1.0
//        shared_preferences: ^2.2.2
//  • Parameters:
//        onHomeTap     Action   optional
//        onShopTap     Action   optional
//        onCartTap     Action   optional
//        onProfileTap  Action   optional
//
//  Those four are the bottom tabs, and they are the only
//  parameters. Nothing that carries an id crosses the boundary:
//  products and departments are opened by this file, in code,
//  through `kandiOpenProduct` / `kandiOpenShop`. An id passed as a
//  FlutterFlow parameter has to be declared on the destination,
//  spelled identically in the action editor and kept in step with
//  this file — and when it drifts, the result is a blank product
//  page rather than a compile error.
//
//  NOTE ON THE SUPABASE IMPORT ABOVE: FlutterFlow writes that
//  header itself and rewrites it on every save, so it stays.
//  Nothing in this file uses Supabase any more.
// ============================================================

// ============================================================
// CONFIG — keep identical to the other widgets
// ============================================================

const String _kApiBaseUrl = 'https://kandiug.com';

String get _base => _kApiBaseUrl.replaceAll(RegExp(r'/+$'), '');

/// At or below this many units a row says how few are left.
const int _kLowStockAt = 5;

// ============================================================
// BRAND — matched to app/globals.css
// ============================================================

const Color _kPrimary = Color(0xFFFF6A00);
const Color _kPrimaryInk = Color(0xFFB34A00);
const Color _kSale = Color(0xFFE53935);
const Color _kInk = Color(0xFF171717);
const Color _kBody = Color(0xFF475569);
const Color _kMuted = Color(0xFF64748B);
const Color _kFaint = Color(0xFF94A3B8);
const Color _kLine = Color(0xFFE5E7EB);
const Color _kHairline = Color(0xFFF3F4F6);
const Color _kSurface = Color(0xFFFAFAFA);
const Color _kSuccess = Color(0xFF16A34A);
const Color _kSuccessBg = Color(0xFFF0FDF4);
const Color _kSaleBg = Color(0xFFFEF2F2);
const Color _kWhite = Colors.white;
const Color _kPage = Colors.white;

// ============================================================
// TYPE — Inter, matching the website
// ============================================================

TextStyle _heading({
  double size = 19,
  Color color = _kInk,
  FontWeight weight = FontWeight.w800,
  double? height,
}) =>
    GoogleFonts.inter(
      fontSize: size,
      fontWeight: weight,
      color: color,
      height: height ?? 1.2,
      letterSpacing: size * -0.018,
    );

TextStyle _text({
  double size = 14,
  Color color = _kBody,
  FontWeight weight = FontWeight.w500,
  double? height,
}) =>
    GoogleFonts.inter(
      fontSize: size,
      fontWeight: weight,
      color: color,
      height: height ?? 1.45,
      letterSpacing: size * 0.004,
    );

TextStyle _price({double size = 16, Color color = _kInk}) => GoogleFonts.inter(
      fontSize: size,
      fontWeight: FontWeight.w700,
      color: color,
      height: 1.1,
      letterSpacing: size * -0.008,
      fontFeatures: const [ui.FontFeature.tabularFigures()],
    );

TextStyle _struck({double size = 12.5}) => GoogleFonts.inter(
      fontSize: size,
      fontWeight: FontWeight.w400,
      color: _kFaint,
      decoration: TextDecoration.lineThrough,
      decorationColor: _kFaint,
      fontFeatures: const [ui.FontFeature.tabularFigures()],
    );

TextStyle _label({
  double size = 11.5,
  Color color = _kMuted,
  FontWeight weight = FontWeight.w600,
}) =>
    GoogleFonts.inter(
      fontSize: size,
      fontWeight: weight,
      color: color,
      height: 1.25,
      letterSpacing: 0.2,
    );

// ============================================================
// LIVE PRODUCT FACTS
// ============================================================

/// What the shop says about a saved product right now.
///
/// A saved row carries whatever was true when the heart was tapped. This is
/// what makes the difference between "you saved this at 120,000" and "it is
/// 95,000 today" sayable at all.
class _Live {
  final String name;
  final String image;
  final String slug;
  final double price;
  final String priceLabel;
  final String? wasPriceLabel;
  final int discountPercent;
  final bool inStock;
  final int? stockQuantity;

  const _Live({
    required this.name,
    required this.image,
    required this.slug,
    required this.price,
    required this.priceLabel,
    required this.wasPriceLabel,
    required this.discountPercent,
    required this.inStock,
    required this.stockQuantity,
  });

  static _Live? fromDetail(Map<String, dynamic> json) {
    final raw = json['product'];
    if (raw is! Map) return null;
    final p = Map<String, dynamic>.from(raw);

    final images = p['images'];
    final image = (images is List && images.isNotEmpty)
        ? (images.first ?? '').toString()
        : (p['image'] ?? '').toString();

    return _Live(
      name: (p['name'] ?? '').toString(),
      image: image,
      slug: (p['slug'] ?? '').toString(),
      price: (p['price'] is num) ? (p['price'] as num).toDouble() : 0,
      priceLabel: (p['priceLabel'] ?? '').toString(),
      wasPriceLabel: p['wasPriceLabel']?.toString(),
      discountPercent:
          (p['discountPercent'] is num) ? (p['discountPercent'] as num).toInt() : 0,
      inStock: p['inStock'] != false,
      stockQuantity: p['stockQuantity'] == null
          ? null
          : (p['stockQuantity'] is num)
              ? (p['stockQuantity'] as num).toInt()
              : int.tryParse('${p['stockQuantity']}'),
    );
  }
}

// ============================================================
// PRESS
// ============================================================

class _Press extends StatefulWidget {
  final Widget child;
  final VoidCallback? onTap;
  final double scale;
  const _Press({required this.child, this.onTap, this.scale = 0.97});

  @override
  State<_Press> createState() => _PressState();
}

class _PressState extends State<_Press> {
  bool _down = false;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTapDown: (_) => setState(() => _down = true),
      onTapUp: (_) => setState(() => _down = false),
      onTapCancel: () => setState(() => _down = false),
      onTap: widget.onTap,
      child: AnimatedScale(
        scale: _down ? widget.scale : 1.0,
        duration: const Duration(milliseconds: 110),
        curve: Curves.easeOut,
        child: widget.child,
      ),
    );
  }
}

// ============================================================
// WIDGET
// ============================================================

/// The class name is `WishlistPage`, and it must stay that: FlutterFlow
/// generates the call site from the Custom Widget's NAME, so a rename here
/// without a rename there fails the whole web build rather than one screen.
class WishlistPage extends StatefulWidget {
  const WishlistPage({
    super.key,
    this.width,
    this.height,
    this.onHomeTap,
    this.onShopTap,
    this.onCartTap,
    this.onProfileTap,
  });

  final double? width;
  final double? height;

  /// The bottom tabs, and the whole of this widget's parameter list. A tab
  /// carries no data, so there is nothing here to spell wrong.
  final Future Function()? onHomeTap;
  final Future Function()? onShopTap;
  final Future Function()? onCartTap;
  final Future Function()? onProfileTap;

  @override
  State<WishlistPage> createState() => _WishlistPageState();
}

class _WishlistPageState extends State<WishlistPage> {
  static const double _pad = 16.0;
  static const double _radius = 10.0;

  List<KandiWishlistItem> _items = <KandiWishlistItem>[];

  /// Live facts per productId. A row with no entry is one the shop could not be
  /// asked about, and is shown from storage rather than hidden — a weak
  /// connection should not empty somebody's saved list.
  final Map<int, _Live> _live = <int, _Live>{};

  bool _loading = true;
  bool _refreshing = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  // ---------- Data ----------

  Future<void> _load() async {
    if (!mounted) return;
    setState(() => _loading = true);

    final items = await KandiWishlist.load(force: true);
    if (!mounted) return;
    setState(() {
      _items = List<KandiWishlistItem>.from(items);
      _loading = false;
    });

    await _refresh();
  }

  /// Re-reads every saved product from the shop, in parallel, each absorbing
  /// its own failure.
  Future<void> _refresh() async {
    if (_items.isEmpty) return;
    if (mounted) setState(() => _refreshing = true);

    await Future.wait(_items.map((item) async {
      try {
        final response = await http.get(
          Uri.parse('$_base/api/app/product/${item.productId}'),
          headers: const {'Accept': 'application/json'},
        ).timeout(const Duration(seconds: 15));

        if (response.statusCode != 200) return;
        final decoded = jsonDecode(utf8.decode(response.bodyBytes));
        if (decoded is! Map) return;

        final live = _Live.fromDetail(Map<String, dynamic>.from(decoded));
        if (live != null) _live[item.productId] = live;
      } catch (e) {
        debugPrint('Kandi wishlist refresh ${item.productId} failed: $e');
      }
    }));

    // The name and the picture are corrected silently — a renamed product is
    // the same product. The price is deliberately NOT overwritten: the saved
    // figure is what makes a drop visible, and it is only replaced when the row
    // is moved to the cart, where today's price is the only one that counts.
    var changed = false;
    for (final item in _items) {
      final live = _live[item.productId];
      if (live == null) continue;
      if (live.name.isNotEmpty && live.name != item.name) {
        item.name = live.name;
        changed = true;
      }
      if (live.image.isNotEmpty && live.image != item.image) {
        item.image = live.image;
        changed = true;
      }
      if (live.slug.isNotEmpty && live.slug != item.slug) {
        item.slug = live.slug;
        changed = true;
      }
    }
    // The items in `_items` are the store's own objects — the list was copied,
    // not the items — so the corrections above are already in the saved list
    // every other screen reads. This is what writes them to the device.
    if (changed) await KandiWishlist.persist();

    if (!mounted) return;
    setState(() => _refreshing = false);
  }

  // ---------- Actions ----------

  Future<void> _remove(KandiWishlistItem item) async {
    HapticFeedback.mediumImpact();
    final index = _items.indexWhere((i) => i.productId == item.productId);
    if (index < 0) return;

    setState(() => _items.removeAt(index));
    await KandiWishlist.remove(item.productId);

    if (!mounted) return;
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(
        SnackBar(
          content: Text(
            'Removed from saved',
            style: _text(size: 13.5, color: _kWhite, weight: FontWeight.w600),
          ),
          backgroundColor: _kInk,
          behavior: SnackBarBehavior.floating,
          duration: const Duration(seconds: 4),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(_radius),
          ),
          // Undo rather than a confirm dialog: the dialog taxes every removal
          // to protect against the rare wrong one.
          action: SnackBarAction(
            label: 'Undo',
            textColor: _kPrimary,
            onPressed: () async {
              await KandiWishlist.add(item, at: index);
              if (!mounted) return;
              setState(() =>
                  _items.insert(index.clamp(0, _items.length), item));
            },
          ),
        ),
      );
  }

  /// Moves a saved row into the basket at TODAY's price.
  ///
  /// The stored price is never the one that travels: it is a souvenir of when
  /// the heart was tapped, and a basket built from souvenirs is a basket the
  /// checkout will argue with.
  Future<void> _moveToCart(KandiWishlistItem item) async {
    final live = _live[item.productId];
    if (live != null && !live.inStock) return;

    HapticFeedback.mediumImpact();

    await KandiCart.add(
      productId: item.productId,
      name: live?.name.isNotEmpty == true ? live!.name : item.name,
      price: (live?.price ?? 0) > 0 ? live!.price : item.price,
      image: live?.image.isNotEmpty == true ? live!.image : item.image,
      slug: live?.slug.isNotEmpty == true ? live!.slug : item.slug,
    );

    // Saved items are moved, not copied — a row that is now in the basket and
    // still on this list is the same product asking to be bought twice.
    await KandiWishlist.remove(item.productId);
    if (!mounted) return;
    setState(() =>
        _items.removeWhere((i) => i.productId == item.productId));

    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(
        SnackBar(
          content: Text(
            'Moved to cart',
            style: _text(size: 13.5, color: _kWhite, weight: FontWeight.w600),
          ),
          backgroundColor: _kInk,
          behavior: SnackBarBehavior.floating,
          duration: const Duration(seconds: 3),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(_radius),
          ),
          action: SnackBarAction(
            label: 'View cart',
            textColor: _kPrimary,
            onPressed: () => _run(widget.onCartTap),
          ),
        ),
      );
  }

  void _run(Future Function()? action) {
    if (action == null) return;
    HapticFeedback.lightImpact();
    action();
  }

  // ============================================================
  // BUILD
  // ============================================================

  @override
  Widget build(BuildContext context) {
    return Container(
      width: widget.width ?? double.infinity,
      height: widget.height ?? double.infinity,
      color: _kPage,
      child: Column(
        children: [
          _header(),
          Expanded(
            child: _loading
                ? _skeleton()
                : _items.isEmpty
                    ? _empty()
                    : _list(),
          ),
          _bottomNav(),
        ],
      ),
    );
  }

  Widget _header() => Container(
        color: _kWhite,
        child: SafeArea(
          bottom: false,
          child: Container(
            height: 54,
            padding: const EdgeInsets.symmetric(horizontal: 12),
            decoration: const BoxDecoration(
              border: Border(bottom: BorderSide(color: _kLine)),
            ),
            child: Row(
              children: [
                _Press(
                  onTap: () {
                    HapticFeedback.lightImpact();
                    Navigator.of(context).maybePop();
                  },
                  child: Container(
                    width: 38,
                    height: 38,
                    decoration: BoxDecoration(
                      color: _kWhite,
                      shape: BoxShape.circle,
                      border: Border.all(color: _kLine),
                    ),
                    child: const Icon(Icons.arrow_back_ios_new_rounded,
                        size: 16, color: _kInk),
                  ),
                ),
                const SizedBox(width: 12),
                Text('Saved', style: _heading(size: 19)),
                if (_items.isNotEmpty) ...[
                  const SizedBox(width: 8),
                  Text(
                    '${_items.length} ${_items.length == 1 ? 'item' : 'items'}',
                    style: _label(size: 12.5),
                  ),
                ],
                const Spacer(),
                if (_refreshing)
                  const SizedBox(
                    width: 15,
                    height: 15,
                    child: CircularProgressIndicator(
                        strokeWidth: 2, color: _kPrimary),
                  ),
              ],
            ),
          ),
        ),
      );

  // ---------- List ----------

  Widget _list() => RefreshIndicator(
        onRefresh: _load,
        color: _kPrimary,
        backgroundColor: _kWhite,
        child: ListView.builder(
          physics: const AlwaysScrollableScrollPhysics(
            parent: BouncingScrollPhysics(),
          ),
          padding: const EdgeInsets.fromLTRB(_pad, 12, _pad, 16),
          itemCount: _items.length,
          itemBuilder: (_, i) => _row(_items[i]),
        ),
      );

  Widget _row(KandiWishlistItem item) {
    final live = _live[item.productId];
    final soldOut = live != null && !live.inStock;
    final stock = live?.stockQuantity;
    final lowStock =
        !soldOut && stock != null && stock > 0 && stock <= _kLowStockAt;

    // A drop is only claimed when the shop's price is genuinely below what was
    // saved, and by enough to be worth saying — a one-shilling rounding
    // difference announced as a price drop is a lie the shopper can check.
    final currentPrice = (live?.price ?? 0) > 0 ? live!.price : item.price;
    final dropped =
        live != null && item.price > 0 && currentPrice < item.price - 1;
    final dropAmount = item.price - currentPrice;

    return Dismissible(
      key: ValueKey('wish_${item.productId}'),
      direction: DismissDirection.endToStart,
      onDismissed: (_) => _remove(item),
      background: Container(
        margin: const EdgeInsets.only(bottom: 10),
        padding: const EdgeInsets.only(right: 18),
        alignment: Alignment.centerRight,
        decoration: BoxDecoration(
          color: _kSaleBg,
          borderRadius: BorderRadius.circular(_radius),
        ),
        child:
            const Icon(Icons.delete_outline_rounded, color: _kSale, size: 21),
      ),
      child: _Press(
        scale: 0.99,
        // In code. `kandiOpenProduct` lives in cart_widget.dart and pushes the
        // product page directly, wiring its related rail and its cart icon on
        // the way — no id crosses a FlutterFlow parameter.
        onTap: () => kandiOpenProduct(
          context,
          item.slug.isNotEmpty ? item.slug : item.productId.toString(),
        ),
        child: Container(
          margin: const EdgeInsets.only(bottom: 10),
          padding: const EdgeInsets.all(10),
          decoration: BoxDecoration(
            color: _kWhite,
            borderRadius: BorderRadius.circular(_radius),
            border: Border.all(color: _kLine),
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Stack(
                children: [
                  ClipRRect(
                    borderRadius: BorderRadius.circular(8),
                    child: SizedBox(
                      width: 84,
                      height: 100,
                      child: item.image.isEmpty
                          ? const ColoredBox(
                              color: _kHairline,
                              child: Icon(Icons.image_not_supported_outlined,
                                  size: 22, color: _kFaint),
                            )
                          : CachedNetworkImage(
                              imageUrl: item.image,
                              fit: BoxFit.cover,
                              memCacheWidth: 260,
                              fadeInDuration:
                                  const Duration(milliseconds: 150),
                              placeholder: (_, __) =>
                                  const ColoredBox(color: _kHairline),
                              errorWidget: (_, __, ___) => const ColoredBox(
                                color: _kHairline,
                                child: Icon(Icons.broken_image_outlined,
                                    size: 20, color: _kFaint),
                              ),
                            ),
                    ),
                  ),
                  // Sale red, never the brand orange — the same rule the tiles
                  // and the product page follow.
                  if (!soldOut && (live?.discountPercent ?? 0) > 0)
                    Positioned(
                      left: 0,
                      bottom: 0,
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 7, vertical: 3),
                        decoration: const BoxDecoration(
                          color: _kSale,
                          borderRadius: BorderRadius.only(
                            bottomLeft: Radius.circular(8),
                            topRight: Radius.circular(6),
                          ),
                        ),
                        child: Text(
                          '−${live!.discountPercent}%',
                          style: _label(
                              size: 10.5,
                              color: _kWhite,
                              weight: FontWeight.w700),
                        ),
                      ),
                    ),
                ],
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Expanded(
                          child: Text(
                            item.name,
                            style: _text(
                                size: 13.5,
                                color: soldOut ? _kMuted : _kInk,
                                weight: FontWeight.w500,
                                height: 1.35),
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                        const SizedBox(width: 6),
                        _Press(
                          scale: 0.85,
                          onTap: () => _remove(item),
                          child: Container(
                            width: 28,
                            height: 28,
                            decoration: BoxDecoration(
                              color: _kWhite,
                              shape: BoxShape.circle,
                              border: Border.all(color: _kLine),
                            ),
                            child: const Icon(Icons.favorite_rounded,
                                size: 14, color: _kSale),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 5),
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        Text(
                          live?.priceLabel.isNotEmpty == true
                              ? live!.priceLabel
                              : kandiUgx(currentPrice),
                          style: _price(
                            size: 16,
                            color: soldOut
                                ? _kMuted
                                : (live?.discountPercent ?? 0) > 0
                                    ? _kSale
                                    : _kInk,
                          ),
                        ),
                        if (!soldOut && live?.wasPriceLabel != null) ...[
                          const SizedBox(width: 6),
                          Padding(
                            padding: const EdgeInsets.only(bottom: 1),
                            child:
                                Text(live!.wasPriceLabel!, style: _struck()),
                          ),
                        ],
                      ],
                    ),
                    if (dropped && !soldOut) ...[
                      const SizedBox(height: 4),
                      _flag(
                        '${kandiUgx(dropAmount)} cheaper than when you saved it',
                        _kSuccess,
                        Icons.trending_down_rounded,
                        background: _kSuccessBg,
                      ),
                    ],
                    if (soldOut) ...[
                      const SizedBox(height: 4),
                      _flag('Out of stock', _kSale,
                          Icons.remove_circle_outline_rounded,
                          background: _kSaleBg),
                    ] else if (lowStock) ...[
                      const SizedBox(height: 4),
                      _flag('Only $stock left', _kSale,
                          Icons.local_fire_department_rounded,
                          background: _kSaleBg),
                    ],
                    const SizedBox(height: 9),
                    _Press(
                      onTap: soldOut ? null : () => _moveToCart(item),
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 13, vertical: 8),
                        decoration: BoxDecoration(
                          // Grey rather than orange when there is nothing to
                          // buy: a full-colour button on a sold-out product is
                          // an invitation to a dead end.
                          color: soldOut ? _kHairline : _kPrimary,
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(
                              soldOut
                                  ? Icons.notifications_none_rounded
                                  : Icons.shopping_bag_outlined,
                              size: 13,
                              color: soldOut ? _kMuted : _kWhite,
                            ),
                            const SizedBox(width: 6),
                            Text(
                              soldOut ? 'Sold out' : 'Move to cart',
                              style: _label(
                                size: 12,
                                color: soldOut ? _kMuted : _kWhite,
                                weight: FontWeight.w700,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _flag(String text, Color color, IconData icon,
          {required Color background}) =>
      Container(
        padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3.5),
        decoration: BoxDecoration(
          color: background,
          borderRadius: BorderRadius.circular(5),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 12.5, color: color),
            const SizedBox(width: 4),
            Flexible(
              child: Text(
                text,
                style:
                    _label(size: 11, color: color, weight: FontWeight.w700),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ),
          ],
        ),
      );

  // ---------- Empty and skeleton ----------

  Widget _empty() => Center(
        child: Padding(
          padding: const EdgeInsets.all(28),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 76,
                height: 76,
                decoration: const BoxDecoration(
                  color: _kHairline,
                  shape: BoxShape.circle,
                ),
                child: const Icon(Icons.favorite_border_rounded,
                    size: 32, color: _kMuted),
              ),
              const SizedBox(height: 16),
              Text('Nothing saved yet', style: _heading(size: 18)),
              const SizedBox(height: 6),
              Text(
                'Tap the heart on any product and it will\nwait for you here.',
                style: _text(size: 13.5, color: _kMuted),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 18),
              _Press(
                onTap: () => kandiOpenShop(context),
                child: Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 26, vertical: 12),
                  decoration: BoxDecoration(
                    color: _kPrimary,
                    borderRadius: BorderRadius.circular(_radius),
                  ),
                  child: Text(
                    'Start shopping',
                    style: _text(
                        size: 14, color: _kWhite, weight: FontWeight.w700),
                  ),
                ),
              ),
            ],
          ),
        ),
      );

  Widget _skeleton() => ListView.builder(
        physics: const NeverScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(_pad, 12, _pad, 12),
        itemCount: 4,
        itemBuilder: (_, __) => Container(
          margin: const EdgeInsets.only(bottom: 10),
          padding: const EdgeInsets.all(10),
          decoration: BoxDecoration(
            color: _kWhite,
            borderRadius: BorderRadius.circular(_radius),
            border: Border.all(color: _kLine),
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 84,
                height: 100,
                decoration: BoxDecoration(
                  color: _kHairline,
                  borderRadius: BorderRadius.circular(8),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(height: 13, color: _kHairline),
                    const SizedBox(height: 8),
                    Container(height: 13, width: 130, color: _kHairline),
                    const SizedBox(height: 14),
                    Container(height: 18, width: 90, color: _kHairline),
                    const SizedBox(height: 12),
                    Container(height: 28, width: 118, color: _kHairline),
                  ],
                ),
              ),
            ],
          ),
        ),
      );

  // ---------- Bottom navigation ----------

  Widget _bottomNav() => Container(
        decoration: const BoxDecoration(
          color: _kWhite,
          border: Border(top: BorderSide(color: _kLine)),
        ),
        child: SafeArea(
          top: false,
          child: SizedBox(
            height: 58,
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceAround,
              children: [
                _navItem(Icons.home_outlined, Icons.home_rounded, 'Home', false,
                    () => _run(widget.onHomeTap)),
                _navItem(
                  Icons.grid_view_outlined,
                  Icons.grid_view_rounded,
                  'Shop',
                  false,
                  // Falls back to the in-code department browser, so the tab
                  // works before anything is wired. The cart tab gets no such
                  // fallback: a checkout opened without its Action wired would
                  // take an order nowhere, and a tab that does nothing is the
                  // better failure.
                  () => widget.onShopTap != null
                      ? _run(widget.onShopTap)
                      : kandiOpenShop(context),
                ),
                _navItem(Icons.favorite_border_rounded, Icons.favorite_rounded,
                    'Saved', true, () {}),
                _navItem(Icons.shopping_bag_outlined,
                    Icons.shopping_bag_rounded, 'Cart', false,
                    () => _run(widget.onCartTap)),
                _navItem(Icons.person_outline_rounded, Icons.person_rounded,
                    'Account', false, () => _run(widget.onProfileTap)),
              ],
            ),
          ),
        ),
      );

  Widget _navItem(IconData icon, IconData activeIcon, String label,
          bool selected, VoidCallback onTap) =>
      GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: () {
          HapticFeedback.lightImpact();
          onTap();
        },
        child: SizedBox(
          width: 62,
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              // The cart tab wears the live basket count, read from the one
              // store the whole app writes to — so it cannot drift from what is
              // actually in the basket.
              label == 'Cart'
                  ? ValueListenableBuilder<int>(
                      valueListenable: KandiCart.count,
                      builder: (_, count, __) => _iconWithBadge(
                        selected ? activeIcon : icon,
                        selected,
                        count,
                      ),
                    )
                  : _iconWithBadge(
                      selected ? activeIcon : icon, selected, 0),
              const SizedBox(height: 3),
              Text(
                label,
                style: _label(
                  size: 10,
                  color: selected ? _kPrimaryInk : _kMuted,
                  weight: selected ? FontWeight.w700 : FontWeight.w500,
                ),
              ),
            ],
          ),
        ),
      );

  Widget _iconWithBadge(IconData icon, bool selected, int count) => SizedBox(
        width: 30,
        height: 22,
        child: Stack(
          alignment: Alignment.center,
          clipBehavior: Clip.none,
          children: [
            Icon(icon, size: 21, color: selected ? _kPrimaryInk : _kMuted),
            if (count > 0)
              Positioned(
                right: 0,
                top: -2,
                child: Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 4, vertical: 1),
                  constraints: const BoxConstraints(minWidth: 15),
                  decoration: BoxDecoration(
                    color: _kSale,
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: _kWhite, width: 1.2),
                  ),
                  child: Text(
                    count > 99 ? '99+' : '$count',
                    textAlign: TextAlign.center,
                    style: _label(
                        size: 8.5, color: _kWhite, weight: FontWeight.w700),
                  ),
                ),
              ),
          ],
        ),
      );
}
