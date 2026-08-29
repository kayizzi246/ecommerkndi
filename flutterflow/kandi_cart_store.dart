// Automatic FlutterFlow imports
// ---- Two boilerplate imports are deliberately absent ----
//
// FlutterFlow's generated header normally opens with
//
//     import '/backend/backend.dart';
//     import '/backend/supabase/supabase.dart';
//
// and this project has neither file. See the note at the head of
// kandi_design.dart — adding them back breaks the web build in every custom
// widget at once. Do not add them back.
import '/flutter_flow/flutter_flow_theme.dart';
import '/flutter_flow/flutter_flow_util.dart';
import '/custom_code/widgets/index.dart'; // Imports other custom widgets
import '/flutter_flow/custom_functions.dart'; // Imports custom functions
import 'package:flutter/material.dart';
// Begin custom widget code
// DO NOT REMOVE OR MODIFY THE CODE ABOVE!

// ---- Direct imports, rather than leaning on index.dart ----
//
// FlutterFlow's generated `/custom_code/widgets/index.dart` re-exports each
// custom widget with a `show <WidgetName>` clause — so it carries the WIDGET
// across files and nothing else. That is enough for the old screens, which
// only ever referenced each other's widget classes; it is not enough here,
// where every screen needs `KandiColors`, `KandiType`, `KandiCache` and the
// rest, none of which is a widget.
//
// Importing the sibling file directly takes the whole of it. Harmless if
// index.dart turns out to re-export everything, and essential if it does
// not — which is why it is done this way rather than assumed either way.
//
// The paths follow FlutterFlow's own naming: a custom widget called
// `KandiDesign` is written to `lib/custom_code/widgets/kandi_design.dart`.
// Name the widgets exactly as SETUP.md says or these paths will not resolve.
import '/custom_code/widgets/kandi_design.dart';

import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

// ============================================================
//  KANDI — THE CART
//
//  The basket, as shared state rather than a screen's private
//  business.
//
//  WHY IT IS ITS OWN FILE
//  -----------------------------------------------------------
//  Five screens need the cart: the home badge, the product
//  page's Add button, the cart screen, the checkout, and the
//  account screen's "you left something behind". In the app this
//  replaces, the cart lived inside `cart_widget.dart` as a
//  private class, so every other screen either re-read
//  SharedPreferences itself or simply did not know.
//
//  That is how a badge goes stale. The header showed a count it
//  had read on launch, and adding from a product page did not
//  move it — the cart was right, the number beside it was not,
//  and a shopper who cannot trust the badge stops using it.
//
//  ONE STORAGE KEY, AND IT IS THE WEBSITE'S
//  -----------------------------------------------------------
//  `kandi-cart-v2`, unchanged from the screen this replaces.
//  That is deliberate and it matters more than it looks: a
//  redesign that renames the key silently empties the basket of
//  every shopper who updates the app, and they do not report it
//  as a bug — they report it by not coming back.
//
//  The JSON shape is unchanged too, field for field, so a cart
//  written by the old app is read by this one.
// ============================================================

/// One line in the basket.
///
/// Price is stored, not looked up. A cart line is a record of what the shopper
/// was shown at the moment they added it — if the price moves before checkout
/// the server corrects the order and says so, which is the honest sequence.
/// A cart that silently reprices itself is a cart nobody trusts.
class KandiCartLine {
  const KandiCartLine({
    required this.key,
    required this.productId,
    required this.name,
    required this.price,
    required this.image,
    required this.quantity,
    this.slug = '',
    this.variationId,
    this.options = const {},
  });

  /// `12|Colour=Blue|Size=42` — the identity of this line.
  final String key;

  final int productId;
  final String name;
  final double price;
  final String image;
  final String slug;
  final int quantity;

  /// The exact WooCommerce variation, when the product has one.
  ///
  /// Without it an order records the parent product and a note, so it is
  /// priced from the parent and decrements the parent's stock — which is how
  /// a size 38 sells a hundred times while the shop still shows it available.
  final int? variationId;

