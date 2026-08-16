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

import 'dart:async';
import 'dart:convert';
import 'dart:ui' as ui;

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

// ============================================================
//  KANDI — CART  (v3)
//
//  Fourth sibling of home_sections_widget.dart,
//  category_navigation_menu.dart and product_detail_widget.dart.
//  Same brand, same type, same API, same conventions.
//
//  THIS FILE ALSO OWNS THE TWO STORES — `KandiCart` and
//  `KandiWishlist` — that the wishlist widget reads. Paste this
//  widget into FlutterFlow BEFORE the wishlist one, or the
//  wishlist will not compile: it refers to classes declared here.
//  They live in one file because two copies of a basket are two
//  baskets, and the app would then disagree with itself about
//  what is in it.
//
//  WHAT CHANGED FROM v2 (GOLDLINE), AND WHY
//  -----------------------------------------------------------
//  1. THE LINES ARE CHECKED AGAINST THE REAL SHOP. v2 trusted
//     whatever it had written to SharedPreferences weeks ago: a
//     price, a stock flag, a name. A basket is the one screen
//     where a stale price is not a cosmetic problem — the shopper
//     agrees to a total, and the checkout charges a different
//     one.
//
//     Every line is now re-read on open from
//
//         GET {_kApiBaseUrl}/api/app/product/{id}
//
//     the same endpoint the product page uses. A changed price is
//     shown as changed, a sold-out line is blocked from checkout,
//     and a quantity above what is left is pulled down to it.
//     Storage keeps the basket between launches; WooCommerce
//     decides what the basket is worth.
//
//  2. THE DELIVERY FEE IS QUOTED, NOT INVENTED. v2 carried a
//     table of zones — "Kampala Central 5,000", "Regional
//     25,000" — hardcoded in Dart, and a free-shipping threshold
//     of 100,000 written beside it. None of those numbers came
//     from the shop. The real fee is distance-priced from rates
//     kept in wp-admin, and it is what the checkout charges:
//
//         POST {_kApiBaseUrl}/api/delivery/quote
//              { address, subtotal }
//
//     The threshold comes back with it (and with every product),
//     so the "spend X more for free delivery" bar can no longer
//     promise something the checkout will not honour.
//
//  3. NO SUPABASE. v2 read `profiles` for an address and treated
//     login as the thing that gives you a basket. The website's
//     basket is per-device localStorage and needs no account;
//     this one matches, key for key and field for field
//     (`kandi-cart-v2`), so a wrapped webview and the native
//     screens describe the same basket.
//
//  4. BRAND AND TYPE. Inter, white page, orange #ff6a00, red
//     reserved strictly for discounts and destructive actions.
//
//  SETUP  (FlutterFlow)
//  -----------------------------------------------------------
//  • Custom Widget name:  ShoppingCartPage   (must match the class)
//  • Dependencies (Settings ▸ Pubspec):
//        http: ^1.2.0
//        cached_network_image: ^3.3.1
//        google_fonts: ^6.1.0
//        shared_preferences: ^2.2.2
//  • Parameters — ONE, and it is optional:
//        onCheckout    Action   receives total, itemCount, deliveryFee
//
//    Delete every other parameter from this widget's panel. The
//    four bottom-tab Actions have gone along with the tab bar
//    itself: a basket is a step, not a destination, and four ways
//    out of it sitting under the checkout button is a tap the
//    thumb makes by accident.
//
//    If FlutterFlow reports "Field cartitems has an update value
//    that is not properly set in Update App State action for
//    ShoppingCartPage", delete that action. The basket is not App
//    State any more — it is `KandiCart`, on the device, read by
//    every screen. A copy in App State beside it is a second
//    basket, and the two will disagree.
//
//  WHAT IS *NOT* A PARAMETER, AND WHY
//  -----------------------------------------------------------
//  Nothing that carries data to a product or a department. Those
//  destinations are opened by this file, in code:
//
//      Navigator.push(... ProductDetailPage(productId: …))
//      Navigator.push(... CategoryNavigationMenu())
//
//  Both are custom widgets in this same project, so the FlutterFlow
//  header above (`/custom_code/widgets/index.dart`) already puts
//  them in scope. Opening them directly means the id travels as a
//  typed Dart argument rather than through a FlutterFlow parameter
//  that has to be declared, matched by name and kept in step —
//  three places to get one string wrong, and the failure is a blank
//  product page rather than a compile error.
//
//  The bottom-tab destinations stay Actions, because they are real
//  FlutterFlow pages with their own state and their own scaffolds,
//  and they carry no data — a tab is a tab. `onCheckout` stays an
//  Action for the same reason plus one more: the order handoff
//  usually has to touch App State or an API call before it moves,
//  and none of that is expressible from inside a widget.
//
//  NOTE ON THE SUPABASE IMPORT ABOVE: FlutterFlow writes that
//  header itself and rewrites it on every save, so it stays.
//  Nothing in this file uses Supabase.
// ============================================================

// ============================================================
// CONFIG — keep identical to the other widgets
// ============================================================

/// The live storefront origin. No trailing slash.
const String _kApiBaseUrl = 'https://kandiug.com';

String get _base => _kApiBaseUrl.replaceAll(RegExp(r'/+$'), '');

/// At or below this many units a line says how few are left.
/// The same threshold as the website's LOW_STOCK_AT.
const int _kLowStockAt = 5;

// ============================================================
// BRAND — matched to app/globals.css
// ============================================================

const Color _kPrimary = Color(0xFFFF6A00);

/// Darkened orange that clears 4.6:1 with white text on it.
const Color _kPrimaryInk = Color(0xFFB34A00);

/// Discounts, and destructive actions. Never a resting price.
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
  double size = 20,
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

TextStyle _price({double size = 20, Color color = _kInk}) => GoogleFonts.inter(
      fontSize: size,
      fontWeight: FontWeight.w700,
      color: color,
      height: 1.1,
      letterSpacing: size * -0.008,
      fontFeatures: const [ui.FontFeature.tabularFigures()],
    );

// No struck-through style here. The basket states one price per line — what
// this shopper is being charged — and a "was" price beside it is marketing on
// the screen where the shopper has already decided.

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
// MONEY
// ============================================================

/// `UGX 1,234`, matching lib/currency.ts.
///
/// The one place this app formats money itself. Every figure that comes down
/// from the API arrives pre-formatted precisely so the two cannot disagree —
/// but a line total is quantity × price, an arithmetic the server was never
/// asked to do, so it has to be formatted here.
String kandiUgx(double amount) {
  final digits = amount.round().abs().toString();
  final out = StringBuffer(amount < 0 ? '-' : '');
  for (var i = 0; i < digits.length; i++) {
    if (i > 0 && (digits.length - i) % 3 == 0) out.write(',');
    out.write(digits[i]);
  }
  return 'UGX $out';
}

