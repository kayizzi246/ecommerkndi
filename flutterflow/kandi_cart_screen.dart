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

// Navigation only — the five top-level destinations plus checkout. Circular
// between the tab pages, which Dart allows: they reference each other's widget
// classes and nothing at load time.
import '/custom_code/widgets/kandi_checkout_screen.dart';
import '/custom_code/widgets/kandi_verify_screen.dart';
import '/custom_code/widgets/kandi_shop_screen.dart';
import '/custom_code/widgets/kandi_wishlist_screen.dart';
import '/custom_code/widgets/kandi_account_screen.dart';

// ============================================================
//  KANDI — CART PAGE
//
//  What is in the basket, what it comes to, and the way out.
//
//  Self-contained like every page in this app — its own
//  palette, HTTP and model, all file-private so two pages
//  cannot collide in FlutterFlow's flat widget folder. The full
//  reasoning is at the head of kandi_home_screen.dart.
//
//  ---- How the basket gets here ----
//
//  Through the disk, not through code. There is no shared cart
//  object for three pages to hold, so what they share is the
//  STORAGE: one SharedPreferences key, one JSON shape. The home
//  page and the product page write it; this page reads it. None
//  of the three imports the others for it.
//
//  The cost of that is real and worth naming: this page has to
//  re-read on every open, because it has no way to be told the
//  basket changed while it was closed. That is why the load
//  happens in `initState` and again whenever the page is
//  returned to.
//
//  ---- Prices are re-checked, not trusted ----
//
//  A line stores the unit price AS IT WAS when it was added.
//  Prices move, and a basket picked up a week later must not
//  bill last week's figure — so this page asks the API what
//  each product costs NOW and shows the difference where there
//  is one. That check belongs here rather than at checkout,
//  where a surprise is a lost order.
// ============================================================

class _KColors {
  const _KColors._();
  static const Color canvas = Color(0xFFFFFFFF);
  static const Color panel = Color(0xFFFFFFFF);
  static const Color ink = Color(0xFF0B0B0B);
  static const Color body = Color(0xFF414346);
  static const Color muted = Color(0xFF5D6066);
  static const Color faint = Color(0xFF8E9196);
  /// The ground behind a product photograph.
  ///
  /// Warm rather than neutral, and that is the point: most of this catalogue is
  /// shot on white, so the box behind it has to be a shade the white sits ON.
  /// A grey would read as a grey rectangle behind the product; #FBF7F4 reads as
  /// paper. It is `--color-shop-photo` on the site.
  static const Color photo = Color(0xFFFBF7F4);