  final Map<String, String> options;

  double get lineTotal => price * quantity;

  KandiCartLine copyWith({int? quantity}) => KandiCartLine(
        key: key,
        productId: productId,
        name: name,
        price: price,
        image: image,
        slug: slug,
        quantity: quantity ?? this.quantity,
        variationId: variationId,
        options: options,
      );

  Map<String, dynamic> toJson() => {
        'key': key,
        'productId': productId,
        'name': name,
        'price': price,
        'image': image,
        'slug': slug,
        'quantity': quantity,
        if (options.isNotEmpty) 'options': options,
        if (variationId != null && variationId! > 0) 'variationId': variationId,
      };

  /// Read defensively: one malformed line must not cost the shopper the whole
  /// basket, so anything unreadable is dropped rather than thrown.
  static KandiCartLine? fromJson(dynamic raw) {
    if (raw is! Map) return null;

    final id = raw['productId'] is num
        ? (raw['productId'] as num).toInt()
        : int.tryParse('${raw['productId'] ?? raw['product_id'] ?? ''}');
    if (id == null || id <= 0) return null;

    final options = <String, String>{};
    final rawOptions = raw['options'];
    if (rawOptions is Map) {
      rawOptions.forEach((k, v) {
        final value = v?.toString() ?? '';
        if (value.isNotEmpty) options[k.toString()] = value;
      });
    }

    final quantity = raw['quantity'] is num
        ? (raw['quantity'] as num).toInt()
        : int.tryParse('${raw['quantity']}') ?? 1;

    return KandiCartLine(
      key: (raw['key'] ?? KandiCart.lineKey(id, options)).toString(),
      productId: id,
      name: (raw['name'] ?? '').toString(),
      price: raw['price'] is num
          ? (raw['price'] as num).toDouble()
          : double.tryParse('${raw['price']}') ?? 0,
      image: (raw['image'] ?? '').toString(),
      slug: (raw['slug'] ?? '').toString(),
      // Clamped on the way in as well as on the way out. A quantity of zero
      // written by an older build would otherwise sit in the basket as an
      // invisible line the shopper cannot remove.
      quantity: quantity.clamp(1, 20),
      variationId: raw['variationId'] is num
          ? (raw['variationId'] as num).toInt()
          : null,
      options: options,
    );
  }
}

/// The basket, and the one place it is decided.
///
/// Static rather than injected, because in a FlutterFlow project there is no
/// place to put a provider above the widget tree: custom widgets are dropped
/// onto pages the builder owns, and nothing wraps them. A static store with a
/// [ValueNotifier] is the shape that actually works here — any screen can
/// listen without being handed anything.
class KandiCart {
  KandiCart._();

  /// The website's key. Renaming it would empty every existing basket — see
  /// the note at the head of this file.
  static const String storageKey = 'kandi-cart-v2';

  /// How many items are in the basket, for every badge in the app.
  ///
  /// A [ValueNotifier] so a badge can wrap itself in a [ValueListenableBuilder]
  /// and stay correct without anybody remembering to refresh it. That is the
  /// stale-badge bug fixed at the root rather than patched per screen.
  static final ValueNotifier<int> count = ValueNotifier<int>(0);

  /// Bumped on every mutation, so a screen showing the LINES can rebuild too.
  ///
  /// Separate from `count` because they answer different questions: changing a
  /// quantity from 2 to 3 moves the count, but so does adding a line, and a
  /// cart screen needs to redraw for edits that leave the count alone — a
  /// price refresh, say.
  static final ValueNotifier<int> revision = ValueNotifier<int>(0);

  static List<KandiCartLine> _lines = <KandiCartLine>[];
  static bool _loaded = false;

  static List<KandiCartLine> get lines => List.unmodifiable(_lines);

  static double get subtotal =>
      _lines.fold<double>(0, (sum, line) => sum + line.lineTotal);

  static int get itemCount =>
      _lines.fold<int>(0, (sum, line) => sum + line.quantity);