/// Pulls a number back out of a formatted label — "UGX 55,000" → 55000.
///
/// Needed in exactly one place: the product page hands its "add to cart" action
/// a `priceLabel` rather than a number. Rather than widen that widget's
/// signature, the digits are read back here; the line is then re-priced from
/// the API the next time the basket is opened, so a misread cannot survive.
double kandiPriceFromLabel(String label) {
  final digits = label.replaceAll(RegExp(r'[^0-9]'), '');
  return digits.isEmpty ? 0 : (double.tryParse(digits) ?? 0);
}

// ============================================================
// THE BASKET
// ============================================================

/// One line of the basket.
///
/// The field names are the website's, not new ones: `lib/cart.tsx` writes
/// exactly this shape into localStorage under `kandi-cart-v2`. Keeping them
/// identical is what lets a wrapped webview and these native screens read one
/// basket instead of two.
class KandiCartLine {
  /// productId plus the chosen options — the same composite key the site uses,
  /// so "Blue, 42" and "Blue, 44" are two lines and not one line of two.
  final String key;
  final int productId;
  final String slug;
  String name;
  String image;
  double price;
  int quantity;
  final Map<String, String> options;

  KandiCartLine({
    required this.key,
    required this.productId,
    required this.name,
    required this.price,
    this.image = '',
    this.slug = '',
    this.quantity = 1,
    Map<String, String>? options,
  }) : options = options ?? const {};

  double get lineTotal => price * quantity;

  Map<String, dynamic> toJson() => {
        'key': key,
        'productId': productId,
        'name': name,
        'price': price,
        'image': image,
        'slug': slug,
        'quantity': quantity,
        if (options.isNotEmpty) 'options': options,
      };

  /// Read defensively: one malformed line must not cost the shopper the whole
  /// basket, so anything unreadable is dropped by the caller instead of
  /// throwing.
  static KandiCartLine? fromJson(Map<String, dynamic> j) {
    final id = j['productId'] is num
        ? (j['productId'] as num).toInt()
        : int.tryParse('${j['productId'] ?? j['product_id'] ?? ''}');
    if (id == null || id <= 0) return null;

    final rawOptions = j['options'];
    final options = <String, String>{};
    if (rawOptions is Map) {
      rawOptions.forEach((k, v) => options['$k'] = '$v');
    }

    final price = j['price'] is num
        ? (j['price'] as num).toDouble()
        : double.tryParse('${j['price']}') ?? 0;
    final quantity = j['quantity'] is num
        ? (j['quantity'] as num).toInt()
        : int.tryParse('${j['quantity']}') ?? 1;

    return KandiCartLine(
      key: (j['key'] ?? KandiCart.lineKey(id, options)).toString(),
      productId: id,
      name: (j['name'] ?? j['product_name'] ?? 'Product').toString(),
      price: price,
      image: (j['image'] ?? j['product_image'] ?? '').toString(),
      slug: (j['slug'] ?? '').toString(),
      quantity: quantity < 1 ? 1 : quantity,
      options: options,
    );
  }
}

/// The basket, for the whole app.
///
/// Static because there is one basket and every screen has to see the same one.
/// v2 gave the cart page its own SharedPreferences reader and let the header
/// keep a separate count, which is how a badge ends up saying 3 over a basket
/// of 5.
///
/// `count` is a [ValueNotifier] so any screen can wrap its badge in a
/// [ValueListenableBuilder] and stay right without being told to refresh.
class KandiCart {
  KandiCart._();

  /// The website's key, deliberately.
  static const String storageKey = 'kandi-cart-v2';

  static final ValueNotifier<int> count = ValueNotifier<int>(0);

  static List<KandiCartLine> _lines = <KandiCartLine>[];
  static bool _loaded = false;

  static List<KandiCartLine> get lines => List.unmodifiable(_lines);

  static double get subtotal =>
      _lines.fold<double>(0, (sum, line) => sum + line.lineTotal);

  static int get itemCount =>
      _lines.fold<int>(0, (sum, line) => sum + line.quantity);

  /// `12|Colour=Blue|Size=42` — options sorted, so the same pair of choices
  /// always produces the same key whatever order they were picked in.
  static String lineKey(int productId, Map<String, String>? options) {
    final parts = (options ?? const <String, String>{}).entries.toList()
      ..sort((a, b) => a.key.compareTo(b.key));
    return '$productId|${parts.map((e) => '${e.key}=${e.value}').join('|')}';
  }

  static Future<List<KandiCartLine>> load({bool force = false}) async {
    if (_loaded && !force) return lines;
    try {
      final prefs = await SharedPreferences.getInstance();
      final raw = prefs.getString(storageKey);
      if (raw != null && raw.isNotEmpty) {
        final decoded = jsonDecode(raw);
        if (decoded is List) {
          _lines = decoded
              .whereType<Map>()
              .map((e) => KandiCartLine.fromJson(Map<String, dynamic>.from(e)))
              .whereType<KandiCartLine>()
              .toList();
        }
      }
    } catch (e) {
      // A corrupted basket is emptied rather than crashed on. The shopper
      // loses a basket; they would otherwise lose the app.
      debugPrint('KandiCart.load: $e');
      _lines = <KandiCartLine>[];
    }
    _loaded = true;
    count.value = itemCount;
    return lines;
  }

  /// Writes the basket out as it stands.
  ///
  /// Public because a screen holding the same line objects can edit a price or
  /// a name on them — the cart page does exactly that when it re-reads the shop
  /// — and those edits have to reach storage without going back through a
  /// setter for every field.
  static Future<void> persist() async {
    count.value = itemCount;
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(
        storageKey,
        jsonEncode(_lines.map((l) => l.toJson()).toList()),
      );
    } catch (e) {
      debugPrint('KandiCart.persist: $e');
    }
  }

  static Future<void> _persist() => persist();

  /// Adds one product, merging into an existing line when the options match.
  static Future<void> add({
    required int productId,
    required String name,
    required double price,
    String image = '',
    String slug = '',
    Map<String, String>? options,
    int quantity = 1,
  }) async {
    await load();
    final key = lineKey(productId, options);
    final index = _lines.indexWhere((l) => l.key == key);

    if (index >= 0) {
      _lines[index].quantity += quantity;
      // The freshest name, picture and price win: they came from whichever
      // screen the shopper was just looking at.
      if (name.isNotEmpty) _lines[index].name = name;
      if (image.isNotEmpty) _lines[index].image = image;
      if (price > 0) _lines[index].price = price;
    } else {
      _lines.add(KandiCartLine(
        key: key,
        productId: productId,
        name: name,
        price: price,
        image: image,
        slug: slug,
        quantity: quantity < 1 ? 1 : quantity,
        options: options,
      ));
    }
    await _persist();
  }

  static Future<void> setQuantity(String key, int quantity) async {
    await load();
    final index = _lines.indexWhere((l) => l.key == key);
    if (index < 0) return;
    if (quantity < 1) {
      _lines.removeAt(index);
    } else {
      _lines[index].quantity = quantity;
    }
    await _persist();
  }

  static Future<void> remove(String key) async {
    await load();
    _lines.removeWhere((l) => l.key == key);
    await _persist();
  }

  /// Puts a removed line back where it was — what UNDO calls.
  static Future<void> restore(KandiCartLine line, int index) async {
    await load();
    _lines.insert(index.clamp(0, _lines.length), line);
    await _persist();
  }

  static Future<void> clear() async {
    _lines = <KandiCartLine>[];
    await _persist();
  }
}