  static const Color line = Color(0xFFE0E0E0);
  static const Color primary = Color(0xFFFF6A00);
  static const Color primarySoft = Color(0xFFFFF3E8);
  static const Color save = Color(0xFF15803D);
  static const Color saveSoft = Color(0xFFECFDF3);
  static const Color warn = Color(0xFFB45309);
  static const Color warnSoft = Color(0xFFFDF3E6);

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


/// ---- The brand gradient ----
///
/// It carries the chrome — app bars, the home band, the primary buttons — so
/// that every screen is recognisably one shop.
///
/// Three stops on a diagonal, where this was two across the horizontal. Both
/// changes are the same change: a two-stop ramp between two colours half a hue
/// apart is a flat wash with a slight lean, and on a 56px app bar it reads as
/// one muddy orange. Running it corner to corner gives the ramp the bar's
/// diagonal to travel rather than its width, and the middle stop is what stops
/// the two ends averaging into the middle.
///
/// The dark end went DOWN, from #D62200 to #A81100, and that is a legibility
/// change rather than a taste one. Every app bar in this app sets white type
/// on this gradient; white on #FF6A00 is 2.9:1, which is why the palette note
/// says brand orange is never a large ground under white text. It is one here
/// whatever the note says, so the answer is to make most of the ground darker:
/// white on #A81100 is 8.1:1, and the bright end is now a corner rather than
/// half the bar.
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
/// hue and puts the bar back in the 2.9:1 band the gradient above just climbed
/// out of; white at 18% lifts the value and leaves the hue alone, and the
/// corner it lifts is the corner that was already brightest.
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
const String _apiBase = 'https://kandiug.com';

/// The one string every page in this app agrees on. Change it here and it must
/// change in every page file at the same time.
const String _basketKey = 'kandi-cart-v1';

/// ---- The two keys the checkout gate is decided on ----
///
/// The basket reads them and nothing else. Both present means this device has
/// a session AND a number the shop has proved, which is everything the
/// checkout needs before it can take money; either one missing sends the
/// shopper through the verify page first.
///
/// Read here rather than asked of the server: the token is opaque to the app,
/// so a round trip could only report what these two already say, and it would
/// put a spinner on the one button in the app that must never hesitate. A
/// token the shop has stopped accepting is caught where it shows up instead -
/// `/api/checkout` answers 401, the checkout clears both keys, and the next
/// trip through this button lands on the gate.
const String _authKey = 'kandi-auth-v1';
const String _verifiedPhoneKey = 'kandi-verified-phone';

String _money(num amount) {
  final whole = amount.round().toString();
  final out = StringBuffer();
  for (int i = 0; i < whole.length; i++) {
    if (i > 0 && (whole.length - i) % 3 == 0) out.write(',');
    out.write(whole[i]);
  }
  return 'UGX $out';
}

/// One line in the basket.
class _KLine {
  _KLine({
    required this.key,
    required this.productId,
    required this.name,
    required this.image,
    required this.price,
    required this.priceLabel,
    required this.quantity,
    this.variantLabel,
  });

  final String key;
  final int productId;
  final String name;
  final String image;

  /// The unit price when the line was added.
  final num price;
  final String priceLabel;
  int quantity;
  final String? variantLabel;

  /// What the shop charges now, once re-checked. Null until the check runs.
  ///
  /// Set by `_recheck` after construction rather than passed in: a line is
  /// built from what was SAVED, and the live figure is a fact about the shop
  /// that arrives later. Making it a constructor argument would invite a caller
  /// to supply both at once, which is the state this page exists to compare.
  num? livePrice;

  /// False when the product has gone out of stock since it was added. Set by
  /// `_recheck`, for the same reason as `livePrice`.
  bool available = true;

  /// Billed at the live price where one is known — the basket must total what
  /// the checkout will actually charge.
  num get unit => livePrice ?? price;
  num get lineTotal => unit * quantity;

  /// Whether the price moved since it was added, in either direction.
  bool get priceChanged => livePrice != null && livePrice != price;

  Map<String, dynamic> toJson() => {
        'key': key,
        'productId': productId,
        'name': name,
        'image': image,
        'price': price,
        'priceLabel': priceLabel,
        'quantity': quantity,
        'variantLabel': variantLabel,
      };

  static _KLine? from(dynamic json) {
    if (json is! Map) return null;
    final id = json['productId'];
    final quantity = json['quantity'];
    if (id is! int || quantity is! int || quantity < 1) return null;
    return _KLine(
      key: (json['key'] ?? '$id::').toString(),
      productId: id,
      name: (json['name'] ?? '').toString(),
      image: (json['image'] ?? '').toString(),
      price: json['price'] is num ? json['price'] as num : 0,
      priceLabel: (json['priceLabel'] ?? '').toString(),
      quantity: quantity,
      variantLabel: json['variantLabel']?.toString(),
    );
  }
}

class KandiCartScreen extends StatefulWidget {
  const KandiCartScreen({super.key, this.width, this.height});

  final double? width;
  final double? height;

  @override
  State<KandiCartScreen> createState() => _KandiCartScreenState();
}

class _KandiCartScreenState extends State<KandiCartScreen> {
  List<_KLine> _lines = [];
  bool _loading = true;
  bool _checking = false;
  num _freeDeliveryFrom = 0;
  int _returnsDays = 0;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);

