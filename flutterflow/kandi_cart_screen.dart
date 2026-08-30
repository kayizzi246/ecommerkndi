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

// Navigation only — the five top-level destinations plus checkout. Circular
// between the tab pages, which Dart allows: they reference each other's widget
// classes and nothing at load time.
import '/custom_code/widgets/kandi_checkout_screen.dart';
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
  static const Color canvas = Color(0xFFF2F4F7);
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
  static const Color saveSoft = Color(0xFFECFDF3);
  static const Color warn = Color(0xFFB45309);
  static const Color warnSoft = Color(0xFFFDF3E6);
}

class _KSpace {
  const _KSpace._();
  static const double sm = 8;
  static const double md = 12;
  static const double lg = 16;
  static const double xl = 24;
}

const double _rPanel = 14;
const double _rPhoto = 10;
const double _rChip = 8;
const String _apiBase = 'https://kandiug.com';

/// The one string every page in this app agrees on. Change it here and it must
/// change in every page file at the same time.
const String _basketKey = 'kandi-cart-v1';

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
      ),
      child: SafeArea(
        top: false,
        child: SizedBox(
          height: 58,
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
          backgroundColor: _KColors.panel,
          surfaceTintColor: _KColors.panel,
          elevation: 0,
          scrolledUnderElevation: 0.5,
          iconTheme: const IconThemeData(color: _KColors.ink),
          title: Text(
            _lines.isEmpty ? 'Basket' : 'Basket ($_count)',
            style: const TextStyle(
                fontSize: 16, fontWeight: FontWeight.w700, color: _KColors.ink),
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
                    backgroundColor: _KColors.primary,
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(_rChip)),
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
              backgroundColor: _KColors.hairline,
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
        border: Border.all(color: _KColors.line),
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
                  ? const ColoredBox(color: _KColors.hairline)
                  : CachedNetworkImage(
                      imageUrl: line.image,
                      fit: BoxFit.cover,
                      placeholder: (_, __) =>
                          const ColoredBox(color: _KColors.hairline),
                      errorWidget: (_, __, ___) =>
                          const ColoredBox(color: _KColors.hairline),
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
                            fontSize: 15,
                            fontWeight: FontWeight.w800,
                            color: _KColors.ink)),
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
              Text(_money(_subtotal),
                  style: const TextStyle(
                      fontSize: 20,
                      fontWeight: FontWeight.w800,
                      color: _KColors.ink)),
            ],
          ),
          const SizedBox(height: 2),
          Row(
            children: [
              Text(
                _returnsDays > 0
                    ? 'Delivery at checkout · $_returnsDays-day returns'
                    : 'Delivery calculated at checkout',
                style: const TextStyle(fontSize: 11.5, color: _KColors.muted),
              ),
            ],
          ),
          const SizedBox(height: _KSpace.md),
          SizedBox(
            width: double.infinity,
            height: 50,
            child: FilledButton(
              onPressed: blocked ? null : _checkout,
              style: FilledButton.styleFrom(
                backgroundColor: _KColors.primary,
                disabledBackgroundColor: _KColors.line,
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(_rChip)),
              ),
              child: Text(
                blocked
                    ? 'Remove out-of-stock items'
                    : 'Checkout · ${_money(_subtotal)}',
                style: const TextStyle(
                    fontSize: 15.5, fontWeight: FontWeight.w700),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _checkout() async {
    // Checkout collects the delivery details and hands the shopper to the
    // shop's own payment page. Nothing is passed: it reads the basket from the
    // same key this page wrote.
    await Navigator.of(context)
        .push(MaterialPageRoute(builder: (_) => const KandiCheckoutScreen()));
    // The basket can come back changed — a shopper who paid on the website
    // clears it there, and one who backed out may have edited it. Re-reading is
    // cheaper than assuming either way.
    if (mounted) await _load();
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
    final colour = active ? _KColors.primary : _KColors.muted;
    return Expanded(
      child: InkWell(
        onTap: onTap,
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Stack(
              clipBehavior: Clip.none,
              children: [
                Icon(icon, size: 22, color: colour),
                if (badge > 0)
                  Positioned(
                    right: -7,
                    top: -5,
                    child: Container(
                      padding:
                          const EdgeInsets.symmetric(horizontal: 4, vertical: 1),
                      constraints: const BoxConstraints(minWidth: 16),
                      decoration: BoxDecoration(
                        color: _KColors.primary,
                        borderRadius: BorderRadius.circular(8),
                        // A white ring keeps the badge legible over the icon.
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
            const SizedBox(height: 3),
            Text(label,
                style: TextStyle(
                    fontSize: 10.5, fontWeight: FontWeight.w600, color: colour)),
          ],
        ),
      ),
    );
  }
}