// ============================================================
// THE WISHLIST
// ============================================================

/// One saved product. The website's `WishlistItem`, field for field.
class KandiWishlistItem {
  final int productId;
  String name;
  String image;
  double price;
  String slug;

  KandiWishlistItem({
    required this.productId,
    required this.name,
    this.image = '',
    this.price = 0,
    this.slug = '',
  });

  Map<String, dynamic> toJson() => {
        'productId': productId,
        'name': name,
        'image': image,
        'price': price,
        'slug': slug,
      };

  static KandiWishlistItem? fromJson(Map<String, dynamic> j) {
    final id = j['productId'] is num
        ? (j['productId'] as num).toInt()
        : int.tryParse('${j['productId'] ?? j['product_id'] ?? ''}');
    if (id == null || id <= 0) return null;
    return KandiWishlistItem(
      productId: id,
      name: (j['name'] ?? j['product_name'] ?? 'Product').toString(),
      image: (j['image'] ?? j['product_image'] ?? '').toString(),
      price: j['price'] is num
          ? (j['price'] as num).toDouble()
          : double.tryParse('${j['price']}') ?? 0,
      slug: (j['slug'] ?? '').toString(),
    );
  }
}

/// Saved items, per device.
///
/// Per device and not per account, because that is what the website does —
/// `lib/wishlist.ts` keeps `kandi-wishlist-v1` in localStorage and asks nobody
/// to log in. v2 of these screens put the wishlist in a Supabase table and put
/// a sign-in wall in front of it, which meant the app refused to save what the
/// site saved freely.
class KandiWishlist {
  KandiWishlist._();

  static const String storageKey = 'kandi-wishlist-v1';

  static final ValueNotifier<int> count = ValueNotifier<int>(0);

  static List<KandiWishlistItem> _items = <KandiWishlistItem>[];
  static bool _loaded = false;

  static List<KandiWishlistItem> get items => List.unmodifiable(_items);

  static Future<List<KandiWishlistItem>> load({bool force = false}) async {
    if (_loaded && !force) return items;
    try {
      final prefs = await SharedPreferences.getInstance();
      final raw = prefs.getString(storageKey);
      if (raw != null && raw.isNotEmpty) {
        final decoded = jsonDecode(raw);
        if (decoded is List) {
          _items = decoded
              .whereType<Map>()
              .map((e) =>
                  KandiWishlistItem.fromJson(Map<String, dynamic>.from(e)))
              .whereType<KandiWishlistItem>()
              .toList();
        }
      }
    } catch (e) {
      debugPrint('KandiWishlist.load: $e');
      _items = <KandiWishlistItem>[];
    }
    _loaded = true;
    count.value = _items.length;
    return items;
  }

  static bool isSaved(int productId) =>
      _items.any((i) => i.productId == productId);

  /// Writes the list out as it stands. Public for the same reason
  /// [KandiCart.persist] is: the saved-items screen holds these very objects
  /// and corrects a renamed product on them directly.
  static Future<void> persist() async {
    count.value = _items.length;
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(
        storageKey,
        jsonEncode(_items.map((i) => i.toJson()).toList()),
      );
    } catch (e) {
      debugPrint('KandiWishlist.persist: $e');
    }
  }

  static Future<void> _persist() => persist();

  /// Newest first, matching the site.
  static Future<void> add(KandiWishlistItem item, {int? at}) async {
    await load();
    if (isSaved(item.productId)) return;
    _items.insert((at ?? 0).clamp(0, _items.length), item);
    await _persist();
  }

  static Future<void> remove(int productId) async {
    await load();
    _items.removeWhere((i) => i.productId == productId);
    await _persist();
  }

  /// Returns true when the product is saved afterwards.
  static Future<bool> toggle(KandiWishlistItem item) async {
    await load();
    if (isSaved(item.productId)) {
      await remove(item.productId);
      return false;
    }
    await add(item);
    return true;
  }
}

// ============================================================
// THE DELIVERY ADDRESS
// ============================================================

/// What the shopper typed, and the quote the shop gave for it.
class KandiDelivery {
  KandiDelivery._();

  static const String storageKey = 'kandi_delivery_address';

  static Future<String?> savedAddress() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final value = prefs.getString(storageKey);
      return (value == null || value.trim().isEmpty) ? null : value.trim();
    } catch (_) {
      return null;
    }
  }

  static Future<void> saveAddress(String address) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(storageKey, address.trim());
    } catch (_) {}
  }
}

/// A priced delivery, straight from `POST /api/delivery/quote`.
///
/// Nothing here is computed in Dart. The rates live in wp-admin, the same
/// function prices the order when it is placed, and a fee this app worked out
/// for itself could only ever be a second opinion the checkout would overrule.
class _Quote {
  final double fee;
  final bool free;
  final bool deliverable;
  final String label;
  final String? place;
  final double freeDeliveryFrom;

  const _Quote({
    required this.fee,
    required this.free,
    required this.deliverable,
    required this.label,
    required this.place,
    required this.freeDeliveryFrom,
  });

  factory _Quote.fromJson(Map<String, dynamic> j) => _Quote(
        fee: (j['fee'] is num) ? (j['fee'] as num).toDouble() : 0,
        free: j['free'] == true,
        deliverable: j['deliverable'] != false,
        label: (j['label'] ?? '').toString(),
        place: j['place']?.toString(),
        freeDeliveryFrom: (j['freeDeliveryFrom'] is num)
            ? (j['freeDeliveryFrom'] as num).toDouble()
            : 0,
      );
}

// ============================================================
// LIVE PRODUCT FACTS
// ============================================================

/// What the shop says about a basket line right now.
class _Live {
  final String name;
  final String image;
  final String slug;
  final double price;
  final String priceLabel;
  final String? wasPriceLabel;
  final bool inStock;
  final int? stockQuantity;
  final double freeDeliveryFrom;