  static bool get isEmpty => _lines.isEmpty;

  /// `12|Colour=Blue|Size=42` — options sorted, so the same pair of choices
  /// always produces the same key whatever order they were picked in.
  ///
  /// Without the sort, picking colour-then-size and size-then-colour make two
  /// different keys for one product, and the basket shows the same shoe twice.
  static String lineKey(int productId, Map<String, String>? options) {
    final parts = (options ?? const <String, String>{}).entries.toList()
      ..sort((a, b) => a.key.compareTo(b.key));
    return '$productId|${parts.map((e) => '${e.key}=${e.value}').join('|')}';
  }

  /// Reads the basket from disk, once.
  ///
  /// Every screen calls this in `initState` and only the first one pays: the
  /// rest get the already-loaded list. `force` is for after a checkout, when
  /// the stored basket has been emptied behind the app's back.
  static Future<List<KandiCartLine>> load({bool force = false}) async {
    if (_loaded && !force) return lines;

    try {
      final prefs = await SharedPreferences.getInstance();
      final raw = prefs.getString(storageKey);
      if (raw != null && raw.isNotEmpty) {
        final decoded = jsonDecode(raw);
        if (decoded is List) {
          _lines = decoded
              .map(KandiCartLine.fromJson)
              .whereType<KandiCartLine>()
              .toList();
        }
      }
    } catch (_) {
      // Unreadable storage is an empty basket, not a crash on launch. The
      // alternative — throwing out of `initState` — takes the whole app down
      // for a shopper whose only problem is one corrupt string.
      _lines = <KandiCartLine>[];
    }

    _loaded = true;
    _publish();
    return lines;
  }

  /// Adds a product straight from a grid tile.
  ///
  /// Answers `false` — and adds nothing — when the product has options, which
  /// is the caller's cue to open the product screen instead. A variable
  /// product added without a variation is how an order arrives with no size on
  /// it, and the tile's own icon already promises the difference: sliders mean
  /// "there is a step", a cart means "this goes straight in".
  ///
  /// Lives here rather than in each screen because home, search and the
  /// wishlist all draw the same tile and all owe it the same answer. It cannot
  /// do the opening itself: `kandi_product_screen.dart` imports this file, so
  /// this file naming that screen would close the ring.
  static Future<bool> quickAdd(KandiProduct product) async {
    if (product.hasOptions) return false;

    await add(
      productId: product.id,
      name: product.name,
      price: product.price.toDouble(),
      image: product.image,
      slug: product.slug,
    );
    return true;
  }

  static Future<void> add({
    required int productId,
    required String name,
    required double price,
    required String image,
    String slug = '',
    int? variationId,
    Map<String, String> options = const {},
    int quantity = 1,
  }) async {
    await load();

    final key = lineKey(productId, options);
    final index = _lines.indexWhere((line) => line.key == key);

    if (index >= 0) {
      // Adding something already in the basket tops up the line rather than
      // creating a second one. Capped at twenty because that is the ceiling
      // the checkout API enforces per line — letting the basket exceed it
      // moves the refusal to the worst possible moment.
      final existing = _lines[index];
      _lines[index] = existing.copyWith(
        quantity: (existing.quantity + quantity).clamp(1, 20),
      );
    } else {
      _lines = [
        ..._lines,
        KandiCartLine(
          key: key,
          productId: productId,
          name: name,
          price: price,
          image: image,
          slug: slug,
          quantity: quantity.clamp(1, 20),
          variationId: variationId,
          options: options,
        ),
      ];
    }

    await _save();
  }

  static Future<void> setQuantity(String key, int quantity) async {
    await load();
    if (quantity <= 0) return remove(key);

    final index = _lines.indexWhere((line) => line.key == key);
    if (index < 0) return;

    _lines[index] = _lines[index].copyWith(quantity: quantity.clamp(1, 20));
    await _save();
  }

  static Future<void> remove(String key) async {
    await load();
    _lines = _lines.where((line) => line.key != key).toList();
    await _save();
  }

