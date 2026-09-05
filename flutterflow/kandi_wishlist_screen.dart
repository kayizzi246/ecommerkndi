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
import 'package:shared_preferences/shared_preferences.dart';

// Navigation only — the five top-level destinations plus this page's own
// detail screens. Circular between the tab pages, which Dart allows: they
// reference each other's widget classes and nothing at load time.
import '/custom_code/widgets/kandi_product_screen.dart';
import '/custom_code/widgets/kandi_cart_screen.dart';
import '/custom_code/widgets/kandi_shop_screen.dart';
import '/custom_code/widgets/kandi_account_screen.dart';

// ============================================================
//  KANDI — SAVED ITEMS
//
//  Self-contained like every page here. The architecture is at
//  the head of kandi_home_screen.dart.
//
//  ---- Why this page makes no network request ----
//
//  The wishlist stores enough of each product to draw a tile —
//  id, name, image, price and its label — so opening it is
//  instant and works with no signal. A saved list that has to
//  fetch each item one request at a time takes a second to
//  open and shows nothing on a train.
//
//  The cost is that a price here can be stale. That is the
//  right trade for a list whose whole job is "things I might
//  buy later": the product page and the basket both re-check
//  against the API, so the stale figure never reaches a
//  decision that matters. Tapping through corrects it.
// ============================================================

class _KColors {
  const _KColors._();
  static const Color canvas = Color(0xFFFFFFFF);
  static const Color panel = Color(0xFFFFFFFF);
  static const Color ink = Color(0xFF0B0B0B);
  static const Color body = Color(0xFF414346);
  static const Color muted = Color(0xFF5D6066);
  static const Color line = Color(0xFFE0E0E0);
  static const Color primary = Color(0xFFFF6A00);
  static const Color primarySoft = Color(0xFFFFF3E8);

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

/// ---- Panel corners: 16, where this was 12 ----
///
/// This governs the CHROME only - sheets, the shelf grounds, the terms
/// strip, the panels on the account, checkout and seller pages. It does not
/// reach the product tile, which has square corners and a drawn ring copied
/// row by row off the website's `.tile-card` and must stay that way: the
/// site squares its tiles so they can touch in a flush grid, and a tile
/// rounded here and square there is the most obvious way the two clients
/// stop looking like one shop.
///
/// So the app now draws two corner radii on purpose - a square catalogue on
/// softened furniture - and that is the distinction rather than an
/// inconsistency. 12 sat between the two and read as neither.
const double _rPanel = 16;
const double _rPhoto = 8;
const double _rChip = 8;

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
/// that every screen is recognisably one shop.
///
/// Three stops on a diagonal, where this was two across the horizontal: a
/// two-stop ramp between two colours half a hue apart is a flat wash with a
/// slight lean, and the corner-to-corner run gives it the bar's diagonal to
/// travel rather than its width. The dark end also went down to #A81100, so
/// that white type on it clears 8:1 over most of the bar instead of the 2.9:1
/// brand orange gives.
const LinearGradient _brandGradient = LinearGradient(
  begin: Alignment.topLeft,
  end: Alignment.bottomRight,
  colors: [Color(0xFFFF6A00), Color(0xFFE03400), Color(0xFFA81100)],
  stops: [0.0, 0.52, 1.0],
);

/// The brand gradient with a light bloom over it.
///
/// ---- Why the bloom is a second layer ----
///
/// A LinearGradient can only ramp along a line, and what makes a coloured
/// surface look LIT rather than filled is a highlight that falls off in a
/// circle. Painting a soft white radial over the top-left corner is the whole
/// of it: the bar stops being a coloured rectangle and starts having a light
/// source, which is the cheapest thing that separates a designed surface from
/// a filled one.
///
/// White rather than a lighter orange, on purpose. A lighter orange moves the
/// hue and puts the bar back in the 2.9:1 band the gradient just climbed out
/// of; white at 18% lifts the value and leaves the hue alone, and the corner
/// it lifts is the corner that was already brightest.
///
/// ---- It takes its size from its child ----
///
/// The gradients are `Positioned.fill` and the child is not, so the Stack
/// measures the child and the paint stretches to it. That is the only
/// arrangement that works in both places this is used: an AppBar's
/// `flexibleSpace`, which hands down a finite height, and the home page's
/// masthead, which sits in a Column inside a sliver where the height
/// constraint is unbounded.
///
/// Written the obvious way - a `SizedBox.expand` in each gradient layer -
/// the bar is correct and the masthead throws, because an expand under an
/// unbounded constraint asks for infinity. The rule the old DecoratedBox
/// followed still holds underneath: a decoration with nothing in it has no
/// size and paints nothing at all, which is why the child is required.
class _BrandSurface extends StatelessWidget {
  const _BrandSurface({required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Stack(
      children: [
        const Positioned.fill(
          child: DecoratedBox(
            decoration: BoxDecoration(gradient: _brandGradient),
          ),
        ),
        const Positioned.fill(
          child: DecoratedBox(
            decoration: BoxDecoration(
              gradient: RadialGradient(
                center: Alignment(-0.75, -1.1),
                radius: 1.5,
                colors: [Color(0x2EFFFFFF), Color(0x00FFFFFF)],
              ),
            ),
          ),
        ),
        child,
      ],
    );
  }
}

/// Fully rounded. The primary calls to action are pills, which is what tells
/// them apart from the square panels they sit on.
const double _rPill = 999;

// The keys every page in this app agrees on.
const String _basketKey = 'kandi-cart-v1';
const String _wishlistKey = 'kandi-wishlist-v1';
const String _openProductKey = 'kandi-open-product';

class _KSaved {
  const _KSaved({
    required this.id,
    required this.name,
    required this.image,
    required this.priceLabel,
    required this.price,
  });