  const _Live({
    required this.name,
    required this.image,
    required this.slug,
    required this.price,
    required this.priceLabel,
    required this.wasPriceLabel,
    required this.inStock,
    required this.stockQuantity,
    required this.freeDeliveryFrom,
  });

  static _Live? fromDetail(Map<String, dynamic> json) {
    final p = json['product'];
    if (p is! Map) return null;
    final product = Map<String, dynamic>.from(p);
    final commerce =
        Map<String, dynamic>.from((json['commerce'] as Map?) ?? const {});

    final images = product['images'];
    final image = (images is List && images.isNotEmpty)
        ? (images.first ?? '').toString()
        : (product['image'] ?? '').toString();

    return _Live(
      name: (product['name'] ?? '').toString(),
      image: image,
      slug: (product['slug'] ?? '').toString(),
      price: (product['price'] is num)
          ? (product['price'] as num).toDouble()
          : kandiPriceFromLabel((product['priceLabel'] ?? '').toString()),
      priceLabel: (product['priceLabel'] ?? '').toString(),
      wasPriceLabel: product['wasPriceLabel']?.toString(),
      inStock: product['inStock'] != false,
      stockQuantity: product['stockQuantity'] == null
          ? null
          : (product['stockQuantity'] is num)
              ? (product['stockQuantity'] as num).toInt()
              : int.tryParse('${product['stockQuantity']}'),
      freeDeliveryFrom: (commerce['freeDeliveryFrom'] is num)
          ? (commerce['freeDeliveryFrom'] as num).toDouble()
          : 0,
    );
  }
}

// ============================================================
// NAVIGATION — in code, not through parameters
// ============================================================

/// Opens the product page.
///
/// A direct push rather than a FlutterFlow Action taking an id. The id is a
/// typed Dart argument here; as a parameter it would have to be declared on the
/// destination page, spelled identically in the action editor and kept in step
/// with this file — and when it drifts the result is a blank product page
/// rather than a compile error.
///
/// The pushed page is handed its own in-code handlers so the rail at its foot
/// keeps working: tapping a related product opens another product page, and its
/// cart icon comes back here rather than opening a second basket.
Future<void> kandiOpenProduct(BuildContext context, String idOrSlug) {
  if (idOrSlug.isEmpty) return Future<void>.value();
  return Navigator.of(context).push(
    MaterialPageRoute<void>(
      builder: (routeContext) => ProductDetailPage(
        productId: idOrSlug,
        onProductTap: (productId, slug) =>
            kandiOpenProduct(routeContext, slug.isNotEmpty ? slug : productId),
        onCartTap: () async => Navigator.of(routeContext).maybePop(),
        // The line lands with the label's digits for a price and no picture.
        // Both are corrected the moment the basket is opened, because every
        // line is re-read from the product endpoint there.
        onAddToCart: (productId, name, priceLabel) => KandiCart.add(
          productId: productId,
          name: name,
          price: kandiPriceFromLabel(priceLabel),
        ),
      ),
    ),
  );
}

/// Opens the department browser. Also in code, and for the same reason.
///
/// `openFiltered` with no filter rather than a constructor call: FlutterFlow
/// turns every public constructor parameter into a panel row that every
/// instance must supply a value for, so passing arguments this way is what
/// keeps that widget's panel down to the bottom tabs.
Future<void> kandiOpenShop(BuildContext context) {
  return CategoryNavigationMenu.openFiltered(context);
}

// ============================================================
// PRESS
// ============================================================

class _Press extends StatefulWidget {
  final Widget child;
  final VoidCallback? onTap;
  const _Press({required this.child, this.onTap});

  static const double _scale = 0.97;

  @override
  State<_Press> createState() => _PressState();
}