    final lines = <_KLine>[];
    try {
      final prefs = await SharedPreferences.getInstance();
      final raw = prefs.getString(_basketKey);
      if (raw != null) {
        final decoded = jsonDecode(raw);
        if (decoded is List) {
          for (final entry in decoded) {
            final line = _KLine.from(entry);
            if (line != null) lines.add(line);
          }
        }
      }
    } catch (_) {
      // A basket that will not parse is one from an older build. Starting
      // empty is recoverable; throwing takes out the screen.
    }

    if (!mounted) return;
    setState(() {
      _lines = lines;
      _loading = false;
    });

    if (lines.isNotEmpty) _recheck();
  }

  /// Asks the shop what each line costs now.
  ///
  /// One request per distinct product. That is fine for a basket — a basket is
  /// a handful of lines, not a catalogue — and it uses the same product
  /// endpoint the product page does rather than needing a new bulk route.
  Future<void> _recheck() async {
    setState(() => _checking = true);

    final ids = _lines.map((line) => line.productId).toSet();
    final prices = <int, num>{};
    final stock = <int, bool>{};
    num? freeFrom;
    int? returns;

    for (final id in ids) {
      try {
        final response = await http
            .get(Uri.parse('$_apiBase/api/app/product/$id'))
            .timeout(const Duration(seconds: 12));
        if (response.statusCode != 200) continue;
        final data = jsonDecode(response.body);
        if (data is! Map) continue;
        final product = data['product'];
        if (product is! Map) continue;
        if (product['price'] is num) prices[id] = product['price'] as num;
        stock[id] = product['inStock'] != false;
        final commerce = data['commerce'];
        if (commerce is Map) {
          if (commerce['freeDeliveryFrom'] is num) {
            freeFrom = commerce['freeDeliveryFrom'] as num;
          }
          if (commerce['returnsDays'] is int) {
            returns = commerce['returnsDays'] as int;
          }
        }
      } catch (_) {
        // A line whose check fails keeps its stored price. Better a slightly
        // stale figure than a basket that refuses to open on a bad connection.
      }
    }

    if (!mounted) return;
    setState(() {
      _checking = false;
      if (freeFrom != null) _freeDeliveryFrom = freeFrom;
      if (returns != null) _returnsDays = returns;
      for (final line in _lines) {
        final live = prices[line.productId];
        if (live != null) line.livePrice = live;
        final inStock = stock[line.productId];
        if (inStock != null) line.available = inStock;
      }
    });
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
                active: 3 == 0,
                onTap: () => _tab(null),
              ),
              _NavItem(
                icon: Icons.grid_view_rounded,
                label: 'Shop',
                active: 3 == 1,
                onTap: 3 == 1 ? null : () => _tab(const KandiShopScreen()),
              ),
              _NavItem(
                icon: Icons.favorite_border_rounded,
                label: 'Saved',
                active: 3 == 2,
                onTap: 3 == 2 ? null : () => _tab(const KandiWishlistScreen()),
              ),
              _NavItem(
                icon: Icons.shopping_cart_outlined,
                label: 'Basket',
                active: 3 == 3,
                badge: _count,
                onTap: 3 == 3 ? null : () => _tab(const KandiCartScreen()),
              ),
              _NavItem(
                icon: Icons.person_outline_rounded,
                label: 'Account',
                active: 3 == 4,
                onTap: 3 == 4 ? null : () => _tab(const KandiAccountScreen()),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _persist() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(
        _basketKey,
        jsonEncode(_lines.map((line) => line.toJson()).toList()),
      );
    } catch (_) {
      // The basket is still correct for this session; a failed write costs
      // persistence across a restart, which is not worth an error the shopper
      // cannot act on.
    }
  }

  Future<void> _setQuantity(_KLine line, int quantity) async {
    setState(() {
      if (quantity < 1) {
        _lines.removeWhere((entry) => entry.key == line.key);
      } else {
        line.quantity = quantity;
      }
    });
    await _persist();
  }

  Future<void> _remove(_KLine line) async {
    // Removing is undoable rather than confirmed. A confirmation dialogue on
    // every removal is four taps to tidy a basket; an undo is one tap only if
    // it was a mistake, and costs nothing when it was not.
    final index = _lines.indexWhere((entry) => entry.key == line.key);
    setState(() => _lines.removeWhere((entry) => entry.key == line.key));
    await _persist();

    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('${line.name} removed'),
        behavior: SnackBarBehavior.floating,
        action: SnackBarAction(
          label: 'Undo',
          textColor: Colors.white,
          onPressed: () async {
            setState(() =>
                _lines.insert(index.clamp(0, _lines.length), line));
            await _persist();
          },
        ),
      ),
    );
  }

  num get _subtotal =>
      _lines.fold<num>(0, (total, line) => total + line.lineTotal);

  int get _count => _lines.fold<int>(0, (total, line) => total + line.quantity);

  bool get _hasUnavailable => _lines.any((line) => !line.available);

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
            _lines.isEmpty ? 'Basket' : 'Basket ($_count)',
            style: const TextStyle(
                fontSize: 16, fontWeight: FontWeight.w700, color: Colors.white),
          ),
        ),
        body: _buildBody(),
        // ---- Two bars, stacked ----
        //
        // The checkout summary sits ON TOP of the tab bar rather than replacing
        // it. Dropping the tabs here would strand a shopper who opened the
        // basket to check a total and then wanted to carry on browsing — their
        // only way out would be the back arrow, which on a basket reached from
        // the tab bar goes to Home rather than to where they were shopping.
        //
        // `mainAxisSize.min` so the column is exactly as tall as its children;
        // a `bottomNavigationBar` is unconstrained vertically and a Column
        // without it would try to fill the screen.
        //
        // The summary keeps its own `SafeArea` padding off, because the nav bar
        // below is now the thing touching the home indicator.
        bottomNavigationBar: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (_lines.isNotEmpty) _buildSummary(),
            _buildBottomNav(),
          ],
        ),
      ),
    );
  }

  Widget _buildBody() {
    if (_loading) {
      return const Center(
          child: CircularProgressIndicator(color: _KColors.primary));
    }

    if (_lines.isEmpty) {
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
                child: const Icon(Icons.shopping_bag_outlined,
                    size: 34, color: _KColors.primary),
              ),
              const SizedBox(height: _KSpace.lg),
              const Text('Your basket is empty',
                  style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w800,
                      color: _KColors.ink)),
              const SizedBox(height: _KSpace.sm),
              const Text(
                'Anything you add will be waiting here, even if you close the app.',
                textAlign: TextAlign.center,
                style: TextStyle(
                    fontSize: 13.5, height: 1.5, color: _KColors.body),
              ),
              const SizedBox(height: _KSpace.xl),
              SizedBox(
                width: 220,
                height: 48,
                child: FilledButton(
                  // Back rather than a push to Home: this screen was opened
                  // FROM somewhere, and pushing a second copy of that would
                  // leave two on the stack.
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
                  child: const Text('Continue shopping',
                      style: TextStyle(
                          fontSize: 15, fontWeight: FontWeight.w700)),
                ),
              ),
            ],
          ),
        ),
      );
    }

    return ListView(
      padding: const EdgeInsets.fromLTRB(
          _KSpace.lg, _KSpace.lg, _KSpace.lg, _KSpace.xl),
      children: [
        if (_checking)
          const Padding(
            padding: EdgeInsets.only(bottom: _KSpace.md),
            child: Row(
              children: [
                SizedBox(
                    width: 13,
                    height: 13,
                    child: CircularProgressIndicator(
                        strokeWidth: 2, color: _KColors.muted)),
                SizedBox(width: _KSpace.sm),
                Text('Checking prices and stock…',
                    style: TextStyle(fontSize: 12.5, color: _KColors.muted)),
              ],
            ),
          ),
        if (_hasUnavailable)
          Container(
            margin: const EdgeInsets.only(bottom: _KSpace.md),
            padding: const EdgeInsets.all(_KSpace.md),
            decoration: BoxDecoration(
              color: _KColors.warnSoft,
              borderRadius: BorderRadius.circular(_rChip),
            ),
            child: const Row(
              children: [
                Icon(Icons.info_outline_rounded,
                    size: 17, color: _KColors.warn),
                SizedBox(width: _KSpace.sm),
                Expanded(
                  child: Text(
                    'Some items went out of stock. Remove them to check out.',
                    style: TextStyle(
                        fontSize: 12.5,
                        fontWeight: FontWeight.w600,
                        color: _KColors.warn),
                  ),
                ),
              ],
            ),
          ),
        if (_freeDeliveryFrom > 0) _buildDeliveryMeter(),
        for (final line in _lines) _buildLine(line),
      ],
    );
  }

  /// How close the basket is to free delivery.
  ///
  /// The single most effective thing a basket screen can show: a shopper
  /// UGX 12,000 short of free delivery is a shopper who will add something,
  /// and a bar that says so converts better than the same fact in a sentence.
  Widget _buildDeliveryMeter() {
    final remaining = _freeDeliveryFrom - _subtotal;
    final qualifies = remaining <= 0;
    final progress =
        _freeDeliveryFrom <= 0 ? 1.0 : (_subtotal / _freeDeliveryFrom).clamp(0.0, 1.0);

    return Container(
      margin: const EdgeInsets.only(bottom: _KSpace.lg),
      padding: const EdgeInsets.all(_KSpace.md),
      decoration: BoxDecoration(
        color: qualifies ? _KColors.saveSoft : _KColors.panel,
        borderRadius: BorderRadius.circular(_rPanel),
        border: Border.all(
            color: qualifies ? _KColors.saveSoft : _KColors.line),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            qualifies
                ? 'Your order ships free'
                : 'Add ${_money(remaining)} more for free delivery',
            style: TextStyle(
              fontSize: 13.5,
              fontWeight: FontWeight.w700,
              color: qualifies ? _KColors.save : _KColors.ink,
            ),
          ),
          const SizedBox(height: _KSpace.sm),
          ClipRRect(
            borderRadius: BorderRadius.circular(4),
            child: LinearProgressIndicator(
              value: progress.toDouble(),
              minHeight: 6,
              backgroundColor: _KColors.photo,
              valueColor: AlwaysStoppedAnimation<Color>(
                  qualifies ? _KColors.save : _KColors.primary),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildLine(_KLine line) {
    return Container(
      margin: const EdgeInsets.only(bottom: _KSpace.md),
      padding: const EdgeInsets.all(_KSpace.md),
      decoration: BoxDecoration(
        color: _KColors.panel,
        borderRadius: BorderRadius.circular(_rPanel),
        border: Border.all(color: _KColors.edge),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(_rPhoto),
            child: SizedBox(
              width: 84,
              height: 84,
              child: line.image.isEmpty
                  ? const ColoredBox(color: _KColors.photo)
                  : CachedNetworkImage(
                      httpHeaders: _kImageHeaders,
                      imageUrl: line.image,
                      fit: BoxFit.cover,
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
                Text(line.name,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                        fontSize: 13.5, height: 1.35, color: _KColors.ink)),
                if (line.variantLabel != null &&
                    line.variantLabel!.isNotEmpty) ...[
                  const SizedBox(height: 2),
                  Text(line.variantLabel!,
                      style: const TextStyle(
                          fontSize: 12, color: _KColors.muted)),
                ],
                const SizedBox(height: _KSpace.sm),
                Row(
                  crossAxisAlignment: CrossAxisAlignment.baseline,
                  textBaseline: TextBaseline.alphabetic,
                  children: [
                    Text(_money(line.unit),
                        style: const TextStyle(
                            fontSize: 15.5,
                            letterSpacing: -0.3,
                            fontWeight: FontWeight.w900,
                            color: _KColors.flame)),
                    // The old figure struck through, so a price rise is
                    // visible rather than silent. A shopper who finds out at
                    // checkout does not check out.
                    if (line.priceChanged) ...[
                      const SizedBox(width: 6),
                      Text(_money(line.price),
                          style: const TextStyle(
                              fontSize: 12,
                              color: _KColors.faint,
                              decoration: TextDecoration.lineThrough)),
                    ],
                  ],
                ),
                if (!line.available)
                  const Padding(
                    padding: EdgeInsets.only(top: 4),
                    child: Text('Out of stock',
                        style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w700,
                            color: _KColors.warn)),
                  ),
                const SizedBox(height: _KSpace.sm),
                Row(
                  children: [
                    _StepButton(
                      icon: Icons.remove_rounded,
                      onTap: () => _setQuantity(line, line.quantity - 1),
                    ),
                    Padding(
                      padding:
                          const EdgeInsets.symmetric(horizontal: _KSpace.md),
                      child: Text('${line.quantity}',
                          style: const TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.w700,
                              color: _KColors.ink)),
                    ),
                    _StepButton(
                      icon: Icons.add_rounded,
                      onTap: () => _setQuantity(line, line.quantity + 1),
                    ),
                    const Spacer(),
                    IconButton(
                      onPressed: () => _remove(line),
                      tooltip: 'Remove',
                      visualDensity: VisualDensity.compact,
                      icon: const Icon(Icons.delete_outline_rounded,
                          size: 20, color: _KColors.muted),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSummary() {
    final blocked = _hasUnavailable;
    return Container(
      // No safe-area padding any more: the nav bar below this one is what sits
      // against the home indicator now, and it carries its own.
      padding: const EdgeInsets.fromLTRB(
          _KSpace.lg, _KSpace.md, _KSpace.lg, _KSpace.md),
      decoration: const BoxDecoration(
        color: _KColors.panel,
        border: Border(top: BorderSide(color: _KColors.line)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            children: [
              const Text('Subtotal',
                  style: TextStyle(fontSize: 13.5, color: _KColors.muted)),
              const Spacer(),
              // The one figure a shopper came to this screen for, printed in
              // the money colour at the largest size on the bar.
              Text(_money(_subtotal),
                  style: const TextStyle(
                      fontSize: 22,
                      height: 1.1,
                      letterSpacing: -0.5,
                      fontWeight: FontWeight.w900,
                      color: _KColors.flame)),
            ],
          ),
          const SizedBox(height: 2),
          // One line of small print, and it has to be allowed to shrink.
          // Unflexed in a Row it takes its natural width and overflows the bar
          // at a raised text size — the returns figure is the shop's and can
          // be two digits, so the string is not a fixed length either.
          Row(
            children: [
              Flexible(
                child: Text(
                  _returnsDays > 0
                      ? 'Delivery at checkout · $_returnsDays-day returns'
                      : 'Delivery calculated at checkout',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontSize: 11.5, color: _KColors.muted),
                ),
              ),
            ],
          ),
          const SizedBox(height: _KSpace.md),
          // The gradient rather than a flat fill. This is the last button
          // between a basket and an order, and the gradient is what separates
          // it from the dozen flat ones behind it in the flow.
          _GradientButton(
            label: blocked
                ? 'Remove out-of-stock items'
                : 'Checkout · ${_money(_subtotal)}',
            enabled: !blocked,
            onTap: _checkout,
          ),
        ],
      ),
    );
  }

  /// Whether this device still has to prove who it is.
  ///
  /// True for a shopper who has never verified on this phone, and for one
  /// whose session the shop has since rejected — the checkout clears both keys
  /// on a 401, so a dead token reads the same as no token, which is what it is.
  ///
  /// Storage failing is treated as "not verified". The alternative is to let a
  /// shopper through to a checkout that will fail at `/api/checkout` with a
  /// 403 and no way forward; an extra screen is the cheaper of the two wrong
  /// answers.
  Future<bool> _needsVerifying() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final token = prefs.getString(_authKey);
      final phone = prefs.getString(_verifiedPhoneKey);
      return token == null ||
          token.isEmpty ||
          phone == null ||
          phone.isEmpty;
    } catch (_) {
      return true;
    }
  }

  Future<void> _checkout() async {
    // ---- The gate goes here, not in the checkout ----
    //
    // Proving a phone number used to happen inside `_placeOrder`, after the
    // shopper had filled in a name, a town and an address and pressed the
    // button that says how much they are about to pay. That is the worst
    // moment in the flow to stop someone, and it is the moment it stopped
    // them.
    //
    // Asked here, it costs a first-time shopper one screen at the point where
    // they have decided to buy and not yet committed to a form. A shopper who
    // has verified before never sees it: both keys are set, this returns
    // false, and the checkout opens exactly as it did.
    //
    // The checkout keeps its own copy of the check. That is not redundant -
    // it can be reached from a FlutterFlow action or a deep link that never
    // passed through this button, and it is the screen that finds out when a
    // token has gone stale.
    final gate = await _needsVerifying();
    if (!mounted) return;

    // Checkout collects the delivery details and takes the payment. Nothing is
    // passed to either page: they read the basket from the same key this page
    // wrote, and the verify page replaces itself with the checkout when it is
    // done, so Back from the checkout lands here either way.
    await Navigator.of(context).push(MaterialPageRoute(
      builder: (_) =>
          gate ? const KandiVerifyScreen() : const KandiCheckoutScreen(),
    ));

    // The basket can come back changed — a shopper who paid clears it, and one
    // who backed out may have edited it. Re-reading is cheaper than assuming
    // either way.
    if (mounted) await _load();
  }
}

/// The primary call to action: a gradient pill, full width.
///
/// Not a `FilledButton`, because `FilledButton` takes a flat colour and the
/// gradient is the point. `Material` + `InkWell` over the gradient keeps the
/// tap ripple a plain button would have given — a big coloured slab that does
/// not respond to a finger reads as broken while the next screen loads.
class _GradientButton extends StatelessWidget {
  const _GradientButton({
    required this.label,
    required this.enabled,
    required this.onTap,
  });

  final String label;
  final bool enabled;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      height: 50,
      decoration: BoxDecoration(
        gradient: enabled ? _brandGradient : null,
        color: enabled ? null : _KColors.line,
        borderRadius: BorderRadius.circular(_rPill),
        // ---- A coloured shadow, not a grey one ----
        //
        // The page is white and so is every panel on it, so a button drawn
        // flat on that page is the same plane as everything else and has to
        // rely on its fill alone to read as pressable.
        //
        // The shadow is a wash of the button's own dark end at 20% rather
        // than black at 20%. Black under a saturated colour greys the
        // pixels it falls on and reads as dirt; the same hue reads as the
        // colour bleeding onto the paper, which is what a lit object
        // actually does. It is only drawn when the button is live - a
        // disabled control that floats is a disabled control that gets
        // tapped.
        boxShadow: enabled
            ? const [
                BoxShadow(
                  color: Color(0x33A81100),
                  blurRadius: 18,
                  offset: Offset(0, 8),
                ),
              ]
            : null,
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: enabled ? onTap : null,
          borderRadius: BorderRadius.circular(_rPill),
          child: Center(
            child: Text(
              label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                  fontSize: 15.5,
                  fontWeight: FontWeight.w800,
                  color: enabled ? Colors.white : _KColors.muted),
            ),
          ),
        ),
      ),
    );
  }
}

class _StepButton extends StatelessWidget {
  const _StepButton({required this.icon, required this.onTap});

  final IconData icon;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(_rChip),
      child: Container(
        width: 32,
        height: 32,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(_rChip),
          border: Border.all(color: _KColors.line),
        ),
        child: Icon(icon, size: 17, color: _KColors.ink),
      ),
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