  final int id;
  final String name;
  final String image;
  final String priceLabel;
  final num price;

  Map<String, dynamic> toJson() => {
        'id': id,
        'name': name,
        'image': image,
        'priceLabel': priceLabel,
        'price': price,
      };

  static _KSaved? from(dynamic json) {
    if (json is! Map) return null;
    final id = json['id'];
    if (id is! int) return null;
    return _KSaved(
      id: id,
      name: (json['name'] ?? '').toString(),
      image: (json['image'] ?? '').toString(),
      priceLabel: (json['priceLabel'] ?? '').toString(),
      price: json['price'] is num ? json['price'] as num : 0,
    );
  }
}

class KandiWishlistScreen extends StatefulWidget {
  const KandiWishlistScreen({super.key, this.width, this.height});

  final double? width;
  final double? height;

  @override
  State<KandiWishlistScreen> createState() => _KandiWishlistScreenState();
}

class _KandiWishlistScreenState extends State<KandiWishlistScreen> {
  List<_KSaved> _items = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
    _countBasket();
  }

  /// How many items are in the basket, for the badge on the tab bar.
  ///
  /// Read from the shared basket rather than passed in — like everything else
  /// in this app, the page finds out by looking, not by being told.
  int _cartCount = 0;

  Future<void> _countBasket() async {
    int count = 0;
    try {
      final prefs = await SharedPreferences.getInstance();
      final raw = prefs.getString(_basketKey);
      if (raw != null) {
        final decoded = jsonDecode(raw);
        if (decoded is List) {
          for (final entry in decoded) {
            if (entry is! Map) continue;
            final quantity = entry['quantity'];
            count += quantity is int ? quantity : 1;
          }
        }
      }
    } catch (_) {
      count = 0;
    }
    if (mounted) setState(() => _cartCount = count);
  }


  Future<void> _load() async {
    final items = <_KSaved>[];
    try {
      final prefs = await SharedPreferences.getInstance();
      final raw = prefs.getString(_wishlistKey);
      if (raw != null) {
        final decoded = jsonDecode(raw);
        if (decoded is List) {
          for (final entry in decoded) {
            final item = _KSaved.from(entry);
            if (item != null) items.add(item);
          }
        }
      }
    } catch (_) {
      // A list that will not parse is one from an older build. Starting empty
      // is recoverable; throwing takes out the screen.
    }
    if (!mounted) return;
    setState(() {
      _items = items;
      _loading = false;
    });
  }