class _PressState extends State<_Press> {
  bool _down = false;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      // The press tick, on the way down, for every control on the page —
      // `selectionClick` rather than `lightImpact` because several handlers
      // fire an impact of their own when the action lands, and a crisp tick
      // down plus a softer impact out reads as one gesture where two identical
      // buzzes read as a fault. Nothing is fired for a disabled control: a
      // sold-out "Add to cart" that buzzes has told the finger it worked.
      onTapDown: (_) {
        if (widget.onTap != null) HapticFeedback.selectionClick();
        setState(() => _down = true);
      },
      onTapUp: (_) => setState(() => _down = false),
      onTapCancel: () => setState(() => _down = false),
      onTap: widget.onTap,
      child: AnimatedScale(
        scale: _down ? _Press._scale : 1.0,
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

/// The class name is `ShoppingCartPage`, and it must stay that: FlutterFlow
/// generates the call site from the Custom Widget's NAME, so a rename here
/// without a rename there fails the whole web build rather than one screen.
class ShoppingCartPage extends StatefulWidget {
  const ShoppingCartPage({
    super.key,
    this.width,
    this.height,
    this.onCheckout,
  });

  final double? width;
  final double? height;

  /// ---- No bottom tabs on this screen ----
  ///
  /// The four tab Actions have gone, and so has the bar they drove.
  ///
  /// A basket is not a destination a shopper browses from, it is a step they
  /// are in the middle of. The tabs put four ways out of it directly under the
  /// one control the screen exists to deliver — and the two are about 40px
  /// apart on a phone, so the tap that leaves the basket sits under the thumb
  /// that meant to check out. Every large shop drops its tab bar here for
  /// exactly that reason.
  ///
  /// Nothing is lost: the header's back control returns wherever the shopper
  /// came from, and the empty basket still offers the shop.
  ///
  /// Handing the order over. Receives the total the shopper was shown, the
  /// number of items, and the delivery fee that was quoted — so the checkout
  /// starts from the same figures this screen ended on.
  ///
  /// The one remaining parameter, and it has to be one: the checkout is a
  /// FlutterFlow page this file cannot see. Give me its widget name and its
  /// constructor and this becomes an in-code push like everything else.
  ///
  /// NOTE FOR THE FLUTTERFLOW PROJECT: if an "Update App State ▸ cartitems"
  /// action is still wired behind this, delete it. That is what
  /// "Field cartitems has an update value that is not properly set" is
  /// complaining about, and the basket no longer lives in App State — it is
  /// `KandiCart`, on the device, shared by every screen. An App State copy
  /// beside it is a second basket that will disagree with the first.
  final Future Function(double total, int itemCount, double deliveryFee)?
      onCheckout;

  @override
  State<ShoppingCartPage> createState() => _ShoppingCartPageState();
}

class _ShoppingCartPageState extends State<ShoppingCartPage> {
  static const double _pad = 16.0;
  static const double _radius = 10.0;

  List<KandiCartLine> _lines = <KandiCartLine>[];

  /// Live facts per productId, absent for a line the shop could not be asked
  /// about — a line with no entry is shown from storage and left alone rather
  /// than blocked, because a flaky connection is not a reason to refuse a sale.
  final Map<int, _Live> _live = <int, _Live>{};

  bool _loading = true;
  bool _refreshing = false;

  String? _address;
  _Quote? _quote;
  bool _quoting = false;
  String? _quoteError;
  Timer? _quoteDebounce;

  /// Set when the shop's price for a line no longer matches the stored one, so
  /// the change can be said out loud instead of quietly applied.
  final Set<String> _repriced = <String>{};

  double _freeDeliveryFrom = 0;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _quoteDebounce?.cancel();
    super.dispose();
  }

  // ---------- Data ----------

  Future<void> _load() async {
    if (!mounted) return;
    setState(() => _loading = true);

    final lines = await KandiCart.load(force: true);
    _address = await KandiDelivery.savedAddress();

    if (!mounted) return;
    setState(() {
      _lines = List<KandiCartLine>.from(lines);
      _loading = false;
    });

    await _refreshLines();
    _requestQuote(immediate: true);
  }

  /// Re-reads every line from the shop.
  ///
  /// One request per distinct product, in parallel, each absorbing its own
  /// failure. A basket of eight is eight small cached responses — cheaper than
  /// letting a shopper agree to a price WooCommerce no longer offers.
  Future<void> _refreshLines() async {
    if (_lines.isEmpty) return;
    if (mounted) setState(() => _refreshing = true);

    final ids = _lines.map((l) => l.productId).toSet();

    await Future.wait(ids.map((id) async {
      try {
        final response = await http.get(
          Uri.parse('$_base/api/app/product/$id'),
          headers: const {'Accept': 'application/json'},
        ).timeout(const Duration(seconds: 15));

        if (response.statusCode != 200) return;
        final decoded = jsonDecode(utf8.decode(response.bodyBytes));
        if (decoded is! Map) return;

        final live = _Live.fromDetail(Map<String, dynamic>.from(decoded));
        if (live != null) _live[id] = live;
      } catch (e) {
        debugPrint('Kandi cart refresh $id failed: $e');
      }
    }));

    var changed = false;

    for (final line in _lines) {
      final live = _live[line.productId];
      if (live == null) continue;

      if (live.freeDeliveryFrom > 0) _freeDeliveryFrom = live.freeDeliveryFrom;

      if (live.price > 0 && (live.price - line.price).abs() >= 1) {
        _repriced.add(line.key);
        line.price = live.price;
        changed = true;
      }
      if (live.name.isNotEmpty && live.name != line.name) {
        line.name = live.name;
        changed = true;
      }
      if (live.image.isNotEmpty && live.image != line.image) {
        line.image = live.image;
        changed = true;
      }

      // A quantity above what is left is pulled down rather than carried to a
      // checkout that would refuse it.
      final stock = live.stockQuantity;
      if (live.inStock && stock != null && stock > 0 && line.quantity > stock) {
        line.quantity = stock;
        changed = true;
      }
    }

    // The line objects in `_lines` are the store's own — the list was copied,
    // not the lines — so the corrections above are already in the basket every
    // other screen reads. This is what writes them to the device.
    if (changed) await KandiCart.persist();

    if (!mounted) return;
    setState(() => _refreshing = false);
    if (changed) _requestQuote();
  }

  // ---------- Delivery ----------

  /// Debounced, because the fee depends on the subtotal and a shopper tapping
  /// "+" four times should cost one request rather than four.
  void _requestQuote({bool immediate = false}) {
    _quoteDebounce?.cancel();
    if (!mounted) return;
    if (_address == null || _lines.isEmpty) {
      setState(() => _quote = null);
      return;
    }
    _quoteDebounce = Timer(
      Duration(milliseconds: immediate ? 0 : 600),
      _quoteNow,
    );
  }

  Future<void> _quoteNow() async {
    final address = _address;
    if (address == null || address.isEmpty) return;

    if (mounted) {
      setState(() {
        _quoting = true;
        _quoteError = null;
      });
    }

    try {
      final response = await http
          .post(
            Uri.parse('$_base/api/delivery/quote'),
            headers: const {
              'Accept': 'application/json',
              'Content-Type': 'application/json',
            },
            body: jsonEncode({'address': address, 'subtotal': _subtotal}),
          )
          .timeout(const Duration(seconds: 20));

      final decoded = jsonDecode(utf8.decode(response.bodyBytes));
      if (decoded is! Map) throw const FormatException('Unexpected payload');
      final body = Map<String, dynamic>.from(decoded);

      if (response.statusCode != 200) {
        // 422 is the geocoder saying it does not know that place, and its own
        // sentence is better than anything this file could invent.
        throw FormatException(
          (body['error'] ?? 'Could not price delivery to that address.')
              .toString(),
        );
      }

      final quote = _Quote.fromJson(body);
      if (!mounted) return;
      setState(() {
        _quote = quote;
        if (quote.freeDeliveryFrom > 0) {
          _freeDeliveryFrom = quote.freeDeliveryFrom;
        }
        _quoting = false;
      });
    } catch (e) {
      debugPrint('Kandi delivery quote failed: $e');
      if (!mounted) return;
      setState(() {
        _quoting = false;
        _quote = null;
        _quoteError = e is FormatException
            ? e.message
            : 'Could not price delivery. Check your connection.';
      });
    }
  }

  // ---------- Totals ----------

  double get _subtotal =>
      _lines.fold<double>(0, (sum, line) => sum + line.lineTotal);

  int get _itemCount => _lines.fold<int>(0, (sum, line) => sum + line.quantity);

  /// Null until the shop has priced it. Deliberately not defaulted to a number:
  /// a made-up fee shown as a real one is exactly what v2 did.
  double? get _deliveryFee => _quote?.deliverable == true ? _quote!.fee : null;

  double get _total => _subtotal + (_deliveryFee ?? 0);

  /// Lines the shop says cannot be bought right now.
  List<KandiCartLine> get _unavailable => _lines
      .where((l) => _live[l.productId] != null && !_live[l.productId]!.inStock)
      .toList();

  bool get _canCheckout =>
      _lines.isNotEmpty &&
      _unavailable.isEmpty &&
      _quote != null &&
      _quote!.deliverable;

  // ---------- Mutations ----------

  Future<void> _setQuantity(KandiCartLine line, int quantity) async {
    HapticFeedback.selectionClick();
    setState(() => line.quantity = quantity);
    await KandiCart.setQuantity(line.key, quantity);
    _requestQuote();
  }

  Future<void> _remove(KandiCartLine line) async {
    HapticFeedback.mediumImpact();
    final index = _lines.indexWhere((l) => l.key == line.key);
    if (index < 0) return;

    setState(() => _lines.removeAt(index));
    await KandiCart.remove(line.key);
    _requestQuote();

    if (!mounted) return;
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(
        SnackBar(
          content: Text(
            'Removed from cart',
            style: _text(size: 13.5, color: _kWhite, weight: FontWeight.w600),
          ),
          backgroundColor: _kInk,
          behavior: SnackBarBehavior.floating,
          duration: const Duration(seconds: 4),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(_radius),
          ),
          // Undo rather than a confirm dialog: a dialog taxes every removal to
          // protect against the rare wrong one, and a basket line is trivial to
          // put back.
          action: SnackBarAction(
            label: 'Undo',
            textColor: _kPrimary,
            onPressed: () async {
              await KandiCart.restore(line, index);
              if (!mounted) return;
              setState(() => _lines.insert(
                    index.clamp(0, _lines.length),
                    line,
                  ));
              _requestQuote();
            },
          ),
        ),
      );
  }