  static Future<void> clear() async {
    _lines = <KandiCartLine>[];
    await _save();
  }

  static Future<void> _save() async {
    _publish();
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(
        storageKey,
        jsonEncode(_lines.map((line) => line.toJson()).toList()),
      );
    } catch (_) {
      // The in-memory basket is already correct and the screen has already
      // been told. A failed write costs the shopper their basket on the next
      // launch, which is bad — but throwing here would cost them the tap they
      // just made, which is worse and is visible.
    }
  }

  /// Tells every listener, and drops any cached total that is now wrong.
  static void _publish() {
    count.value = itemCount;
    revision.value = revision.value + 1;
    // The checkout quote is priced against the basket, so a changed basket
    // makes any stored quote stale by definition.
    KandiCache.invalidate('checkout:quote');
  }
}

/// The cart icon with its count on it.
///
/// Wrapped in a [ValueListenableBuilder], so it is right the moment the basket
/// changes anywhere in the app — no refresh call, no screen having to remember.
class KandiCartBadge extends StatelessWidget {
  const KandiCartBadge({
    super.key,
    this.onTap,
    this.icon = Icons.shopping_bag_outlined,
    this.color = KandiColors.ink,
  });

  final VoidCallback? onTap;
  final IconData icon;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return ValueListenableBuilder<int>(
      valueListenable: KandiCart.count,
      builder: (context, count, _) {
        return Stack(
          clipBehavior: Clip.none,
          children: [
            IconButton(
              onPressed: onTap,
              icon: Icon(icon, size: 22, color: color),
            ),
            if (count > 0)
              Positioned(
                right: 4,
                top: 4,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 5),
                  constraints: const BoxConstraints(minWidth: 17),
                  height: 17,
                  decoration: BoxDecoration(
                    color: KandiColors.primary,
                    borderRadius: KandiRadius.pill,
                    // A ring in the bar's own colour, so the badge reads as
                    // sitting on the icon rather than merging into it.
                    border: Border.all(color: KandiColors.surface, width: 1.5),
                  ),
                  alignment: Alignment.center,
                  child: Text(
                    // Past ninety-nine the exact number stops being useful and
                    // starts breaking the circle.
                    count > 99 ? '99+' : '$count',
                    style: KandiType.micro(
                      color: Colors.white,
                      weight: FontWeight.w700,
                    ).copyWith(fontSize: 10),
                  ),
                ),
              ),
          ],
        );
      },
    );
  }
}

/// A visible check that the cart store is wired up.
///
/// FlutterFlow needs every custom-code file to export a widget, and this one is
/// otherwise a store. Rather than an empty box, it shows the live basket — so
/// dropping it on a page answers "is the count right, and is it reading the
/// same storage the old app wrote" without opening a debugger.
class KandiCartStore extends StatefulWidget {
  const KandiCartStore({super.key, this.width, this.height});

  final double? width;
  final double? height;

  @override
  State<KandiCartStore> createState() => _KandiCartStoreState();
}

class _KandiCartStoreState extends State<KandiCartStore> {
  @override
  void initState() {
    super.initState();
    KandiCart.load();
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      width: widget.width,
      height: widget.height,
      color: KandiColors.page,
      padding: const EdgeInsets.all(KandiSpace.lg),
      child: ValueListenableBuilder<int>(
        valueListenable: KandiCart.revision,
        builder: (context, _, __) {
          return KandiCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text('Cart store', style: KandiType.heading()),
                const SizedBox(height: KandiSpace.sm),
                Text('Key: ${KandiCart.storageKey}',
                    style: KandiType.caption()),
                Text('Lines: ${KandiCart.lines.length}',
                    style: KandiType.caption()),
                Text('Items: ${KandiCart.itemCount}',
                    style: KandiType.caption()),
                const SizedBox(height: KandiSpace.sm),
                Text(kandiPrice(KandiCart.subtotal),
                    style: KandiType.price(size: 20)),
              ],
            ),
          );
        },
      ),
    );
  }
}