  Future<void> _persist() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(
          _wishlistKey, jsonEncode(_items.map((item) => item.toJson()).toList()));
    } catch (_) {}
  }

  Future<void> _remove(_KSaved item) async {
    // Undoable rather than confirmed: a dialogue on every removal is four taps
    // to tidy a list, where an undo costs one tap only when it was a mistake.
    final index = _items.indexWhere((entry) => entry.id == item.id);
    setState(() => _items.removeWhere((entry) => entry.id == item.id));
    await _persist();

    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('${item.name} removed'),
        behavior: SnackBarBehavior.floating,
        action: SnackBarAction(
          label: 'Undo',
          textColor: Colors.white,
          onPressed: () async {
            setState(() => _items.insert(index.clamp(0, _items.length), item));
            await _persist();
          },
        ),
      ),
    );
  }


  /// Switches to a top-level tab without growing the stack.
  ///
  /// `popUntil(isFirst)` returns to the app's root — Home — and the target is
  /// pushed on top of it. Without this, Home → Shop → Account → Basket leaves
  /// four screens stacked and four back taps to escape. With it the stack is
  /// never deeper than Home plus one tab, and Back always means Home.
  ///
  /// A null target is Home itself: pop and push nothing.
  Future<void> _tab(Widget? target) async {
    Navigator.of(context).popUntil((route) => route.isFirst);
    if (target == null || !mounted) return;
    await Navigator.of(context)
        .push(MaterialPageRoute(builder: (_) => target));
    // The basket can come back changed — the shopper may have added to it or
    // emptied it on the screen they just left. Re-counting is cheaper than
    // showing a stale number on the tab bar.
    if (mounted) await _countBasket();
  }

  Widget _buildBottomNav() {
    return Container(
      decoration: const BoxDecoration(
        color: _KColors.panel,
        border: Border(top: BorderSide(color: _KColors.line)),
        boxShadow: [
          BoxShadow(
              color: Color(0x0F000000), blurRadius: 12, offset: Offset(0, -2)),
        ],
      ),
      child: SafeArea(
        top: false,
        child: SizedBox(
          // ---- Measured, where this was a flat 58 ----
          //
          // 58 was the height of the contents at the default text size, and
          // it stayed 58 when a reader raised theirs: at a 1.3 scale the
          // label was clipped by 7px on all five tabbed screens. That is a
          // failure `flutter analyze` cannot see and only a pumped widget
          // test catches.
          //
          // Added up instead: a 30 capsule, a 2 gap, and one line of a 10.5
          // label at 1.25 leading, scaled - plus 12 of breathing room. The
          // scaler is the reader's own setting, so the bar grows with the
          // type rather than around it.
          height: 30 +
              2 +
              MediaQuery.textScalerOf(context).scale(10.5) * 1.25 +
              12,
          child: Row(
            children: [
              _NavItem(
                icon: Icons.home_rounded,
                label: 'Home',
                active: 2 == 0,
                onTap: () => _tab(null),
              ),
              _NavItem(
                icon: Icons.grid_view_rounded,
                label: 'Shop',
                active: 2 == 1,
                onTap: 2 == 1 ? null : () => _tab(const KandiShopScreen()),
              ),
              _NavItem(
                icon: Icons.favorite_border_rounded,
                label: 'Saved',
                active: 2 == 2,
                onTap: 2 == 2 ? null : () => _tab(const KandiWishlistScreen()),
              ),
              _NavItem(
                icon: Icons.shopping_cart_outlined,
                label: 'Basket',
                active: 2 == 3,
                badge: _cartCount,
                onTap: 2 == 3 ? null : () => _tab(const KandiCartScreen()),
              ),
              _NavItem(
                icon: Icons.person_outline_rounded,
                label: 'Account',
                active: 2 == 4,
                onTap: 2 == 4 ? null : () => _tab(const KandiAccountScreen()),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _open(_KSaved item) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_openProductKey, '${item.id}');
    } catch (_) {}
    if (!mounted) return;
    await Navigator.of(context)
        .push(MaterialPageRoute(builder: (_) => const KandiProductScreen()));
    // The product page can save or unsave, so the list is re-read on return.
    await _load();
  }

  Future<void> _add(_KSaved item) async {
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

    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('${item.name} added'),
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
          flexibleSpace: const _BrandSurface(child: SizedBox.expand()),
          systemOverlayStyle: SystemUiOverlayStyle.light,
          iconTheme: const IconThemeData(color: Colors.white),
          title: Text(
            _items.isEmpty ? 'Saved' : 'Saved (${_items.length})',
            style: const TextStyle(
                fontSize: 16, fontWeight: FontWeight.w700, color: Colors.white),
          ),
        ),
        body: _buildBody(),
        bottomNavigationBar: _buildBottomNav(),
      ),
    );
  }

  Widget _buildBody() {
    if (_loading) {
      return const Center(
          child: CircularProgressIndicator(color: _KColors.primary));
    }

    if (_items.isEmpty) {
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
                child: const Icon(Icons.favorite_border_rounded,
                    size: 34, color: _KColors.primary),
              ),
              const SizedBox(height: _KSpace.lg),
              const Text('Nothing saved yet',
                  style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w800,
                      color: _KColors.ink)),
              const SizedBox(height: _KSpace.sm),
              const Text(
                'Tap the heart on anything you want to come back to. It stays here even if you close the app.',
                textAlign: TextAlign.center,
                style: TextStyle(
                    fontSize: 13.5, height: 1.5, color: _KColors.body),
              ),
              const SizedBox(height: _KSpace.xl),
              SizedBox(
                width: 220,
                height: 48,
                child: FilledButton(
                  // Back rather than a push to Home: this page was opened FROM
                  // somewhere, and pushing a second copy leaves two on the
                  // stack.
                  onPressed: () => Navigator.of(context).maybePop(),
                  style: FilledButton.styleFrom(
                    backgroundColor: _KColors.flame,
                    // Lifted on a wash of its own dark end rather than on black.
                    // Black under a saturated colour greys the pixels it falls on
                    // and reads as dirt; the same hue reads as the colour bleeding
                    // onto the paper, which is what a lit object does.
                    elevation: 6,
                    shadowColor: const Color(0x59A81100),
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(_rPill)),
                  ),
                  child: const Text('Start shopping',
                      style: TextStyle(
                          fontSize: 15, fontWeight: FontWeight.w700)),
                ),
              ),
            ],
          ),
        ),
      );
    }

    return ListView.separated(
      padding: const EdgeInsets.all(_KSpace.md),
      itemCount: _items.length,
      separatorBuilder: (_, __) => const SizedBox(height: _KSpace.md),
      itemBuilder: (context, index) {
        final item = _items[index];
        return GestureDetector(
          onTap: () => _open(item),
          behavior: HitTestBehavior.opaque,
          child: Container(
            padding: const EdgeInsets.all(_KSpace.md),
            decoration: BoxDecoration(
              color: _KColors.panel,
              borderRadius: BorderRadius.circular(_rPanel),
              border: Border.all(color: _KColors.edge),
            ),
            child: Row(
              children: [
                ClipRRect(
                  borderRadius: BorderRadius.circular(_rPhoto),
                  child: SizedBox(
                    width: 78,
                    height: 78,
                    child: item.image.isEmpty
                        ? const ColoredBox(color: _KColors.photo)
                        : CachedNetworkImage(
                            httpHeaders: _kImageHeaders,
                            imageUrl: item.image,
                            fit: BoxFit.contain,
                            placeholder: (_, __) =>
                                const ColoredBox(color: _KColors.photo),
                            errorWidget: (_, __, ___) =>
                                const ColoredBox(color: _KColors.photo),
                          ),
                  ),
                ),
                const SizedBox(width: _KSpace.md),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(item.name,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                              fontSize: 13.5,
                              height: 1.35,
                              color: _KColors.ink)),
                      const SizedBox(height: 5),
                      Text(item.priceLabel,
                          style: const TextStyle(
                              fontSize: 15.5,
                              letterSpacing: -0.3,
                              fontWeight: FontWeight.w900,
                              color: _KColors.flame)),
                    ],
                  ),
                ),
                const SizedBox(width: _KSpace.sm),
                Column(
                  children: [
                    GestureDetector(
                      onTap: () => _remove(item),
                      behavior: HitTestBehavior.opaque,
                      child: const Padding(
                        padding: EdgeInsets.all(6),
                        child: Icon(Icons.favorite_rounded,
                            size: 21, color: _KColors.primary),
                      ),
                    ),
                    const SizedBox(height: _KSpace.sm),
                    GestureDetector(
                      onTap: () => _add(item),
                      behavior: HitTestBehavior.opaque,
                      child: Container(
                        width: 34,
                        height: 34,
                        decoration: BoxDecoration(
                          color: _KColors.panel,
                          borderRadius: BorderRadius.circular(_rChip),
                          border: Border.all(color: _KColors.edge),
                        ),
                        child: const Icon(Icons.add_rounded,
                            size: 20, color: _KColors.ink),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}

// ------------------------------------------------------------
//  The bottom bar
// ------------------------------------------------------------

/// One of the five top-level destinations.
///
/// Duplicated in each tab page rather than imported: every page in this app is
/// self-contained, and a shared widget would be the one import that reintroduces
/// the paste-order problem the whole architecture exists to avoid.
class _NavItem extends StatelessWidget {
  const _NavItem({
    required this.icon,
    required this.label,
    this.onTap,
    this.active = false,
    this.badge = 0,
  });

  final IconData icon;
  final String label;
  /// Null on the tab you are already on: InkWell then draws no ripple, which
  /// is the honest signal for "nothing will happen". An empty closure would
  /// ripple and promise otherwise.
  final VoidCallback? onTap;
  final bool active;
  final int badge;

  @override
  Widget build(BuildContext context) {
    final colour = active ? _KColors.flame : _KColors.muted;

    return Expanded(
      child: InkWell(
        onTap: onTap,
        // The ripple used to be a rectangle the full height of the bar,
        // which on a five-across row is a grey slab with no relationship to
        // the mark it is acknowledging. Bounded to the capsule, it lands
        // where the finger did.
        borderRadius: BorderRadius.circular(_rPill),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          mainAxisSize: MainAxisSize.min,
          children: [
            // ---- The capsule is what marks the tab you are on ----
            //
            // The active tab used to be signalled by colour alone: the icon
            // and its label turned from grey to flame and nothing else
            // moved. That is one channel, it is the channel a
            // colour-deficient shopper does not have, and at 22px on a white
            // bar it is a weak signal even with normal vision.
            //
            // A filled capsule behind the icon adds shape and ground to the
            // same fact, which is the standard answer and also the one that
            // makes the bar look drawn rather than defaulted. It carries the
            // brand gradient rather than a flat fill because every other
            // primary surface in the app now does.
            Stack(
              clipBehavior: Clip.none,
              children: [
                AnimatedContainer(
                  duration: const Duration(milliseconds: 180),
                  curve: Curves.easeOut,
                  width: 46,
                  height: 30,
                  decoration: BoxDecoration(
                    gradient: active ? _brandGradient : null,
                    borderRadius: BorderRadius.circular(_rPill),
                    boxShadow: active
                        ? const [
                            BoxShadow(
                              color: Color(0x33D62200),
                              blurRadius: 12,
                              offset: Offset(0, 4),
                            ),
                          ]
                        : null,
                  ),
                  child: Icon(icon,
                      size: 20, color: active ? Colors.white : colour),
                ),
                if (badge > 0)
                  Positioned(
                    right: -4,
                    top: -5,
                    child: Container(
                      padding:
                          const EdgeInsets.symmetric(horizontal: 4, vertical: 1),
                      constraints: const BoxConstraints(minWidth: 16),
                      decoration: BoxDecoration(
                        color: _KColors.flame,
                        borderRadius: BorderRadius.circular(8),
                        // A white ring keeps the badge legible over the icon,
                        // and over the capsule when the tab is the live one.
                        border: Border.all(color: Colors.white, width: 1.4),
                      ),
                      child: Text(
                        badge > 99 ? '99+' : '$badge',
                        textAlign: TextAlign.center,
                        style: const TextStyle(
                            fontSize: 9,
                            height: 1.3,
                            fontWeight: FontWeight.w800,
                            color: Colors.white),
                      ),
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 2),
            // One line, ellipsised, and never wider than its fifth of the
            // bar. 'Account' at a raised text size is what used to push the
            // row wide enough to clip.
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 2),
              child: Text(label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                      fontSize: 10.5,
                      height: 1.25,
                      fontWeight: active ? FontWeight.w800 : FontWeight.w600,
                      color: colour)),
            ),
          ],
        ),
      ),
    );
  }
}