  Future<void> _saveForLater(KandiCartLine line) async {
    HapticFeedback.lightImpact();
    await KandiWishlist.add(KandiWishlistItem(
      productId: line.productId,
      name: line.name,
      image: line.image,
      price: line.price,
      slug: line.slug,
    ));
    await _remove(line);
  }

  void _checkout() {
    if (!_canCheckout) return;
    HapticFeedback.mediumImpact();
    widget.onCheckout?.call(_total, _itemCount, _deliveryFee ?? 0);
  }

  // ---------- Address sheet ----------

  Future<void> _editAddress() async {
    HapticFeedback.lightImpact();
    final controller = TextEditingController(text: _address ?? '');

    final typed = await showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (sheetContext) => Padding(
        padding: EdgeInsets.only(
          bottom: MediaQuery.of(sheetContext).viewInsets.bottom,
        ),
        child: Container(
          decoration: const BoxDecoration(
            color: _kWhite,
            borderRadius: BorderRadius.vertical(top: Radius.circular(18)),
          ),
          padding: const EdgeInsets.fromLTRB(_pad, 12, _pad, 18),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Center(
                child: Container(
                  width: 38,
                  height: 4,
                  decoration: BoxDecoration(
                    color: _kLine,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
              const SizedBox(height: 16),
              Text('Where are we delivering?', style: _heading(size: 17)),
              const SizedBox(height: 6),
              Text(
                'A suburb or a nearby landmark is enough — the fee is priced on '
                'the distance from our Kampala store.',
                style: _text(size: 13, color: _kMuted),
              ),
              const SizedBox(height: 14),
              TextField(
                controller: controller,
                autofocus: true,
                textInputAction: TextInputAction.done,
                style: _text(size: 14.5, color: _kInk),
                decoration: InputDecoration(
                  hintText: 'e.g. Ntinda, near Capital Shoppers',
                  hintStyle: _text(size: 14, color: _kFaint),
                  filled: true,
                  fillColor: _kSurface,
                  contentPadding: const EdgeInsets.symmetric(
                      horizontal: 14, vertical: 14),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(_radius),
                    borderSide: const BorderSide(color: _kLine),
                  ),
                  enabledBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(_radius),
                    borderSide: const BorderSide(color: _kLine),
                  ),
                  focusedBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(_radius),
                    borderSide: const BorderSide(color: _kPrimary),
                  ),
                ),
                onSubmitted: (value) =>
                    Navigator.of(sheetContext).pop(value.trim()),
              ),
              const SizedBox(height: 14),
              _Press(
                onTap: () =>
                    Navigator.of(sheetContext).pop(controller.text.trim()),
                child: Container(
                  height: 48,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: _kPrimary,
                    borderRadius: BorderRadius.circular(_radius),
                  ),
                  child: Text(
                    'Price my delivery',
                    style: _text(
                        size: 15, color: _kWhite, weight: FontWeight.w700),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );

    if (typed == null || typed.isEmpty) return;
    await KandiDelivery.saveAddress(typed);
    if (!mounted) return;
    setState(() => _address = typed);
    _requestQuote(immediate: true);
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
                : _lines.isEmpty
                    ? _empty()
                    : _content(),
          ),
          // No tab bar under this. See the note on `onCheckout`: a basket is a
          // step, not a destination, and four ways out of it sitting 40px under
          // the checkout button is a tap the thumb makes by accident.
          if (!_loading && _lines.isNotEmpty) _checkoutBar(),
        ],
      ),
    );
  }

  // ---------- Header ----------

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
                Text('Cart', style: _heading(size: 19)),
                if (_itemCount > 0) ...[
                  const SizedBox(width: 8),
                  Text(
                    '$_itemCount ${_itemCount == 1 ? 'item' : 'items'}',
                    style: _label(size: 12.5),
                  ),
                ],
                const Spacer(),
                if (_refreshing || _quoting)
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

  // ---------- Content ----------

  Widget _content() => RefreshIndicator(
        onRefresh: _load,
        color: _kPrimary,
        backgroundColor: _kWhite,
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(
            parent: BouncingScrollPhysics(),
          ),
          padding: const EdgeInsets.fromLTRB(_pad, 12, _pad, 16),
          children: [
            if (_unavailable.isNotEmpty) ...[
              _unavailableNotice(),
              const SizedBox(height: 10),
            ],
            _deliveryCard(),
            if (_freeDeliveryFrom > 0) ...[
              const SizedBox(height: 8),
              _freeDeliveryBar(),
            ],
            const SizedBox(height: 14),
            for (final line in _lines) _lineTile(line),
            const SizedBox(height: 4),
            _summary(),
          ],
        ),
      );

  /// Said once, at the top, rather than left for the shopper to discover at the
  /// payment step.
  Widget _unavailableNotice() {
    final count = _unavailable.length;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: _kSaleBg,
        borderRadius: BorderRadius.circular(_radius),
        border: Border.all(color: _kSale.withOpacity(0.25)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(Icons.error_outline_rounded, size: 16, color: _kSale),
          const SizedBox(width: 9),
          Expanded(
            child: Text(
              count == 1
                  ? 'One item is out of stock. Remove or save it to carry on.'
                  : '$count items are out of stock. Remove or save them to carry on.',
              style: _text(size: 13, color: _kInk, height: 1.35),
            ),
          ),
        ],
      ),
    );
  }

  // ---------- Delivery ----------

  Widget _deliveryCard() {
    final quote = _quote;
    final hasAddress = _address != null && _address!.isNotEmpty;

    return _Press(
      onTap: _editAddress,
      child: Container(
        padding: const EdgeInsets.all(13),
        decoration: BoxDecoration(
          color: _kSurface,
          borderRadius: BorderRadius.circular(_radius),
          border: Border.all(color: _kLine),
        ),
        child: Row(
          children: [
            Container(
              width: 38,
              height: 38,
              decoration: BoxDecoration(
                color: hasAddress ? _kSuccessBg : _kHairline,
                borderRadius: BorderRadius.circular(9),
              ),
              child: Icon(
                hasAddress
                    ? Icons.location_on_rounded
                    : Icons.location_on_outlined,
                size: 19,
                color: hasAddress ? _kSuccess : _kMuted,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    hasAddress ? 'Deliver to' : 'Add a delivery address',
                    style: _label(size: 11.5),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    hasAddress
                        ? (quote?.place ?? _address!)
                        : 'To see what delivery costs',
                    style: _text(
                        size: 13.5, color: _kInk, weight: FontWeight.w600),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  if (hasAddress) ...[
                    const SizedBox(height: 3),
                    Text(
                      _quoting
                          ? 'Pricing…'
                          : _quoteError ??
                              (quote == null
                                  ? 'Tap to price this delivery'
                                  : !quote.deliverable
                                      ? quote.label
                                      : quote.free
                                          ? '${quote.label} · free delivery'
                                          : '${quote.label} · ${kandiUgx(quote.fee)}'),
                      style: _label(
                        size: 12,
                        color: _quoteError != null ||
                                (quote != null && !quote.deliverable)
                            ? _kSale
                            : quote?.free == true
                                ? _kSuccess
                                : _kBody,
                        weight: FontWeight.w600,
                      ),
                      maxLines: 2,
                    ),
                  ],
                ],
              ),
            ),
            const Icon(Icons.chevron_right_rounded, size: 20, color: _kMuted),
          ],
        ),
      ),
    );
  }

  /// The threshold is the shop's own, and the bar is only drawn when the shop
  /// published one — a "spend more" prompt against an invented number is a
  /// promise the checkout will not keep.
  Widget _freeDeliveryBar() {
    final unlocked = _subtotal >= _freeDeliveryFrom;
    final remaining = _freeDeliveryFrom - _subtotal;
    final progress = (_subtotal / _freeDeliveryFrom).clamp(0.0, 1.0);

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 11),
      decoration: BoxDecoration(
        color: unlocked ? _kSuccessBg : _kHairline,
        borderRadius: BorderRadius.circular(_radius),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(
                unlocked
                    ? Icons.check_circle_rounded
                    : Icons.local_shipping_outlined,
                size: 15,
                color: unlocked ? _kSuccess : _kBody,
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  unlocked
                      ? 'Your order qualifies for free delivery'
                      : 'Add ${kandiUgx(remaining)} more for free delivery',
                  style: _text(
                    size: 12.5,
                    color: unlocked ? _kSuccess : _kBody,
                    weight: FontWeight.w600,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          ClipRRect(
            borderRadius: BorderRadius.circular(3),
            child: Stack(
              children: [
                Container(height: 5, color: _kWhite),
                AnimatedFractionallySizedBox(
                  duration: const Duration(milliseconds: 300),
                  curve: Curves.easeOut,
                  widthFactor: progress,
                  child: Container(
                    height: 5,
                    color: unlocked ? _kSuccess : _kPrimary,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  // ---------- Lines ----------

  Widget _lineTile(KandiCartLine line) {
    final live = _live[line.productId];
    final soldOut = live != null && !live.inStock;
    final stock = live?.stockQuantity;
    final lowStock = !soldOut && stock != null && stock > 0 && stock <= _kLowStockAt;
    final atStockCeiling = stock != null && stock > 0 && line.quantity >= stock;

    return Dismissible(
      key: ValueKey('cart_${line.key}'),
      direction: DismissDirection.endToStart,
      onDismissed: (_) => _remove(line),
      background: Container(
        margin: const EdgeInsets.only(bottom: 10),
        padding: const EdgeInsets.only(right: 18),
        alignment: Alignment.centerRight,
        decoration: BoxDecoration(
          color: _kSaleBg,
          borderRadius: BorderRadius.circular(_radius),
        ),
        child: const Icon(Icons.delete_outline_rounded,
            color: _kSale, size: 21),
      ),
      child: _Press(
        onTap: () => kandiOpenProduct(
          context,
          line.slug.isNotEmpty ? line.slug : line.productId.toString(),
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
              ClipRRect(
                borderRadius: BorderRadius.circular(8),
                child: SizedBox(
                  width: 84,
                  height: 96,
                  child: line.image.isEmpty
                      ? const ColoredBox(
                          color: _kHairline,
                          child: Icon(Icons.image_not_supported_outlined,
                              size: 22, color: _kFaint),
                        )
                      : ColorFiltered(
                          // A sold-out line is drained of colour, so the state
                          // is readable before the label is.
                          colorFilter: soldOut
                              ? const ColorFilter.matrix(<double>[
                                  0.2126, 0.7152, 0.0722, 0, 0, //
                                  0.2126, 0.7152, 0.0722, 0, 0, //
                                  0.2126, 0.7152, 0.0722, 0, 0, //
                                  0, 0, 0, 1, 0,
                                ])
                              : const ColorFilter.mode(
                                  Colors.transparent, BlendMode.dst),
                          child: CachedNetworkImage(
                            imageUrl: line.image,
                            fit: BoxFit.cover,
                            memCacheWidth: 260,
                            fadeInDuration: const Duration(milliseconds: 150),
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
                            line.name,
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
                          onTap: () => _remove(line),
                          child: const Padding(
                            padding: EdgeInsets.only(left: 4, bottom: 4),
                            child: Icon(Icons.close_rounded,
                                size: 17, color: _kMuted),
                          ),
                        ),
                      ],
                    ),
                    if (line.options.isNotEmpty) ...[
                      const SizedBox(height: 3),
                      Text(
                        line.options.entries
                            .map((e) => '${e.key}: ${e.value}')
                            .join(' · '),
                        style: _label(size: 11.5),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                    if (soldOut) ...[
                      const SizedBox(height: 5),
                      _flag('Out of stock', _kSale, Icons.remove_circle_outline_rounded),
                    ] else if (lowStock) ...[
                      const SizedBox(height: 5),
                      _flag('Only $stock left', _kSale,
                          Icons.local_fire_department_rounded),
                    ],
                    if (_repriced.contains(line.key) && !soldOut) ...[
                      const SizedBox(height: 5),
                      _flag('Price updated', _kPrimaryInk,
                          Icons.info_outline_rounded),
                    ],
                    const SizedBox(height: 8),
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                kandiUgx(line.lineTotal),
                                style: _price(
                                  size: 15.5,
                                  color: soldOut ? _kMuted : _kInk,
                                ),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                              if (line.quantity > 1)
                                Text(
                                  '${kandiUgx(line.price)} each',
                                  style: _label(size: 11),
                                ),
                            ],
                          ),
                        ),
                        if (soldOut)
                          _Press(
                            onTap: () => _saveForLater(line),
                            child: Container(
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 10, vertical: 7),
                              decoration: BoxDecoration(
                                color: _kWhite,
                                borderRadius: BorderRadius.circular(8),
                                border: Border.all(color: _kLine),
                              ),
                              child: Text(
                                'Save for later',
                                style: _label(
                                    size: 12,
                                    color: _kInk,
                                    weight: FontWeight.w700),
                              ),
                            ),
                          )
                        else
                          _stepper(line, atStockCeiling),
                      ],
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

  Widget _flag(String text, Color color, IconData icon) => Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 13, color: color),
          const SizedBox(width: 4),
          Text(
            text,
            style: _label(size: 11.5, color: color, weight: FontWeight.w700),
          ),
        ],
      );

  /// The "+" stops at the stock ceiling rather than accepting a number the
  /// checkout will reject.
  Widget _stepper(KandiCartLine line, bool atCeiling) => Container(
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: _kLine),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            _stepButton(
              line.quantity > 1
                  ? Icons.remove_rounded
                  : Icons.delete_outline_rounded,
              line.quantity > 1 ? _kInk : _kSale,
              () => line.quantity > 1
                  ? _setQuantity(line, line.quantity - 1)
                  : _remove(line),
            ),
            SizedBox(
              width: 30,
              height: 30,
              child: Center(
                child: Text('${line.quantity}',
                    style: _price(size: 13.5, color: _kInk)),
              ),
            ),
            _stepButton(
              Icons.add_rounded,
              atCeiling ? _kFaint : _kInk,
              atCeiling ? null : () => _setQuantity(line, line.quantity + 1),
            ),
          ],
        ),
      );

  Widget _stepButton(IconData icon, Color color, VoidCallback? onTap) => _Press(
        onTap: onTap,
        child: SizedBox(
          width: 32,
          height: 30,
          child: Icon(icon, size: 16, color: color),
        ),
      );

  // ---------- Summary ----------

  Widget _summary() => Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: _kSurface,
          borderRadius: BorderRadius.circular(_radius),
        ),
        child: Column(
          children: [
            _summaryRow(
              'Subtotal',
              kandiUgx(_subtotal),
              muted: false,
            ),
            const SizedBox(height: 8),
            _summaryRow(
              'Delivery',
              _quote == null
                  ? (_address == null ? 'Add address' : 'Not priced yet')
                  : !_quote!.deliverable
                      ? 'Unavailable'
                      : _quote!.free
                          ? 'Free'
                          : kandiUgx(_quote!.fee),
              muted: _quote == null || !_quote!.deliverable,
              accent: _quote?.free == true ? _kSuccess : null,
            ),
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 11),
              child: Divider(height: 1, color: _kLine),
            ),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text('Total',
                    style: _text(
                        size: 14, color: _kInk, weight: FontWeight.w700)),
                Text(kandiUgx(_total), style: _price(size: 20)),
              ],
            ),
            if (_deliveryFee == null) ...[
              const SizedBox(height: 6),
              Align(
                alignment: Alignment.centerRight,
                child: Text(
                  'Delivery not included yet',
                  style: _label(size: 11.5),
                ),
              ),
            ],
          ],
        ),
      );

  Widget _summaryRow(String label, String value,
          {bool muted = false, Color? accent}) =>
      Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: _text(size: 13.5, color: _kBody)),
          Text(
            value,
            style: _text(
              size: 13.5,
              color: accent ?? (muted ? _kMuted : _kInk),
              weight: FontWeight.w600,
            ),
          ),
        ],
      );

  // ---------- Checkout bar ----------

  /// Says what the next step is instead of failing silently. A disabled button
  /// with no reason beside it is the single most common way a basket is
  /// abandoned at the last screen.
  Widget _checkoutBar() {
    final blockedByStock = _unavailable.isNotEmpty;
    final needsAddress = _address == null || _address!.isEmpty;
    final undeliverable = _quote != null && !_quote!.deliverable;

    final label = blockedByStock
        ? 'Remove out-of-stock items'
        : needsAddress
            ? 'Add delivery address'
            : undeliverable
                ? 'We cannot deliver there'
                : _quote == null
                    ? (_quoting ? 'Pricing delivery…' : 'Price delivery')
                    : 'Checkout · ${kandiUgx(_total)}';

    final enabled = !blockedByStock && !undeliverable;
    final onTap = blockedByStock
        ? null
        : needsAddress || _quote == null
            ? _editAddress
            : undeliverable
                ? _editAddress
                : _checkout;

    return Container(
      decoration: const BoxDecoration(
        color: _kWhite,
        border: Border(top: BorderSide(color: _kLine)),
      ),
      padding: const EdgeInsets.fromLTRB(_pad, 10, _pad, 10),
      child: _Press(
        onTap: onTap,
        child: Container(
          height: 50,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: enabled ? _kPrimary : _kHairline,
            borderRadius: BorderRadius.circular(_radius),
          ),
          child: Text(
            label,
            style: _text(
              size: 15,
              color: enabled ? _kWhite : _kMuted,
              weight: FontWeight.w700,
            ),
          ),
        ),
      ),
    );
  }

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
                child: const Icon(Icons.shopping_bag_outlined,
                    size: 32, color: _kMuted),
              ),
              const SizedBox(height: 16),
              Text('Your cart is empty', style: _heading(size: 18)),
              const SizedBox(height: 6),
              Text(
                'Everything you add will wait for you here.',
                style: _text(size: 13.5, color: _kMuted),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 18),
              _Press(
                // In code, not an Action: this goes to a screen that lives in
                // this same project and needs nothing from FlutterFlow.
                onTap: () => kandiOpenShop(context),
                child: Container(
                  padding: const EdgeInsets.symmetric(
                      horizontal: 26, vertical: 12),
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

  Widget _skeleton() {
    Widget bar(double w, double h) => Container(
          width: w,
          height: h,
          margin: const EdgeInsets.only(bottom: 8),
          decoration: BoxDecoration(
            color: _kHairline,
            borderRadius: BorderRadius.circular(6),
          ),
        );

    return ListView.builder(
      physics: const NeverScrollableScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(_pad, 12, _pad, 12),
      itemCount: 3,
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
              height: 96,
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
                  bar(double.infinity, 13),
                  bar(140, 13),
                  const SizedBox(height: 12),
                  bar(90, 16),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  // The bottom tab bar that used to live here has been removed along with the
  // four Actions that drove it — see the note on `onCheckout`. `_navItem` and
  // `_run` went with it: nothing else on this screen used either, and a helper
  // kept for a caller that no longer exists is the next person's confusion.
}
