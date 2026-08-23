// Automatic FlutterFlow imports
// ---- Two boilerplate imports are deliberately absent ----
//
// FlutterFlow's generated header normally opens with
//
//     import '/backend/backend.dart';
//     import '/backend/supabase/supabase.dart';
//
// and this project has neither file. There is no Firestore backend and no
// Supabase: the shop's data comes from WordPress over the storefront's own
// API, and the session lives in SharedPreferences (see kandi_auth_page.dart).
// FlutterFlow only emits those lines for projects that HAVE those integrations
// — they arrived here by being pasted from an older project, and they are what
// broke the web build:
//
//     Error: Error when reading 'lib/backend/backend.dart':
//     No such file or directory
//
// dart2js and dart2wasm both refuse the whole build over it, in every custom
// widget at once, which is why it looked like nine broken files rather than
// one bad paste. Do not add them back.
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
// IMAGE DELIVERY
// ============================================================

/// The `Accept` header every photograph in this screen is fetched with.
///
/// ---- Why an app has to say this out loud ----
///
/// The API now hands back image URLs pointing at the storefront's image
/// optimiser (`/_next/image?...`) rather than at the raw WordPress upload, and
/// that endpoint picks its output format from the REQUEST: a client that says
/// it takes WebP gets WebP, and a client that says nothing gets the original
/// format back, resized.
///
/// Dart's HTTP client — which is what `cached_network_image` uses — sends no
/// `Accept` header at all. So without this line the app would collect the
/// resizing and the CDN delivery and silently leave the format conversion on
/// the table, which on this catalogue is about 45% of the bytes. Flutter
/// decodes WebP natively on both Android and iOS, so there is nothing to lose
/// by asking for it.
///
/// `image/*` after it is the fallback for any URL that is not going through
/// the optimiser — a seller avatar on another domain, say — where the server
/// should simply send whatever it has.
const Map<String, String> _kImageHeaders = <String, String>{
  'Accept': 'image/webp,image/*;q=0.8',
};


// ============================================================
//  KANDI — PRODUCT DETAIL  (v3)
//
//  Third sibling of home_sections_widget.dart and
//  category_navigation_menu.dart. Same brand, same type, same
//  API, same conventions. Nothing is shared between the three
//  files because FlutterFlow gives custom widgets no common
//  library to import from — each is a standalone paste.
//
//  WHAT CHANGED FROM v2 (GOLDLINE), AND WHY
//  -----------------------------------------------------------
//  1. IT READS THE SAME SHOP AS EVERYTHING ELSE. v2 queried
//     Supabase directly:
//
//         Supabase.instance.client.from('products')
//           .select().eq('id', widget.productId).single()
//
//     against a `products` table filled by a sync plugin. Every
//     other screen in this app, and the entire website, reads
//     WooCommerce.
//
//     Two databases cannot show one catalogue, and the failure is
//     not subtle: the ids do not refer to the same rows. Tapping a
//     product on the home screen passed a WooCommerce id into a
//     Supabase lookup, which found either nothing — "Failed to
//     load product" — or, worse, a completely different product
//     that happened to share the number.
//
//     This version reads ONE endpoint on the website:
//
//         GET {_kApiBaseUrl}/api/app/product/{slug or id}
//
//     which serves the product through the same `toAppProduct`
//     the home and category screens are already parsing. A price
//     edited in wp-admin reaches this page on its next open.
//
//  2. THE WISHLIST AND CART TABLES ARE GONE. v2 wrote to Supabase
//     `wishlist` rows and a SharedPreferences cart. Both described
//     a shop this app no longer talks to. The wishlist is
//     session-only here, mirroring the website (whose wishlist is
//     per-device localStorage) and the other two screens; the cart
//     is FlutterFlow's job — see `onAddToCart`.
//
//  3. NO INVENTED FACTS. v2 printed "7-Day Returns" and "Free
//     Shipping" over UGX 100,000 as hardcoded badges. Both are now
//     read from the shop's own settings and arrive with the
//     product, so the page cannot promise a window or a threshold
//     the checkout will not honour.
//
//  4. BRAND AND TYPE. v2 used Poppins headings, a red `_goldDeep`
//     and an ivory page. Matched to the storefront: Inter, white
//     page, orange #ff6a00, red reserved strictly for discounts.
//
//  SETUP  (FlutterFlow)
//  -----------------------------------------------------------
//  • Custom Widget name:  ProductDetailPage   (must match the class)
//  • Dependencies (Settings ▸ Pubspec):
//        http: ^1.2.0
//        cached_network_image: ^3.3.1
//        google_fonts: ^6.1.0
//        shared_preferences: ^2.2.2
//  • Paste order does not matter. The basket and the saved list
//    are reached through statics on the other widget classes —
//    `ShoppingCartPage.addToCart(...)`,
//    `WishlistPage.toggleSaved(...)` — because FlutterFlow's
//    index.dart exports each custom widget file with
//    `show <WidgetName>`, so the widget class is the only symbol
//    that crosses a file boundary.
//  • Parameters:
//        productId     String   REQUIRED — the slug or numeric id
//        onBackTap     Action   optional
//        onCartTap     Action   optional
//        onProductTap  Action   optional — receives productId, slug
//        onAddToCart   Action   optional — receives id, name, price
//
//    Only `productId` is needed. The other four now have working
//    in-code behaviour behind them: back pops, the cart icon
//    pushes ShoppingCartPage, the related rail pushes this page
//    again, and "Add to cart" writes to KandiCart whether or not
//    an Action is wired. `onAddToCart` fires ALONGSIDE that write
//    rather than instead of it — v2 made it the only thing the
//    button did, so an unwired project showed "Added to cart"
//    over an empty basket.
//
//  THE BUY BAR: PRICE, ADD TO CART, BUY NOW
//  -----------------------------------------------------------
//  The pinned bar carries the price it is charging — on a page
//  this long the buy box has scrolled away, and a button that
//  commits a shopper to a number they can no longer see is the
//  wrong way round. Beside it, two buttons: "Add to cart" for the
//  shopper still browsing, "Buy now" for the one who has decided.
//
//  "Buy now" is the same basket write plus the navigation that
//  shopper was about to do — deliberately NOT a separate express
//  checkout, because a second path to an order is a second place
//  for the delivery quote and the stock check to be got wrong.
//
//    `productId` is a STRING even though WooCommerce ids are
//    numbers, and that is deliberate: the home and category
//    screens pass a slug when they have one, because a slug is
//    what the website's own URLs use. The endpoint accepts either.
//
//  NAVIGATION IS ACTIONS, NOT PAGE NAMES
//  -----------------------------------------------------------
//  Every tap that leaves this screen is an ACTION parameter you
//  wire in FlutterFlow's action editor, not a page name typed as
//  a String.
//
//  That is a deliberate reversal of the earlier approach and it
//  is the better one for three reasons:
//
//    • FlutterFlow does the navigating, so it knows whether a
//      page takes its parameters as path or query. Passing page
//      names meant this file had to guess — it tried query
//      parameters, caught the throw, then tried path parameters —
//      and a page that took neither shape failed silently.
//    • Page names are typed strings with no validation. Rename a
//      page in FlutterFlow and a String parameter still holds the
//      old name; the tap goes dead and nothing says why. An
//      Action is a real reference and moves with the page.
//    • An Action can do more than navigate. "Add to cart" can
//      update App State, show a custom dialog or call an API
//      before it moves, and none of that is expressible as a
//      route name.
//
//  Every Action is optional. Leave one unwired and that control
//  simply does nothing — visible in testing rather than a crash.
//
//  NOTE ON THE SUPABASE IMPORT ABOVE: FlutterFlow writes that
//  header itself and rewrites it on every save, so it stays.
//  Nothing in this file uses Supabase any more.
//
//  WHAT CHANGED IN v3.1 — THE OPTION PICKERS
//  -----------------------------------------------------------
//  The report was that the size and colour rows "don't look
//  good". They also did not work the way the website's do, and
//  the two problems had one cause: the app was being sent less
//  than the website reads.
//
//  1. COLOURS ARE SHOWN, NOT SPELLED. A colour attribute whose
//     every value has a swatch now renders as the website's
//     discs — `app/products/[id]/ColorSwatch.tsx` — 36px, ringed
//     when chosen, with the chosen name printed once against the
//     label above the row. The swatch comes from the seller's
//     photograph where there is one and from their hex or colour
//     word where there is not; `_kColourWords` is what makes the
//     word case work, because CSS knows the named colours for
//     free and Flutter does not. A row where only SOME values
//     have a swatch stays as chips rather than mixing the two.
//
//  2. COMBINATIONS THAT DO NOT EXIST ARE DEAD. The endpoint now
//     sends `variations`, so `_available` applies the website's
//     own rule: pick Red and the sizes Red was never made in
//     grey out and take a stroke through them, live, as the
//     choice is made. Picking something that invalidates an
//     earlier answer clears that answer rather than leaving a
//     pair that cannot be bought.
//
//  3. EVERY TAP ANSWERS. A live option ticks — haptic AND the
//     system click, so it lands with the ringer off or the phone
//     in a bag — and a dead one buzzes differently and says why.
//     A picker where half the taps do nothing at all is the
//     thing that reads as broken.
//
//  4. THE SIZE ROW CARRIES ITS CHART. EU/UK/US beside the label
//     as on the website, and the size guide table with it.
// ============================================================

// ============================================================
// CONFIG — keep identical to the other two widgets
// ============================================================

/// The live storefront origin. No trailing slash.
const String _kApiBaseUrl = 'https://kandiug.com';

// No page-name constants. Every destination is an Action parameter — see the
// NAVIGATION note in the header.

// ============================================================
// BRAND — matched to app/globals.css
// ============================================================

const Color _kPrimary = Color(0xFFFF6A00);

// `_kPrimarySoft` (#FFF3E8) is not declared here. This page has no selected
// rows or active chips for it to sit behind — the only tinted panels are the
// terms block and the review cards, both of which are neutral grey on purpose
// so the orange stays reserved for the one button that matters.

/// Darkened orange that clears 4.6:1 with white text on it.
const Color _kPrimaryInk = Color(0xFFB34A00);

/// Discounts only. Never a resting price.
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
const Color _kWhite = Colors.white;
const Color _kPage = Colors.white;

/// At or below this many units the page says how few are left.
/// The same threshold as the website's LOW_STOCK_AT.
const int _kLowStockAt = 5;

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

/// The price. 700 with tabular figures, as everywhere else in the shop.
TextStyle _price({double size = 26, Color color = _kInk}) => GoogleFonts.inter(
      fontSize: size,
      fontWeight: FontWeight.w700,
      color: color,
      height: 1.1,
      letterSpacing: size * -0.008,
      fontFeatures: const [ui.FontFeature.tabularFigures()],
    );

TextStyle _struck({double size = 15}) => GoogleFonts.inter(
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
// MODELS — mirror app/api/app/product/[id]/route.ts
// ============================================================

/// Read defensively throughout: a thrown exception in `fromJson` would take the
/// whole page down over one malformed field, and a page with a gap in it is
/// better than a red error box.
int _toInt(dynamic v) {
  if (v is num) return v.toInt();
  if (v is String) return int.tryParse(v) ?? 0;
  return 0;
}

double _toDouble(dynamic v) {
  if (v is num) return v.toDouble();
  if (v is String) return double.tryParse(v) ?? 0;
  return 0;
}

List<String> _toStrings(dynamic raw) {
  if (raw is! List) return const [];
  return raw
      .map((e) => (e ?? '').toString())
      .where((s) => s.isNotEmpty)
      .toList();
}

// ============================================================
// SWATCH COLOURS
// ============================================================

/// The colour words this app can paint.
///
/// ---- Why a table and not a parser ----
///
/// The website fills a swatch with `option.value || option.name.toLowerCase()`
/// and hands it to CSS, which knows every one of the 148 named colours for
/// free. Flutter has no such lookup, so a colour attribute whose terms were
/// typed as words rather than given hexes — which is most shops, because
/// typing "Navy" is what a seller does — had nothing to draw and the app fell
/// back to printing the word.
///
/// This is the subset a clothing and homeware catalogue actually uses, with
/// the wardrobe words shoppers write that CSS has never heard of ("cream",
/// "nude", "wine", "charcoal") mapped to the shade they mean. A word that is
/// not here resolves to null and that option renders as a labelled chip, which
/// is the correct outcome — an unrecognised word drawn as a grey circle is
/// worse than the word itself.
const Map<String, Color> _kColourWords = <String, Color>{
  'black': Color(0xFF000000),
  'white': Color(0xFFFFFFFF),
  'grey': Color(0xFF808080),
  'gray': Color(0xFF808080),
  'charcoal': Color(0xFF36454F),
  'silver': Color(0xFFC0C0C0),
  'red': Color(0xFFFF0000),
  'maroon': Color(0xFF800000),
  'wine': Color(0xFF722F37),
  'burgundy': Color(0xFF800020),
  'pink': Color(0xFFFFC0CB),
  'hotpink': Color(0xFFFF69B4),
  'fuchsia': Color(0xFFFF00FF),
  'magenta': Color(0xFFFF00FF),
  'purple': Color(0xFF800080),
  'violet': Color(0xFFEE82EE),
  'lilac': Color(0xFFC8A2C8),
  'lavender': Color(0xFFE6E6FA),
  'blue': Color(0xFF0000FF),
  'navy': Color(0xFF000080),
  'royalblue': Color(0xFF4169E1),
  'skyblue': Color(0xFF87CEEB),
  'teal': Color(0xFF008080),
  'turquoise': Color(0xFF40E0D0),
  'cyan': Color(0xFF00FFFF),
  'aqua': Color(0xFF00FFFF),
  'green': Color(0xFF008000),
  'olive': Color(0xFF808000),
  'lime': Color(0xFF00FF00),
  'mint': Color(0xFF98FF98),
  'khaki': Color(0xFFF0E68C),
  'yellow': Color(0xFFFFFF00),
  'gold': Color(0xFFFFD700),
  'mustard': Color(0xFFFFDB58),
  'orange': Color(0xFFFFA500),
  'peach': Color(0xFFFFE5B4),
  'coral': Color(0xFFFF7F50),
  'brown': Color(0xFFA52A2A),
  'chocolate': Color(0xFFD2691E),
  'tan': Color(0xFFD2B48C),
  'camel': Color(0xFFC19A6B),
  'beige': Color(0xFFF5F5DC),
  'cream': Color(0xFFFFFDD0),
  'ivory': Color(0xFFFFFFF0),
  'nude': Color(0xFFE3BC9A),
  'bronze': Color(0xFFCD7F32),
  'copper': Color(0xFFB87333),
  'rosegold': Color(0xFFB76E79),
  'denim': Color(0xFF1560BD),
  'indigo': Color(0xFF4B0082),
  'salmon': Color(0xFFFA8072),
  'transparent': Color(0x00000000),
  'multicolor': Color(0xFF9E9E9E),
  'multicolour': Color(0xFF9E9E9E),
};

/// A seller's colour, as something Flutter can paint — or null.
///
/// Takes `#RRGGBB`, `#RGB`, `#AARRGGBB`, the same without the hash, and the
/// words above. Returns null for anything else, INCLUDING a size: "42" is
/// technically valid hex and would come back as a colour if this were only a
/// hex parser, which is why the caller only asks about colour attributes and
/// why two- and four-digit strings are refused here as well.
Color? _parseColour(String? raw) {
  if (raw == null) return null;

  var value = raw.trim().toLowerCase();
  if (value.isEmpty) return null;

  // Spaces and hyphens are how the same shade gets written three ways —
  // "Rose Gold", "rose-gold", "rosegold" — and all three mean the swatch.
  final word = value.replaceAll(RegExp(r'[\s_-]'), '');
  final named = _kColourWords[word];
  if (named != null) return named;

  if (value.startsWith('#')) value = value.substring(1);
  if (!RegExp(r'^[0-9a-f]+$').hasMatch(value)) return null;

  if (value.length == 3) {
    final expanded = value.split('').map((c) => '$c$c').join();
    return Color(0xFF000000 | int.parse(expanded, radix: 16));
  }
  if (value.length == 6) {
    return Color(0xFF000000 | int.parse(value, radix: 16));
  }
  if (value.length == 8) {
    return Color(int.parse(value, radix: 16));
  }
  return null;
}

/// Whether this attribute is the one whose value is a thing to look at rather
/// than a word to read.
///
/// The website tests `attr.name.toLowerCase() === 'color'`. Both spellings and
/// the plurals are accepted here because a Ugandan seller filling in wp-admin
/// is as likely to type "Colour" as "Color", and an attribute that misses this
/// test loses its swatches entirely.
bool _isColourAttribute(String name) {
  final n = name.trim().toLowerCase();
  return n == 'color' || n == 'colour' || n == 'colors' || n == 'colours';
}

/// Whether this attribute gets the EU/UK/US selector beside it — the website's
/// list, unchanged.
bool _isSizeAttribute(String name) {
  final n = name.trim().toLowerCase();
  return n == 'size' || n == 'sizes' || n == 'shoe size';
}

/// The size charts the selector offers. Mirrors `SIZE_SYSTEMS` in
/// `components/AddToCartButton.tsx` — and, as there, it labels which chart the
/// seller's own numbers are being read against rather than converting them.
const List<String> _kSizeSystems = <String>['EU', 'UK', 'US'];

/// A related product, in the same flattened shape the other screens parse.
class _Related {
  final int id;
  final String name;
  final String slug;
  final String image;
  final String priceLabel;
  final String? wasPriceLabel;
  final int discountPercent;

  const _Related({
    required this.id,
    required this.name,
    required this.slug,
    required this.image,
    required this.priceLabel,
    required this.wasPriceLabel,
    required this.discountPercent,
  });

  factory _Related.fromJson(Map<String, dynamic> j) => _Related(
        id: _toInt(j['id']),
        name: (j['name'] ?? '').toString(),
        slug: (j['slug'] ?? '').toString(),
        image: (j['image'] ?? '').toString(),
        priceLabel: (j['priceLabel'] ?? '').toString(),
        wasPriceLabel: j['wasPriceLabel']?.toString(),
        discountPercent: _toInt(j['discountPercent']),
      );
}

/// One value of an attribute — "42", or "Dark Brown" with the swatch that shows
/// what dark brown looks like.
///
/// The image is null for almost everything: a size has no picture and does not
/// want one. It is the whole point for a COLOUR, which is the one attribute
/// whose value is not what the shopper is choosing — they are choosing the
/// thing the word names, and three colour words in a row is a reading exercise
/// where three swatches is a glance.
class _Option {
  final String name;
  final String? image;

  /// The colour the seller set on the term, resolved to something paintable —
  /// `#8B4513` or the word "Navy" — and null for everything that is not a
  /// colour or is a colour this app cannot name.
  ///
  /// Preferred BELOW `image` when both exist, which is the website's order:
  /// a photograph of the fabric says more about "Olive" than a flat olive
  /// circle does, and a seller who bothered to upload one meant it to be seen.
  final Color? swatch;

  const _Option({required this.name, this.image, this.swatch});

  /// Whether this option can be shown as a dot at all, rather than as a word
  /// on a chip.
  bool get hasSwatch => image != null || swatch != null;
}

class _Attribute {
  final String name;
  final List<String> values;

  /// The same values with their swatches. Always the same length and order as
  /// `values` — it is built from it when the endpoint is an older one that
  /// sends names only, so nothing downstream has to check which shape arrived.
  final List<_Option> options;

  const _Attribute({
    required this.name,
    required this.values,
    required this.options,
  });

  /// True when this is Colour, Color, or a plural of either.
  bool get isColour => _isColourAttribute(name);

  /// True when this is the row that gets the EU/UK/US selector.
  bool get isSize => _isSizeAttribute(name);

  /// Whether this row should be drawn as circles rather than chips.
  ///
  /// EVERY option has to be showable as a dot, not just some of them. A row of
  /// six circles and two words is not a colour picker, it is a bug that looks
  /// like one — and it is the exact state a half-filled attribute produces,
  /// where the seller gave hexes to the shades they had photographs of and
  /// left the rest. All or nothing keeps the row readable either way: eight
  /// dots, or eight chips that each carry their own small dot where one is
  /// known.
  bool get showAsSwatches =>
      isColour && options.isNotEmpty && options.every((o) => o.hasSwatch);

  factory _Attribute.fromJson(Map<String, dynamic> j) {
    final values = _toStrings(j['values']);
    final name = (j['name'] ?? '').toString();
    final colourAttribute = _isColourAttribute(name);

    // `options` is the newer field: [{ name, value, image }]. Falling back to
    // `values` rather than requiring it means this widget keeps working
    // against a deployment of the site that predates the swatches, which is a
    // real state — the app and the website ship on different days.
    final raw = j['options'];
    final options = <_Option>[];
    if (raw is List) {
      for (final entry in raw) {
        if (entry is! Map) continue;
        final option = Map<String, dynamic>.from(entry);
        final optionName = (option['name'] ?? '').toString();
        if (optionName.isEmpty) continue;
        final image = (option['image'] ?? '').toString();
        options.add(
          _Option(
            name: optionName,
            image: image.isEmpty ? null : image,
            // The seller's hex first, the option's own word second — which is
            // precisely `option.value || option.name.toLowerCase()`, the
            // fallback the website's `ColorSwatch` has always used. Only ever
            // attempted on a colour attribute, so a size of "42" or a material
            // called "Silver" is never mistaken for a shade.
            swatch: colourAttribute
                ? (_parseColour(option['value']?.toString()) ??
                    _parseColour(optionName))
                : null,
          ),
        );
      }
    }

    return _Attribute(
      name: name,
      values: values,
      options: options.isNotEmpty
          ? options
          : values
              .map((v) => _Option(
                    name: v,
                    swatch: colourAttribute ? _parseColour(v) : null,
                  ))
              .toList(),
    );
  }
}

/// One combination the seller actually built — `{Size: "42", Color: "Black"}`
/// — and whether it is on the shelf.
///
/// ---- What this closes ----
///
/// Until now this screen offered every value of every attribute, because the
/// endpoint sent the attribute lists flattened and nothing about which pairs
/// were real. So a shoe made in black up to 45 and in red only up to 41 let a
/// shopper pick Red and 44, and the first thing that knew better was the order.
/// The website has never had that problem — it reads `product.variations` and
/// crosses the dead options out — and this is the same table, sent to the app
/// for the same purpose.
class _Variation {
  /// Attribute name → the value this combination is. An attribute the
  /// combination does not mention is one it matches ANY value of.
  final Map<String, String> attributes;
  final bool inStock;

  const _Variation({required this.attributes, required this.inStock});

  factory _Variation.fromJson(Map<String, dynamic> j) {
    final chosen = <String, String>{};
    final raw = j['attributes'];
    if (raw is Map) {
      raw.forEach((key, value) {
        final name = (key ?? '').toString();
        final v = (value ?? '').toString();
        if (name.isNotEmpty && v.isNotEmpty) chosen[name] = v;
      });
    }

    // `inStock` is what this endpoint sends; `is_in_stock` is the WooCommerce
    // spelling, accepted so a payload that ever reaches here straight from the
    // shop is read rather than treated as sold out.
    final flag = j.containsKey('inStock') ? j['inStock'] : j['is_in_stock'];

    // Absent means in stock. A missing flag on a combination the seller built
    // should not hide it: the checkout re-checks stock against WooCommerce
    // anyway, so the cost of being wrong this way is a rejected order, and the
    // cost of being wrong the other way is a product nobody can buy at all.
    return _Variation(attributes: chosen, inStock: flag != false);
  }
}

class _Review {
  final String author;
  final int rating;
  final String body;
  final bool verified;

  const _Review({
    required this.author,
    required this.rating,
    required this.body,
    required this.verified,
  });

  factory _Review.fromJson(Map<String, dynamic> j) => _Review(
        author: (j['author'] ?? '').toString(),
        rating: _toInt(j['rating']),
        body: (j['body'] ?? '').toString(),
        verified: j['verified'] == true,
      );
}

/// Everything the page needs, from one request.
class _Detail {
  final int id;
  final String name;
  final String slug;
  final String url;
  final List<String> images;
  final String priceLabel;
  final String? wasPriceLabel;
  final String? savingLabel;
  final int discountPercent;
  final bool inStock;
  final int? stockQuantity;
  final double rating;
  final int ratingCount;
  final int totalSales;
  final String? categoryName;
  final String? sellerName;
  final String description;
  final List<_Attribute> attributes;

  /// Which combinations of those attributes the seller actually built. Empty
  /// for a simple product, and empty is read as "everything is available" —
  /// the same fallback the website takes when `product.variations` is
  /// undefined.
  final List<_Variation> variations;

  final List<_Review> reviews;
  final List<_Related> related;

  /// From the shop's own settings, so the page cannot promise terms the
  /// checkout will not honour.
  final int returnsDays;
  final double freeDeliveryFrom;

  const _Detail({
    required this.id,
    required this.name,
    required this.slug,
    required this.url,
    required this.images,
    required this.priceLabel,
    required this.wasPriceLabel,
    required this.savingLabel,
    required this.discountPercent,
    required this.inStock,
    required this.stockQuantity,
    required this.rating,
    required this.ratingCount,
    required this.totalSales,
    required this.categoryName,
    required this.sellerName,
    required this.description,
    required this.attributes,
    required this.variations,
    required this.reviews,
    required this.related,
    required this.returnsDays,
    required this.freeDeliveryFrom,
  });

  factory _Detail.fromJson(Map<String, dynamic> json) {
    final p = Map<String, dynamic>.from((json['product'] as Map?) ?? const {});
    final r = Map<String, dynamic>.from((json['reviews'] as Map?) ?? const {});
    final c = Map<String, dynamic>.from((json['commerce'] as Map?) ?? const {});

    List<T> list<T>(dynamic raw, T Function(Map<String, dynamic>) make) {
      if (raw is! List) return const [];
      return raw
          .whereType<Map>()
          .map((e) => make(Map<String, dynamic>.from(e)))
          .toList();
    }

    // `images` is the full set from the detail endpoint; `image` is the single
    // tile shot. Falling back to the latter means a product whose gallery
    // failed to serialise still shows its main photograph rather than a blank
    // frame.
    final images = _toStrings(p['images']);

    return _Detail(
      id: _toInt(p['id']),
      name: (p['name'] ?? '').toString(),
      slug: (p['slug'] ?? '').toString(),
      url: (p['url'] ?? '').toString(),
      images: images.isNotEmpty
          ? images
          : _toStrings([p['image']]),
      priceLabel: (p['priceLabel'] ?? '').toString(),
      wasPriceLabel: p['wasPriceLabel']?.toString(),
      savingLabel: p['savingLabel']?.toString(),
      discountPercent: _toInt(p['discountPercent']),
      inStock: p['inStock'] != false,
      stockQuantity:
          p['stockQuantity'] == null ? null : _toInt(p['stockQuantity']),
      rating: _toDouble(p['rating']),
      ratingCount: _toInt(p['ratingCount']),
      totalSales: _toInt(p['totalSales']),
      categoryName: p['categoryName']?.toString(),
      sellerName: (p['seller'] is Map)
          ? (p['seller']['name'] ?? '').toString()
          : p['sellerName']?.toString(),
      // Stripped here as well as on the server: a description pasted straight
      // from a supplier can carry markup the server's own strip missed, and a
      // page printing raw tags reads as broken.
      description: (p['description'] ?? '')
          .toString()
          .replaceAll(RegExp(r'<[^>]*>'), ' ')
          .replaceAll(RegExp(r'&nbsp;'), ' ')
          .replaceAll(RegExp(r'\s+'), ' ')
          .trim(),
      attributes: list(p['attributes'], _Attribute.fromJson),
      variations: list(p['variations'], _Variation.fromJson),
      reviews: list(r['latest'], _Review.fromJson),
      related: list(json['related'], _Related.fromJson),
      returnsDays: _toInt(c['returnsDays']),
      freeDeliveryFrom: _toDouble(c['freeDeliveryFrom']),
    );
  }
}

// ============================================================
// PRESS
// ============================================================

class _Press extends StatefulWidget {
  final Widget child;
  final VoidCallback? onTap;

  /// Suppresses the built-in press tick, for a control that plays its OWN
  /// feedback in the handler.
  ///
  /// The option pickers need this. A variation chip has two outcomes — taken,
  /// or refused because that combination was never made — and they have to
  /// feel different: the tick fires for one and the rejection buzz for the
  /// other. Left to the default, every dead option would tick as though it had
  /// been chosen on the way down and then do nothing, which is the single most
  /// confusing thing a picker can do.
  final bool silent;

  const _Press({required this.child, this.onTap, this.silent = false});

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
      // The press tick, on the way down and only for a live control — the same
      // `selectionClick` the other four screens use, so a press feels identical
      // across the app. Silent for a disabled button: a sold-out "Add to cart"
      // that buzzes has told the finger it worked.
      onTapDown: (_) {
        if (widget.onTap != null && !widget.silent) {
          HapticFeedback.selectionClick();
        }
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

/// The class name is `ProductDetailPage`, and it must stay that.
///
/// FlutterFlow generates the call site from the Custom Widget's NAME —
/// `custom_widgets.ProductDetailPage(...)` — so the class in this file has to
/// match the name in the FlutterFlow panel exactly. Renaming it here without
/// renaming it there produces:
///
///     Error: Method not found: 'ProductDetailPage'.
///
/// which is a compile failure of the whole web build, not a runtime problem, so
/// it takes the entire app down rather than one screen.
class ProductDetailPage extends StatefulWidget {
  const ProductDetailPage({
    super.key,
    this.width,
    this.height,
    required this.productId,
    this.onBackTap,
    this.onCartTap,
    this.onProductTap,
    this.onAddToCart,
  });

  /// Opens a product page.
  ///
  /// ---- Why this is a static on the widget class ----
  ///
  /// It used to be a top-level `kandiOpenProduct(context, id)` in the cart
  /// file, and every other screen called it. That failed the whole web build:
  ///
  ///     Error: The method 'kandiOpenProduct' isn't defined for the type
  ///     '_HomeSectionsWidgetState'.
  ///
  /// FlutterFlow generates custom_code/widgets/index.dart with one line per
  /// widget — `export 'product_detail_page.dart' show ProductDetailPage;` —
  /// and that `show` clause is exhaustive. The widget class is the only symbol
  /// that crosses a file boundary, so anything the other screens need has to
  /// hang off it.
  ///
  /// Takes the slug when there is one, because that is what the website's own
  /// URLs use; the endpoint accepts either.
  static Future<void> open(BuildContext context, String idOrSlug) {
    if (idOrSlug.isEmpty) return Future<void>.value();
    return Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => ProductDetailPage(productId: idOrSlug),
      ),
    );
  }

  final double? width;
  final double? height;

  /// The slug or the numeric id. Both work — see the header note.
  ///
  /// The one parameter that carries data, and it cannot be avoided: this page
  /// is *about* a product, so something has to say which. Every caller in this
  /// project passes it as a typed Dart argument through `kandiOpenProduct`
  /// rather than through a FlutterFlow panel row.
  final String productId;

  /// ---- These four are optional and mostly unnecessary now ----
  ///
  /// The page no longer needs any of them. Back pops the navigator, the cart
  /// icon pushes `ShoppingCartPage`, the related rail pushes another
  /// `ProductDetailPage`, and "Add to cart" writes to `KandiCart` — all in
  /// code, all in this file's control.
  ///
  /// They stay because a project that wired them should not have them break,
  /// and because `onAddToCart` is a genuine hook: an Action there can log an
  /// event or update something in FlutterFlow *in addition to* the basket
  /// write, which now always happens either way.
  ///
  /// What changed is that a null one is no longer a dead control. Every one of
  /// them has a working in-code default behind it.
  final Future Function()? onBackTap;

  /// Opening the cart. Falls back to pushing `ShoppingCartPage`.
  final Future Function()? onCartTap;

  /// Opening another product from the "You may also like" rail. Falls back to
  /// pushing this page again for that product.
  final Future Function(String productId, String slug)? onProductTap;

  /// Fired *in addition to* the basket write, not instead of it.
  ///
  /// v2 made this the only thing "Add to cart" did, which meant an unwired
  /// project had a button that showed a confirmation and stored nothing. The
  /// line now always goes into `KandiCart` — the basket every screen reads —
  /// and this Action runs alongside for projects that want to hang something
  /// else off the tap.
  final Future Function(int productId, String name, String priceLabel)?
      onAddToCart;

  @override
  State<ProductDetailPage> createState() => _ProductDetailPageState();
}

class _ProductDetailPageState extends State<ProductDetailPage> {
  static const double _pad = 16.0;
  static const double _radius = 10.0;

  final ScrollController _scroll = ScrollController();
  final PageController _gallery = PageController();

  _Detail? _detail;
  bool _loading = true;
  String? _error;

  int _imageIndex = 0;

  /// Whether this product is in the shared saved-items list.
  ///
  /// It was a plain bool toggled in place, which meant the heart here and the
  /// saved-items screen were two different opinions about the same product.
  /// Read from `KandiWishlist` on load now, and written through it on tap.
  bool _wishlisted = false;

  /// Badge on the cart icon, from the shared basket.
  int _cartCount = 0;

  bool _descExpanded = false;

  /// True once the gallery has scrolled past, which is when the compact header
  /// takes over from the floating back button.
  bool _stuck = false;

  /// What the shopper has picked, attribute name → value.
  ///
  /// Empty for a product with nothing to choose, which is most of this
  /// catalogue. Shared between the pickers in the page and the bottom sheet on
  /// purpose: they are two views of ONE decision, so a shopper who chose 42 at
  /// the top of the page is not asked again by the sheet at the bottom of it.
  /// That is the whole reason this lives on the state rather than inside
  /// either widget.
  final Map<String, String> _chosen = <String, String>{};

  @override
  void initState() {
    super.initState();
    _scroll.addListener(_onScroll);
    _load();
  }

  @override
  void dispose() {
    _scroll.removeListener(_onScroll);
    _scroll.dispose();
    _gallery.dispose();
    super.dispose();
  }

  void _onScroll() {
    // The gallery is square, so its height is the screen width.
    final threshold = MediaQuery.of(context).size.width - 70;
    final stuck = _scroll.offset > threshold;
    if (stuck != _stuck) setState(() => _stuck = stuck);
  }

  String get _base => _kApiBaseUrl.replaceAll(RegExp(r'/+$'), '');

  Future<void> _load() async {
    if (!mounted) return;
    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final response = await http.get(
        Uri.parse(
          '$_base/api/app/product/${Uri.encodeComponent(widget.productId)}',
        ),
        headers: const {'Accept': 'application/json'},
      ).timeout(const Duration(seconds: 20));

      if (response.statusCode == 404) {
        throw const FormatException('That product is no longer available.');
      }
      if (response.statusCode != 200) {
        throw FormatException('Server returned ${response.statusCode}');
      }

      final decoded = jsonDecode(utf8.decode(response.bodyBytes));
      if (decoded is! Map) throw const FormatException('Unexpected payload');

      final detail = _Detail.fromJson(Map<String, dynamic>.from(decoded));

      // The shared stores, read once the product is known — the heart cannot be
      // resolved before there is an id to look up. Through the other widget
      // classes, which are the only symbols that cross a FlutterFlow file
      // boundary.
      final saved = await WishlistPage.savedIds();
      final count = await ShoppingCartPage.loadCount();

      if (!mounted) return;
      setState(() {
        _detail = detail;
        _wishlisted = saved.contains(detail.id);
        _cartCount = count;
        _loading = false;
        // Cleared on every load, including a pull-to-refresh of the SAME
        // product. Attribute values can change under a listing — a seller
        // sells out of 42 and edits the size list — and a selection kept
        // across a reload can be a value that is no longer offered, which then
        // travels all the way to the order.
        _chosen.clear();
        // The one-value attributes choose themselves. "Material: Cotton" is
        // not a decision, it is a fact about the product, and asking somebody
        // to tap the only option before they can buy is a step that exists
        // purely because the data has a list in it. Pre-selecting means it
        // still reaches the order line and wp-admin without ever being a
        // question. `_pickable` below is what decides which ones remain a
        // question.
        for (final attribute in detail.attributes) {
          if (attribute.values.length == 1) {
            _chosen[attribute.name] = attribute.values.first;
          }
        }
      });
    } catch (e) {
      debugPrint('Kandi product load failed: $e');
      if (!mounted) return;
      setState(() {
        _loading = false;
        // Deliberately not the raw exception: a shopper cannot act on
        // "SocketException: Failed host lookup".
        _error = e is FormatException && e.message.contains('available')
            ? e.message
            : 'Could not reach the shop. Check your connection.';
      });
    }
  }

  /// Runs one of the navigation Actions.
  ///
  /// The whole of this widget's navigation, in four lines. It replaced a
  /// `pushNamed` that had to try query parameters, catch the throw, and then
  /// try path parameters, because a page name gives no way to know which shape
  /// the destination declared. FlutterFlow knows, so FlutterFlow does it.
  ///
  /// A null Action is a control the project chose not to wire, and does
  /// nothing — deliberately silent rather than a crash, and visible the first
  /// time it is tapped in testing.
  void _run(Future Function()? action) {
    if (action == null) return;
    HapticFeedback.lightImpact();
    action();
  }

  /// Opens the basket — the project's Action if it wired one, this app's own
  /// cart screen otherwise.
  void _openCart() {
    HapticFeedback.lightImpact();
    if (widget.onCartTap != null) {
      widget.onCartTap!();
      return;
    }
    Navigator.of(context)
        .push(MaterialPageRoute<void>(builder: (_) => const ShoppingCartPage()))
        .then((_) => _syncStores());
  }

  /// Opens another product from the related rail.
  void _openRelated(_Related r) {
    HapticFeedback.lightImpact();
    final id = r.slug.isNotEmpty ? r.slug : r.id.toString();

    final action = widget.onProductTap;
    if (action != null) {
      action(id, r.slug);
      return;
    }
    ProductDetailPage.open(context, id).then((_) => _syncStores());
  }

  /// Reads the shared basket and saved list, so the header count and the heart
  /// are right on open and right again after coming back from the cart.
  Future<void> _syncStores() async {
    final saved = await WishlistPage.savedIds();
    final count = await ShoppingCartPage.loadCount();
    if (!mounted) return;
    setState(() {
      _wishlisted = saved.contains(_detail?.id ?? 0);
      _cartCount = count;
    });
  }

  /// Puts the line in the basket every screen reads.
  ///
  /// v2 called an Action and stored nothing itself, so an unwired project
  /// showed "Added to cart" over an empty basket. The write happens here now,
  /// and `onAddToCart` runs alongside it rather than instead of it.
  Future<void> _addToCart(
    _Detail d, {
    bool silent = false,
    int quantity = 1,
  }) async {
    HapticFeedback.mediumImpact();

    await ShoppingCartPage.addToCart(
      productId: d.id,
      name: d.name,
      price: ShoppingCartPage.priceFromLabel(d.priceLabel),
      image: d.images.isNotEmpty ? d.images.first : '',
      slug: d.slug,
      quantity: quantity,
      // The size and colour, carried on the line. Without them the basket
      // merges two sizes of one shoe into a single line and the order reaches
      // wp-admin with nothing to pack against — see the note on
      // `ShoppingCartPage.addToCart`, which had been dropping them silently.
      options: _chosen.isEmpty ? null : Map<String, String>.from(_chosen),
    );
    widget.onAddToCart?.call(d.id, d.name, d.priceLabel);

    final count = await ShoppingCartPage.loadCount();
    if (!mounted) return;
    setState(() => _cartCount = count);
    if (silent) return;

    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(
        SnackBar(
          content: Text(
            'Added to cart',
            style: _text(size: 13.5, color: _kWhite, weight: FontWeight.w600),
          ),
          backgroundColor: _kInk,
          behavior: SnackBarBehavior.floating,
          duration: const Duration(seconds: 2),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(_radius),
          ),
          action: SnackBarAction(
            label: 'View cart',
            textColor: _kPrimary,
            onPressed: _openCart,
          ),
        ),
      );
  }

  /// Add, then go straight to the basket.
  ///
  /// "Buy now" is the same write as "Add to cart" plus the navigation the
  /// shopper was going to do next, and it is deliberately NOT a separate
  /// express checkout: a second path to an order is a second place for the
  /// delivery fee and the stock check to be got wrong. The confirmation
  /// snackbar is suppressed because the basket appearing IS the confirmation.
  Future<void> _buyNow(_Detail d, {int quantity = 1}) async {
    await _addToCart(d, silent: true, quantity: quantity);
    if (!mounted) return;
    _openCart();
  }

  // ============================================================
  // CHOICES — SIZE, COLOUR, AND WHATEVER ELSE THE SELLER SET
  // ============================================================

  /// The attributes that are a QUESTION, as opposed to a fact.
  ///
  /// Two or more values. A one-value attribute is a specification, not a
  /// choice — it is answered for the shopper on load (see `_load`) and stays
  /// in the Details table below, where a fact belongs.
  ///
  /// ---- What these used to be ----
  ///
  /// Nothing but a row in that table: "Size — 40, 42, 43, 44" as a comma
  /// string, three quarters of the way down the page, with no way to act on
  /// it. So the app could not tell the shop which size somebody wanted. The
  /// basket line went out with no options, the order arrived in wp-admin
  /// without a size on it, and the difference between the website and the app
  /// was that the website could take the order and this could not.
  ///
  /// ---- On combinations that do not exist ----
  ///
  /// This used to say the endpoint sent `attributes` only, so every option was
  /// offered whether or not the seller had built it. `GET /api/app/product/:id`
  /// now sends `variations` as well, and `_available` below applies the
  /// website's rule to it — see there.
  /// ---- Why this is `isNotEmpty` and not `length > 1` ----
  ///
  /// It was `length > 1`, on the reasoning that a one-value attribute is a
  /// fact rather than a question and belongs in the Details table. The
  /// reasoning is sound and the result was wrong: the shopper's report was that
  /// COLOURS DO NOT DISPLAY, and this is the line that hid them. A shoe made in
  /// one colour has a one-value `Color` attribute, so the colour vanished from
  /// the buy area entirely — and "what colour is this" is a question a shopper
  /// asks about a photograph whether or not there is a second answer available.
  ///
  /// The website has always shown every attribute that has any options at all
  /// (`AddToCartButton`: `if (attr.options.length === 0) return null`), and
  /// this now matches it. A single-value attribute still costs nobody a tap —
  /// it is pre-selected on load in `_load`, so it can never be the thing
  /// `_missing` is waiting for; it is simply visible, which is the whole
  /// difference being asked for.
  List<_Attribute> _pickable(_Detail d) =>
      d.attributes.where((a) => a.values.isNotEmpty).toList();

  /// Whether this value can still be bought, given what is chosen so far.
  ///
  /// The website's rule, line for line (`AddToCartButton.isOptionAvailable`):
  /// a value is offered when SOME variation is in stock, is that value for
  /// this attribute, and agrees with every OTHER attribute the shopper has
  /// already answered. The last clause is what makes the row live rather than
  /// static — pick Red and the sizes Red was never made in go dead in place.
  ///
  /// Two departures from the web version, both deliberate:
  ///
  /// • A product with no variations is a simple product and everything is
  ///   available. Same as the site.
  ///
  /// • A variation that does not mention an attribute matches ANY value of it.
  ///   WooCommerce writes an empty string for "any size", and the server drops
  ///   the key rather than passing an unnamed option through. Treating that
  ///   absence as a mismatch — which is what a plain `==` does, and what the
  ///   website does today — crosses out every size on a product whose
  ///   variations are colour-only. Being generous here can at worst offer a
  ///   combination the checkout then declines; being strict silently makes the
  ///   product unbuyable, which is the more expensive way to be wrong.
  bool _available(_Detail d, String attribute, String option) {
    if (d.variations.isEmpty) return true;

    bool agrees(_Variation variation, String name, String value) {
      final actual = variation.attributes[name];
      return actual == null || actual.isEmpty || actual == value;
    }

    return d.variations.any((variation) {
      if (!variation.inStock) return false;
      if (!agrees(variation, attribute, option)) return false;

      for (final entry in _chosen.entries) {
        if (entry.key == attribute || entry.value.isEmpty) continue;
        if (!agrees(variation, entry.key, entry.value)) return false;
      }
      return true;
    });
  }

  /// Taking a choice, with the tick under the finger.
  ///
  /// ---- The feedback ----
  ///
  /// `selectionClick` is the tick a picker makes — the same one a scroll wheel
  /// makes as a value passes under the line — and it is the right one here for
  /// the reason it exists: choosing a size is moving through a set, not
  /// confirming something. The system click plays with it, so the choice lands
  /// on a phone with haptics turned off and on a phone held in a bag; on iOS
  /// `SystemSoundType.click` is silent by design, which is why the haptic is
  /// not left to carry it alone.
  ///
  /// ---- Why picking can UNPICK something else ----
  ///
  /// Choosing Red when 44 is already selected and Red was never made in 44
  /// leaves a pair that cannot be bought. The website leaves it — the chip
  /// simply goes dead under the shopper while still reading as chosen — and
  /// the order is stopped later. Here the stale answer is dropped and asked
  /// again, because the alternative is a buy button that refuses with
  /// everything apparently answered.
  void _pick(_Detail d, String attribute, String value, {VoidCallback? after}) {
    HapticFeedback.selectionClick();
    SystemSound.play(SystemSoundType.click);

    setState(() {
      _chosen[attribute] = value;

      for (final other in _pickable(d)) {
        if (other.name == attribute) continue;
        final chosen = _chosen[other.name];
        if (chosen == null || chosen.isEmpty) continue;
        if (!_available(d, other.name, chosen)) _chosen.remove(other.name);
      }
    });

    after?.call();
  }

  /// Tapping something that cannot be bought.
  ///
  /// A dead chip that does nothing at all reads as a broken chip. This says
  /// what happened — the buzz is deliberately the rejection pattern rather
  /// than the selection tick, so the finger knows before the eye does — and
  /// names the combination, because "unavailable" on its own leaves the
  /// shopper to work out which of their two choices is the problem.
  void _rejectOption(String attribute, String option) {
    HapticFeedback.heavyImpact();
    SystemSound.play(SystemSoundType.alert);

    final chosenElsewhere = _chosen.entries
        .where((e) => e.key != attribute && e.value.isNotEmpty)
        .map((e) => e.value)
        .join(', ');

    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(
        SnackBar(
          content: Text(
            chosenElsewhere.isEmpty
                ? '$option is sold out'
                : '$option is not available in $chosenElsewhere',
            style: _text(size: 13.5, color: _kWhite, weight: FontWeight.w600),
          ),
          backgroundColor: _kInk,
          behavior: SnackBarBehavior.floating,
          duration: const Duration(seconds: 2),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(_radius),
          ),
        ),
      );
  }

  /// The first choice still outstanding, or null when everything is answered.
  _Attribute? _missing(_Detail d) {
    for (final attribute in _pickable(d)) {
      if ((_chosen[attribute.name] ?? '').isEmpty) return attribute;
    }
    return null;
  }

  /// Add to cart, or bring the choices to the thumb first.
  ///
  /// This is the rule the website's `StickyBuyBar` settled on, and it is worth
  /// restating because the two obvious alternatives are both worse.
  ///
  /// SCROLLING BACK UP to the pickers is safe and rude: the shopper pressed a
  /// buy button and was given a scroll, on the screen where they had already
  /// decided. That is where people leave.
  ///
  /// PICKING A DEFAULT for them is worse than rude. The wrong size is a
  /// return, a refund, a courier leg paid twice and, most of the time, the
  /// customer.
  ///
  /// So a product with nothing outstanding goes straight into the bag, and a
  /// product with a size or a colour still unanswered opens the sheet where
  /// the thumb already is. A shopper who chose at the top of the page is not
  /// asked twice, because both views write to the same `_chosen`.
  void _requestPurchase(_Detail d, {required bool buyNow}) {
    if (!d.inStock) return;

    if (_missing(d) != null) {
      _openChoiceSheet(d, buyNow: buyNow);
      return;
    }

    if (buyNow) {
      _buyNow(d);
    } else {
      _addToCart(d);
    }
  }

  /// Saves or unsaves, in the list the whole app shares.
  Future<void> _toggleWishlist(_Detail d) async {
    HapticFeedback.lightImpact();
    final nowSaved = await WishlistPage.toggleSaved(
      productId: d.id,
      name: d.name,
      image: d.images.isNotEmpty ? d.images.first : '',
      price: ShoppingCartPage.priceFromLabel(d.priceLabel),
      slug: d.slug,
    );
    if (!mounted) return;
    setState(() => _wishlisted = nowSaved);
  }

  /// Five dark stars, filled to the rating — the website's treatment.
  Widget _stars(double rating, {double size = 14}) {
    final filled = rating.round();
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: List.generate(
        5,
        (i) => Icon(
          Icons.star_rounded,
          size: size,
          color: i < filled ? _kInk : _kLine,
        ),
      ),
    );
  }

  String _compactSold(int value) {
    if (value >= 1000000) return '${(value / 1000000).toStringAsFixed(1)}M';
    if (value >= 1000) return '${(value / 1000).toStringAsFixed(1)}K';
    return '$value';
  }

  // ============================================================
  // BUILD
  // ============================================================
  @override
  Widget build(BuildContext context) {
    return _screen(
      child: _loading
          ? _skeleton()
          : _error != null
              ? _errorState()
              : _content(_detail!),
    );
  }

  /// ---- The wrapper that killed the yellow underlines ----
  ///
  /// Every word on this screen was rendering with a double yellow underline
  /// under it, on the phone, in production. It is not a style anybody wrote —
  /// it is Flutter's `_kDefaultTextStyle`, the deliberately hideous fallback
  /// used when a `Text` has NO `Material` ancestor above it. Red text, double
  /// yellow underline, on purpose: it is meant to be impossible to miss.
  ///
  /// The reason only the underline showed and not the red is that every string
  /// here goes through `_text`, `_heading`, `_price` or `_label`, and all four
  /// set an explicit colour. `Text` MERGES its style onto the inherited default
  /// rather than replacing it, so the colour was overridden and the
  /// `decoration` — which none of those helpers mention — was inherited
  /// straight through. Hence text in the right font, the right size and the
  /// right colour, with a debug underline under it.
  ///
  /// This screen returned a bare `Container` at its root. A `Container` is not
  /// a `Material`, and in FlutterFlow a custom widget is dropped into a page
  /// whose own tree does not necessarily put one above it, so there was nothing
  /// between these `Text`s and the framework default.
  ///
  /// Two layers, and both earn their place:
  ///
  ///   • `Material` is the real fix. It establishes the ancestor Flutter was
  ///     looking for, and it is also what lets `showModalBottomSheet`,
  ///     `ScaffoldMessenger` and ink effects behave normally on this screen.
  ///
  ///   • `DefaultTextStyle` with an explicit `decoration: TextDecoration.none`
  ///     is the belt to that pair of braces. `Material` alone hands over
  ///     whatever `Theme.of(context).textTheme.bodyMedium` happens to be, which
  ///     in a FlutterFlow project is whatever the project theme says — fine
  ///     today, and not something this file controls. Stating the base style
  ///     outright means the answer cannot change underneath us.
  ///
  /// The same wrapper is on the cart, wishlist, home and category screens,
  /// which all had the identical bare-`Container` root and the identical
  /// underlines. The checkout, search and address screens already returned a
  /// `Scaffold` — which contains a `Material` — which is exactly why those
  /// three were the ones that always looked right.
  Widget _screen({required Widget child}) {
    return Material(
      color: _kPage,
      child: DefaultTextStyle(
        style: _text(size: 14, color: _kInk).copyWith(
          decoration: TextDecoration.none,
        ),
        child: SizedBox(
          width: widget.width ?? double.infinity,
          height: widget.height ?? double.infinity,
          child: child,
        ),
      ),
    );
  }

  Widget _content(_Detail d) {
    return Stack(
      children: [
        Positioned.fill(
          child: Column(
            children: [
              Expanded(
                child: RefreshIndicator(
                  onRefresh: _load,
                  color: _kPrimary,
                  backgroundColor: _kWhite,
                  child: CustomScrollView(
                    controller: _scroll,
                    physics: const AlwaysScrollableScrollPhysics(
                      parent: BouncingScrollPhysics(),
                    ),
                    slivers: [
                      SliverToBoxAdapter(child: _galleryBlock(d)),
                      // The rest of the photographs, under the main frame.
                      // Renders nothing for a single-image product.
                      SliverToBoxAdapter(child: _thumbnailStrip(d)),
                      SliverToBoxAdapter(child: _buyBlock(d)),
                      // Directly under the price, which is where the website
                      // puts them and where the decision is actually made. A
                      // size list below the description is a size list nobody
                      // reaches before they have already left.
                      if (_pickable(d).isNotEmpty)
                        SliverToBoxAdapter(child: _choicesBlock(d)),
                      SliverToBoxAdapter(child: _termsBlock(d)),
                      if (d.description.isNotEmpty)
                        SliverToBoxAdapter(child: _descriptionBlock(d)),
                      if (_specs(d).isNotEmpty)
                        SliverToBoxAdapter(child: _specsBlock(d)),
                      if (d.ratingCount > 0)
                        SliverToBoxAdapter(child: _reviewsBlock(d)),
                      if (d.related.isNotEmpty)
                        SliverToBoxAdapter(child: _relatedBlock(d)),
                      const SliverToBoxAdapter(child: SizedBox(height: 24)),
                    ],
                  ),
                ),
              ),
              _buyBar(d),
            ],
          ),
        ),

        // The floating controls over the photograph, and the compact header
        // that replaces them once it has scrolled away. Only one is ever on
        // screen, so the back button is never lost.
        if (_stuck) _compactHeader(d) else _floatingControls(),
      ],
    );
  }

  // ---------- Gallery ----------

  Widget _galleryBlock(_Detail d) {
    final width = MediaQuery.of(context).size.width;
    final images = d.images;

    return SizedBox(
      height: width,
      child: Stack(
        children: [
          if (images.isEmpty)
            const ColoredBox(
              color: _kHairline,
              child: Center(
                child: Icon(Icons.image_not_supported_outlined,
                    size: 40, color: _kFaint),
              ),
            )
          else
            PageView.builder(
              controller: _gallery,
              itemCount: images.length,
              onPageChanged: (i) => setState(() => _imageIndex = i),
              itemBuilder: (_, i) => CachedNetworkImage(
                imageUrl: images[i],
                httpHeaders: _kImageHeaders,
                fit: BoxFit.cover,
                // Decoded at roughly the size it is drawn. A 2000px WooCommerce
                // photograph decoded at full resolution is how a mid-range
                // Android runs out of memory.
                memCacheWidth: 1000,
                fadeInDuration: const Duration(milliseconds: 180),
                placeholder: (_, __) => const ColoredBox(color: _kHairline),
                errorWidget: (_, __, ___) => const ColoredBox(
                  color: _kHairline,
                  child: Center(
                    child: Icon(Icons.broken_image_outlined,
                        size: 36, color: _kFaint),
                  ),
                ),
              ),
            ),

          // The discount flag, in sale red and never the brand orange — the
          // same rule the tiles follow.
          if (d.inStock && d.discountPercent > 0)
            Positioned(
              left: 12,
              bottom: 12,
              child: Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
                decoration: BoxDecoration(
                  color: _kSale,
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text(
                  '−${d.discountPercent}%',
                  style: _label(
                      size: 13, color: _kWhite, weight: FontWeight.w700),
                ),
              ),
            ),

          if (images.length > 1)
            Positioned(
              right: 12,
              bottom: 12,
              child: Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
                decoration: BoxDecoration(
                  color: _kInk.withOpacity(0.75),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Text(
                  '${_imageIndex + 1}/${images.length}',
                  style: _label(size: 11.5, color: _kWhite),
                ),
              ),
            ),
        ],
      ),
    );
  }

  /// The rest of the gallery, as a thumbnail strip under the main photograph.
  ///
  /// ---- What was wrong with swipe-only ----
  ///
  /// The gallery was a `PageView` and a "1/6" counter in the corner, which is
  /// the whole of what a shopper was told about the other five photographs.
  /// Two costs, and neither is cosmetic on a page whose job is to sell an
  /// object nobody can pick up:
  ///
  ///   • The counter says a number, not a subject. "1/6" does not tell anyone
  ///     that photograph four is the sole shot of the sole, or that six is the
  ///     size chart — so the swipe is a gamble and most people take it once.
  ///   • Reaching photograph five means four deliberate swipes. Every large
  ///     marketplace puts thumbnails under the frame instead, and the reason
  ///     is arithmetic: one tap to any shot, and every shot ADVERTISED.
  ///
  /// The counter stays. It is still the fastest way to know how many there
  /// are while mid-swipe, and it costs nothing.
  ///
  /// ---- Details ----
  ///
  /// Only rendered for more than one image — a strip holding a single
  /// thumbnail of the picture directly above it is noise.
  ///
  /// 62px square: large enough to make out which shot is which on a phone,
  /// small enough that five fit across a 390px screen without scrolling, which
  /// is the whole catalogue's usual gallery length.
  ///
  /// `animateToPage` rather than `jumpToPage`, so the main frame slides the
  /// way it does under a thumb. A gallery that teleports when tapped and
  /// slides when swiped reads as two different controls.
  ///
  /// The selected thumbnail is ringed in brand orange rather than dimmed,
  /// because dimming the others is a change to five things to say one thing
  /// about the sixth.
  Widget _thumbnailStrip(_Detail d) {
    final images = d.images;
    if (images.length < 2) return const SizedBox.shrink();

    return SizedBox(
      height: 62,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.fromLTRB(_pad, 10, _pad, 0),
        itemCount: images.length,
        separatorBuilder: (_, __) => const SizedBox(width: 8),
        itemBuilder: (_, i) {
          final selected = i == _imageIndex;
          return _Press(
            onTap: () {
              HapticFeedback.selectionClick();
              setState(() => _imageIndex = i);
              _gallery.animateToPage(
                i,
                duration: const Duration(milliseconds: 260),
                curve: Curves.easeOutCubic,
              );
            },
            child: Container(
              width: 52,
              height: 52,
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(8),
                border: Border.all(
                  color: selected ? _kPrimary : _kLine,
                  width: selected ? 1.8 : 1,
                ),
              ),
              child: ClipRRect(
                // One less than the container's 8, so the image sits inside
                // the ring rather than under it.
                borderRadius: BorderRadius.circular(7),
                child: CachedNetworkImage(
                  imageUrl: images[i],
                  httpHeaders: _kImageHeaders,
                  fit: BoxFit.cover,
                  // Drawn at 52px on a 3x screen. Decoding these at full
                  // WooCommerce resolution would put six 2000px bitmaps in
                  // memory to show six postage stamps.
                  memCacheWidth: 160,
                  placeholder: (_, __) => const ColoredBox(color: _kHairline),
                  errorWidget: (_, __, ___) =>
                      const ColoredBox(color: _kHairline),
                ),
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _floatingControls() => SafeArea(
        bottom: false,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          child: Row(
            children: [
              _circle(Icons.arrow_back_ios_new_rounded, _back),
              const Spacer(),
              // Saves to the shared list rather than to a local bool that the
              // saved-items screen knows nothing about.
              _circle(
                _wishlisted
                    ? Icons.favorite_rounded
                    : Icons.favorite_border_rounded,
                () {
                  final d = _detail;
                  if (d != null) _toggleWishlist(d);
                },
                tint: _wishlisted ? _kSale : _kInk,
              ),
              const SizedBox(width: 8),
              _circle(
                Icons.shopping_bag_outlined,
                _openCart,
                badge: _cartCount,
              ),
            ],
          ),
        ),
      );

  Widget _compactHeader(_Detail d) => Container(
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
                _circle(Icons.arrow_back_ios_new_rounded, _back),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    d.name,
                    style: _text(
                        size: 14, color: _kInk, weight: FontWeight.w600),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
                const SizedBox(width: 8),
                _circle(
                  Icons.shopping_bag_outlined,
                  _openCart,
                  badge: _cartCount,
                ),
              ],
            ),
          ),
        ),
      );

  Widget _circle(
    IconData icon,
    VoidCallback onTap, {
    Color tint = _kInk,
    int badge = 0,
  }) =>
      _Press(
        onTap: onTap,
        child: Stack(
          clipBehavior: Clip.none,
          children: [
            Container(
              width: 38,
              height: 38,
              decoration: BoxDecoration(
                color: _kWhite.withOpacity(0.94),
                shape: BoxShape.circle,
                border: Border.all(color: _kLine),
              ),
              child: Icon(icon, size: 18, color: tint),
            ),
            // The live basket count, so adding a line here is visible without
            // leaving the page — the same badge the home and shop screens draw,
            // off the same store.
            if (badge > 0)
              Positioned(
                right: -3,
                top: -3,
                child: Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
                  constraints:
                      const BoxConstraints(minWidth: 17, minHeight: 17),
                  decoration: BoxDecoration(
                    color: _kPrimary,
                    borderRadius: BorderRadius.circular(9),
                    border: Border.all(color: _kPage, width: 1.5),
                  ),
                  child: Text(
                    badge > 99 ? '99+' : '$badge',
                    textAlign: TextAlign.center,
                    style: _label(
                      size: 9.5,
                      color: _kWhite,
                      weight: FontWeight.w800,
                    ),
                  ),
                ),
              ),
          ],
        ),
      );

  /// Leaving the screen.
  ///
  /// Falls back to popping the navigator when no Action is wired, which is the
  /// right default and the one case where a null Action must NOT be a no-op —
  /// a back button that does nothing traps the shopper on the page.
  void _back() {
    HapticFeedback.lightImpact();

    final action = widget.onBackTap;
    if (action != null) {
      action();
      return;
    }

    Navigator.of(context).maybePop();
  }

  // ---------- Choices ----------

  /// The size chart the numbers beside it are being read against.
  ///
  /// The website puts this select beside the Size label
  /// (`components/AddToCartButton.tsx`), and it is here for the same reason:
  /// a Ugandan shopper buying imported stock is looking at a number that could
  /// be any of three systems, and the shop knowing which one it means is the
  /// difference between one delivery and two. Like the website, it labels the
  /// chart rather than converting between them — the sizes on the chips are
  /// the seller's own, and silently rewriting them would be inventing stock
  /// that was never listed.
  String _sizeSystem = _kSizeSystems.first;

  /// A colour, shown as the thing itself.
  ///
  /// This is `app/products/[id]/ColorSwatch.tsx`: a 36px disc, a ring drawn
  /// OUTSIDE it when chosen so the colour keeps its whole area and the dot
  /// never changes size, and a cross through it when that colour cannot be had
  /// in what else is chosen.
  ///
  /// ---- Why the dot and not a chip with a word ----
  ///
  /// The complaint that started this was that the variations "don't look
  /// good", and a column of grey word-buttons is exactly what a colour list
  /// should not be: "Dark Brown" beside "Tan" beside "Oxblood" is three words
  /// to read and compare where three discs is a glance. The name is not
  /// discarded — it is printed once, live, next to the attribute label above
  /// the row ("Colour: Tan"), which is where the website puts it too, and it
  /// is the semantic label on this control so a screen reader still announces
  /// the word.
  ///
  /// The outer box is 44px so the touch target clears the minimum even though
  /// the visible disc is 36.
  Widget _swatchDot({
    required _Option option,
    required bool selected,
    required bool available,
    required VoidCallback onTap,
  }) {
    return Semantics(
      button: true,
      selected: selected,
      enabled: available,
      label: available ? option.name : '${option.name}, unavailable',
      child: _Press(
        onTap: onTap,
        // The tick is suppressed on the disc itself and played by the handler
        // instead, because a dead option has to buzz DIFFERENTLY rather than
        // not at all — see `_rejectOption`.
        silent: true,
        child: Container(
          width: 44,
          height: 44,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            border: Border.all(
              color: selected ? _kInk : Colors.transparent,
              width: 2,
            ),
          ),
          padding: const EdgeInsets.all(3),
          child: Opacity(
            opacity: available ? 1 : 0.4,
            child: Stack(
              alignment: Alignment.center,
              children: [
                ClipOval(
                  child: SizedBox(
                    width: 36,
                    height: 36,
                    child: option.image != null
                        ? CachedNetworkImage(
                            imageUrl: option.image!,
                            httpHeaders: _kImageHeaders,
                            fit: BoxFit.cover,
                            // 36px on a 3x screen. Decoding a supplier's
                            // 2000px swatch at full size to draw a thumbnail
                            // is how a colour list with twelve options runs a
                            // phone out of memory.
                            memCacheWidth: 128,
                            placeholder: (_, __) =>
                                ColoredBox(color: option.swatch ?? _kHairline),
                            errorWidget: (_, __, ___) =>
                                ColoredBox(color: option.swatch ?? _kHairline),
                          )
                        : ColoredBox(color: option.swatch ?? _kHairline),
                  ),
                ),
                // The hairline. Without it a white swatch on a white page is
                // an invisible option, which is the one colour every clothing
                // catalogue has.
                Container(
                  width: 36,
                  height: 36,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    border: Border.all(color: const Color(0x1A000000)),
                  ),
                ),
                // Crossed out, the website's two strokes. Drawn in white with
                // a dark companion beneath so the cross is visible on a black
                // swatch and on a cream one alike.
                if (!available) ...[
                  _strike(width: 36, angle: 0.785, color: const Color(0x99FFFFFF)),
                  _strike(width: 36, angle: -0.785, color: const Color(0x99FFFFFF)),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }

  /// The single stroke through an option that cannot be bought.
  Widget _strike({
    required double width,
    required double angle,
    required Color color,
  }) =>
      Transform.rotate(
        angle: angle,
        child: Container(width: width, height: 1.4, color: color),
      );

  /// One option chip.
  ///
  /// Not a `ChoiceChip`: Material's chip carries its own theme, its own
  /// density and its own selected colour, none of which are this shop's, and
  /// styling one back to the palette is more code than drawing it. This is the
  /// same treatment as the website's option buttons — a hairline at rest, the
  /// brand orange with a tinted ground when chosen, a grey ground and a stroke
  /// through it when the combination does not exist — so the two screens
  /// agree.
  ///
  /// 44px tall rather than the 40 this was: it is the platform minimum for a
  /// touch target, it matches the swatch discs beside it on a product that has
  /// both, and a size chip is two characters wide so nothing else is holding
  /// the height up. `minWidth` 52 is the website's figure, and it is what stops
  /// "S" and "XXL" rendering as two very different buttons.
  Widget _optionChip({
    required String label,
    required bool selected,
    required bool available,
    required VoidCallback onTap,
    String? swatchImage,
    Color? swatchColour,
  }) {
    final hasSwatch = swatchImage != null || swatchColour != null;

    final Color border = !available
        ? _kHairline
        : selected
            ? _kPrimary
            : _kLine;
    final Color ground = !available
        ? _kSurface
        : selected
            ? _kPrimary.withOpacity(0.07)
            : _kWhite;
    final Color ink = !available
        ? _kFaint
        : selected
            ? _kPrimaryInk
            : _kBody;

    return Semantics(
      button: true,
      selected: selected,
      enabled: available,
      label: available ? label : '$label, unavailable',
      child: _Press(
        onTap: onTap,
        silent: true,
        child: Container(
          height: 44,
          constraints: const BoxConstraints(minWidth: 52),
          // Tighter on the left when a swatch leads, so the chip does not grow
          // a gap the size of the dot it just gained.
          padding: EdgeInsets.only(left: hasSwatch ? 8 : 14, right: 14),
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: ground,
            borderRadius: BorderRadius.circular(_radius),
            border: Border.all(
              color: border,
              width: selected && available ? 1.5 : 1,
            ),
          ),
          child: Stack(
            alignment: Alignment.center,
            children: [
              Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  // ---- The colour, shown as well as named ----
                  //
                  // This is the fallback row: a colour attribute where only
                  // SOME terms carry a swatch renders as chips rather than
                  // discs, and the ones that do have a colour still show it.
                  if (hasSwatch) ...[
                    Opacity(
                      opacity: available ? 1 : 0.4,
                      child: Container(
                        width: 22,
                        height: 22,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: swatchColour ?? _kHairline,
                          border: Border.all(color: const Color(0x1A000000)),
                          image: swatchImage == null
                              ? null
                              : DecorationImage(
                                  image: CachedNetworkImageProvider(
                                    swatchImage,
                                    headers: _kImageHeaders,
                                  ),
                                  fit: BoxFit.cover,
                                ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                  ],
                  Text(
                    label,
                    style: _text(
                      size: 14,
                      color: ink,
                      weight: selected && available
                          ? FontWeight.w700
                          : FontWeight.w500,
                    ),
                  ),
                ],
              ),
              // The website's single stroke at -18°, in its own grey.
              if (!available)
                Positioned.fill(
                  child: Center(
                    child: LayoutBuilder(
                      builder: (_, constraints) => _strike(
                        width: constraints.maxWidth * 0.82,
                        angle: -0.314,
                        color: const Color(0xFFCFCFCF),
                      ),
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }

  /// The EU / UK / US selector that sits beside the Size label.
  Widget _sizeSystemPicker() {
    return _Press(
      onTap: () async {
        final picked = await showModalBottomSheet<String>(
          context: context,
          backgroundColor: _kWhite,
          shape: const RoundedRectangleBorder(
            borderRadius: BorderRadius.vertical(top: Radius.circular(18)),
          ),
          builder: (sheetContext) => SafeArea(
            top: false,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Padding(
                  padding: const EdgeInsets.fromLTRB(_pad, 16, _pad, 8),
                  child: Row(
                    children: [
                      Text('Size chart', style: _heading(size: 16)),
                      const Spacer(),
                      Text(
                        'Sizes shown are the seller’s own',
                        style: _label(size: 11.5, color: _kFaint),
                      ),
                    ],
                  ),
                ),
                for (final system in _kSizeSystems)
                  _Press(
                    onTap: () => Navigator.of(sheetContext).pop(system),
                    child: Container(
                      width: double.infinity,
                      padding:
                          const EdgeInsets.symmetric(horizontal: _pad, vertical: 14),
                      child: Row(
                        children: [
                          Text(
                            system,
                            style: _text(
                              size: 15,
                              color: system == _sizeSystem ? _kPrimaryInk : _kBody,
                              weight: system == _sizeSystem
                                  ? FontWeight.w700
                                  : FontWeight.w500,
                            ),
                          ),
                          const Spacer(),
                          if (system == _sizeSystem)
                            const Icon(Icons.check_rounded,
                                size: 18, color: _kPrimary),
                        ],
                      ),
                    ),
                  ),
                // ---- The size guide ----
                //
                // The same table the website puts behind its "Size guide"
                // link, and the same advice with it. It is here rather than
                // behind a second link because the question it answers — "am I
                // an M or an L" — is asked at the moment the size row is being
                // looked at, and this sheet is already open at that moment.
                //
                // Generic body measurements, stated as such. It is not the
                // seller's own chart, and the line above the table says the
                // numbers on the chips are theirs, so nothing here claims to
                // be a measurement of the item in the photograph.
                const Divider(height: 1, color: _kHairline),
                Padding(
                  padding: const EdgeInsets.fromLTRB(_pad, 14, _pad, 4),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Size guide', style: _heading(size: 14)),
                      const SizedBox(height: 6),
                      Text(
                        'Sizes follow the brand’s own chart, so they differ a '
                        'little between labels. Between two sizes, take the '
                        'larger one.',
                        style: _text(size: 12.5, color: _kMuted, height: 1.4),
                      ),
                      const SizedBox(height: 12),
                      for (final row in const [
                        ['Size', 'Chest (cm)', 'Waist (cm)'],
                        ['XS', '82–86', '66–70'],
                        ['S', '86–92', '70–76'],
                        ['M', '92–98', '76–82'],
                        ['L', '98–104', '82–88'],
                        ['XL', '104–112', '88–96'],
                      ])
                        Container(
                          padding: const EdgeInsets.symmetric(vertical: 8),
                          decoration: const BoxDecoration(
                            border: Border(
                              bottom: BorderSide(color: _kHairline),
                            ),
                          ),
                          child: Row(
                            children: [
                              for (var i = 0; i < row.length; i++)
                                Expanded(
                                  flex: i == 0 ? 2 : 3,
                                  child: Text(
                                    row[i],
                                    style: _text(
                                      size: 12.5,
                                      // The header row is the one whose first
                                      // cell is the word rather than a size.
                                      color: row[0] == 'Size' ? _kMuted : _kBody,
                                      weight: i == 0
                                          ? FontWeight.w700
                                          : FontWeight.w500,
                                    ),
                                  ),
                                ),
                            ],
                          ),
                        ),
                    ],
                  ),
                ),
                const SizedBox(height: 12),
              ],
            ),
          ),
        );

        if (picked != null && mounted) {
          HapticFeedback.selectionClick();
          SystemSound.play(SystemSoundType.click);
          setState(() => _sizeSystem = picked);
        }
      },
      child: Container(
        height: 32,
        padding: const EdgeInsets.symmetric(horizontal: 10),
        alignment: Alignment.center,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: _kLine),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(_sizeSystem, style: _text(size: 13, color: _kBody)),
            const SizedBox(width: 4),
            const Icon(Icons.expand_more_rounded, size: 16, color: _kMuted),
          ],
        ),
      ),
    );
  }

  /// Every outstanding choice, as labelled rows of swatches and chips.
  ///
  /// `onPick` rather than writing straight to `_chosen` because the bottom
  /// sheet renders this same widget inside a `StatefulBuilder` and has to
  /// rebuild ITSELF as well as this screen — a sheet whose chips do not
  /// respond until it is closed and reopened reads as broken.
  ///
  /// ---- The label line ----
  ///
  /// "Colour: Tan", the website's exact treatment: the attribute name set
  /// quietly and the CHOSEN VALUE beside it in the ink weight, because the
  /// value is the answer and the name is only the question. Before a choice is
  /// made it reads "Select a colour", which is a prompt rather than a label —
  /// on a colour list of eight running to two lines, a bare "Colour" at the top
  /// leaves a shopper hunting the rows for a highlight to work out what they
  /// picked.
  Widget _choiceRows(
    _Detail d, {
    required void Function(String attribute, String value) onPick,
    bool showError = false,
  }) {
    final pickable = _pickable(d);
    if (pickable.isEmpty) return const SizedBox.shrink();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        for (final attribute in pickable) ...[
          Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              Expanded(
                child: Text.rich(
                  TextSpan(
                    style: _text(size: 14, color: _kMuted),
                    children: [
                      TextSpan(text: '${attribute.name}: '),
                      TextSpan(
                        text: (_chosen[attribute.name] ?? '').isNotEmpty
                            ? _chosen[attribute.name]
                            : 'Select a ${attribute.name.toLowerCase()}',
                        style: _text(
                          size: 14,
                          color: (_chosen[attribute.name] ?? '').isNotEmpty
                              ? _kInk
                              : _kFaint,
                          weight: FontWeight.w700,
                        ),
                      ),
                    ],
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              if (showError && (_chosen[attribute.name] ?? '').isEmpty) ...[
                const SizedBox(width: 8),
                Text(
                  'Choose one',
                  style: _label(
                    size: 12,
                    color: _kSale,
                    weight: FontWeight.w700,
                  ),
                ),
              ],
              if (attribute.isSize) ...[
                const SizedBox(width: 8),
                _sizeSystemPicker(),
              ],
            ],
          ),
          const SizedBox(height: 10),
          // ---- A Wrap, and it has to stay one ----
          //
          // Sizes are two characters wide and there are usually four to eight
          // of them: they belong side by side, flowing onto a second line when
          // they run out of room, which is what every marketplace does and what
          // makes a size list readable at a glance. A Column of full-width rows
          // — which is what this looked like in the build that prompted the
          // complaint — turns four sizes into four screens' worth of scrolling
          // and reads as a menu rather than as a set of options.
          //
          // `SizedBox(width: double.infinity)` above it is deliberately NOT
          // here, and neither is `CrossAxisAlignment.stretch` on any ancestor
          // in this file: either one forces the Wrap's children to the full
          // width and produces exactly that stacked layout.
          Wrap(
            spacing: attribute.showAsSwatches ? 4 : 8,
            runSpacing: attribute.showAsSwatches ? 4 : 8,
            children: [
              for (final option in attribute.options)
                Builder(
                  builder: (_) {
                    final available =
                        _available(d, attribute.name, option.name);
                    final selected = _chosen[attribute.name] == option.name;

                    // One handler for both shapes: a live option takes the
                    // choice, a dead one says why. Neither is silent, which is
                    // the whole difference between a disabled control and a
                    // broken one.
                    void tap() {
                      if (!available) {
                        _rejectOption(attribute.name, option.name);
                        return;
                      }
                      onPick(attribute.name, option.name);
                    }

                    return attribute.showAsSwatches
                        ? _swatchDot(
                            option: option,
                            selected: selected,
                            available: available,
                            onTap: tap,
                          )
                        : _optionChip(
                            label: option.name,
                            selected: selected,
                            available: available,
                            swatchImage: attribute.isColour ? option.image : null,
                            swatchColour:
                                attribute.isColour ? option.swatch : null,
                            onTap: tap,
                          );
                  },
                ),
            ],
          ),
          const SizedBox(height: 18),
        ],
      ],
    );
  }

  /// The pickers where they belong on a product page — under the price, above
  /// the delivery terms, in the flow of the page rather than behind a button.
  ///
  /// The sheet is the SECOND way to reach them, for the shopper who has
  /// scrolled past this to the reviews and decided down there. It is not the
  /// only way, and it should not be: making somebody open a sheet to see what
  /// sizes exist hides the answer to a question they are asking before they
  /// have decided to buy at all.
  Widget _choicesBlock(_Detail d) => Padding(
        padding: const EdgeInsets.fromLTRB(_pad, 6, _pad, 0),
        child: _choiceRows(
          d,
          // `_pick` rather than a bare `setState`: it carries the tick and the
          // click, and it drops any other answer the new one has just made
          // impossible. See its note.
          onPick: (attribute, value) => _pick(d, attribute, value),
        ),
      );

  /// The choices, brought down to the thumb.
  ///
  /// Mirrors `components/VariantSheet.tsx`. The product identifies itself at
  /// the top — photograph, price, and what is chosen so far — because a sheet
  /// that slides up over a scrolled page with nothing but chips in it does not
  /// say which product it is about.
  ///
  /// `isScrollControlled` with a 0.85 cap: a product with three attributes and
  /// twelve colours is taller than the default half-screen sheet, and the cap
  /// keeps the page visible behind it so the sheet still reads as temporary.
  ///
  /// The quantity stepper lives here and only here. It is the one control the
  /// page did not have — the buy bar has always added exactly one — and the
  /// sheet is where it costs nothing, because it is already the "confirm what
  /// you are buying" surface.
  Future<void> _openChoiceSheet(_Detail d, {required bool buyNow}) async {
    HapticFeedback.selectionClick();

    var quantity = 1;
    var showError = false;

    await showModalBottomSheet<void>(
      context: context,
      backgroundColor: _kWhite,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(18)),
      ),
      builder: (rootSheetContext) {
        return StatefulBuilder(
          builder: (sheetContext, setSheetState) {
            void pick(String attribute, String value) {
              // Both, and both are needed: `_pick` calls `setState` so the
              // pickers in the page behind agree with the sheet once it
              // closes, and `setSheetState` so the chip under the finger
              // lights up now — and so the rest of the row re-evaluates what
              // is still available against the choice just made.
              _pick(
                d,
                attribute,
                value,
                after: () => setSheetState(() => showError = false),
              );
            }

            return SafeArea(
              top: false,
              child: ConstrainedBox(
                constraints: BoxConstraints(
                  maxHeight: MediaQuery.of(sheetContext).size.height * 0.85,
                ),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    // The drag handle. Not decoration — it is the only
                    // affordance saying this can be pulled away, and without
                    // one the tap-outside is the sole way out.
                    Container(
                      width: 36,
                      height: 4,
                      margin: const EdgeInsets.only(top: 10, bottom: 6),
                      decoration: BoxDecoration(
                        color: _kLine,
                        borderRadius: BorderRadius.circular(2),
                      ),
                    ),
                    Padding(
                      padding: const EdgeInsets.fromLTRB(_pad, 6, _pad, 10),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          ClipRRect(
                            borderRadius: BorderRadius.circular(_radius),
                            child: SizedBox(
                              width: 64,
                              height: 64,
                              child: d.images.isEmpty
                                  ? const ColoredBox(color: _kHairline)
                                  : CachedNetworkImage(
                                      imageUrl: d.images.first,
                                      httpHeaders: _kImageHeaders,
                                      fit: BoxFit.cover,
                                      placeholder: (_, __) =>
                                          const ColoredBox(color: _kHairline),
                                      errorWidget: (_, __, ___) =>
                                          const ColoredBox(color: _kHairline),
                                    ),
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  d.priceLabel,
                                  style: _price(
                                    size: 20,
                                    color: d.discountPercent > 0
                                        ? _kSale
                                        : _kInk,
                                  ),
                                ),
                                const SizedBox(height: 3),
                                Text(
                                  d.name,
                                  maxLines: 2,
                                  overflow: TextOverflow.ellipsis,
                                  style: _text(size: 12.5, color: _kMuted),
                                ),
                              ],
                            ),
                          ),
                          _Press(
                            onTap: () => Navigator.of(sheetContext).pop(),
                            child: const SizedBox(
                              width: 36,
                              height: 36,
                              child: Icon(Icons.close_rounded,
                                  size: 20, color: _kMuted),
                            ),
                          ),
                        ],
                      ),
                    ),
                    const Divider(height: 1, color: _kHairline),
                    Flexible(
                      child: SingleChildScrollView(
                        padding: const EdgeInsets.fromLTRB(_pad, 16, _pad, 4),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            _choiceRows(d, onPick: pick, showError: showError),
                            Text('Quantity', style: _heading(size: 14)),
                            const SizedBox(height: 9),
                            Row(
                              children: [
                                _stepButton(
                                  Icons.remove_rounded,
                                  enabled: quantity > 1,
                                  onTap: () =>
                                      setSheetState(() => quantity -= 1),
                                ),
                                SizedBox(
                                  width: 54,
                                  child: Text(
                                    '$quantity',
                                    textAlign: TextAlign.center,
                                    style: _heading(size: 16),
                                  ),
                                ),
                                _stepButton(
                                  Icons.add_rounded,
                                  // Capped at what the seller says is on the
                                  // shelf, when they said. A shopper allowed
                                  // to order nine of something with three left
                                  // finds out at the checkout, which is the
                                  // worst place to find out.
                                  enabled: d.stockQuantity == null ||
                                      quantity < d.stockQuantity!,
                                  onTap: () =>
                                      setSheetState(() => quantity += 1),
                                ),
                                if (d.stockQuantity != null &&
                                    d.stockQuantity! <= _kLowStockAt) ...[
                                  const SizedBox(width: 12),
                                  Text(
                                    'Only ${d.stockQuantity} left',
                                    style: _label(
                                      size: 12,
                                      color: _kSale,
                                      weight: FontWeight.w700,
                                    ),
                                  ),
                                ],
                              ],
                            ),
                            const SizedBox(height: 18),
                          ],
                        ),
                      ),
                    ),
                    Padding(
                      padding: const EdgeInsets.fromLTRB(_pad, 8, _pad, 12),
                      child: _Press(
                        onTap: () {
                          final missing = _missing(d);
                          if (missing != null) {
                            // Named, not "please complete your selection". On
                            // a product with a size AND a colour, a generic
                            // message leaves the shopper scanning both lists
                            // for the one they missed.
                            HapticFeedback.heavyImpact();
                            setSheetState(() => showError = true);
                            return;
                          }
                          Navigator.of(sheetContext).pop();
                          if (buyNow) {
                            _buyNow(d, quantity: quantity);
                          } else {
                            _addToCart(d, quantity: quantity);
                          }
                        },
                        child: Container(
                          height: 50,
                          alignment: Alignment.center,
                          decoration: BoxDecoration(
                            color: _kPrimary,
                            borderRadius: BorderRadius.circular(_radius),
                          ),
                          child: Text(
                            buyNow ? 'Buy now' : 'Add to cart',
                            style: _text(
                              size: 15,
                              color: _kWhite,
                              weight: FontWeight.w700,
                            ),
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            );
          },
        );
      },
    );
  }

  /// The − and + of the quantity stepper.
  Widget _stepButton(
    IconData icon, {
    required bool enabled,
    required VoidCallback onTap,
  }) {
    return _Press(
      onTap: enabled ? onTap : null,
      child: Container(
        width: 40,
        height: 40,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(_radius),
          border: Border.all(color: _kLine),
          color: enabled ? _kWhite : _kHairline,
        ),
        child: Icon(icon, size: 18, color: enabled ? _kInk : _kFaint),
      ),
    );
  }

  // ---------- Buy box ----------

  Widget _buyBlock(_Detail d) {
    final soldOut = !d.inStock;
    final lowStock = !soldOut &&
        d.stockQuantity != null &&
        d.stockQuantity! <= _kLowStockAt;

    return Padding(
      padding: const EdgeInsets.fromLTRB(_pad, 14, _pad, 4),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Sold by, and units sold — the two credentials the website prints
          // above the name. Each disappears when there is nothing behind it.
          if (d.sellerName != null && d.sellerName!.isNotEmpty ||
              d.totalSales > 0) ...[
            Row(
              children: [
                if (d.sellerName != null && d.sellerName!.isNotEmpty)
                  Flexible(
                    child: Text(
                      'Sold by ${d.sellerName}',
                      style: _label(
                          size: 12.5, color: _kBody, weight: FontWeight.w600),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                if ((d.sellerName ?? '').isNotEmpty && d.totalSales > 0)
                  Text('  ·  ', style: _label(size: 12.5)),
                if (d.totalSales > 0)
                  Text(
                    '${_compactSold(d.totalSales)} sold',
                    style: _label(size: 12.5),
                  ),
              ],
            ),
            const SizedBox(height: 6),
          ],

          // The name at the interface weight, not the display one. A supplier's
          // 90-character title set bold is a wall, and the shopper arrived from
          // a photograph and already knows what it is.
          Text(
            d.name,
            style: _text(
                size: 17, color: _kInk, weight: FontWeight.w400, height: 1.35),
          ),

          const SizedBox(height: 10),

          // The money.
          Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                d.priceLabel,
                style: _price(
                  size: 26,
                  color: soldOut
                      ? _kMuted
                      : (d.discountPercent > 0 ? _kSale : _kInk),
                ),
              ),
              if (!soldOut && d.wasPriceLabel != null) ...[
                const SizedBox(width: 8),
                Padding(
                  padding: const EdgeInsets.only(bottom: 2),
                  child: Text(d.wasPriceLabel!, style: _struck(size: 15)),
                ),
              ],
            ],
          ),

          // The saving in money, not just a percentage. "Save 30%" is an
          // abstraction; "You save UGX 55,000" is the number a shopper weighs.
          if (!soldOut && d.savingLabel != null) ...[
            const SizedBox(height: 5),
            Text(
              'You save ${d.savingLabel}',
              style: _label(
                  size: 13.5, color: _kSuccess, weight: FontWeight.w700),
            ),
          ],

          const SizedBox(height: 10),

          // Stock, in descending order of how much it changes what happens next.
          if (soldOut)
            _pill(
              'Out of stock',
              background: _kHairline,
              foreground: _kInk,
              icon: Icons.remove_circle_outline_rounded,
            )
          else if (lowStock)
            _pill(
              'Only ${d.stockQuantity} left',
              background: const Color(0xFFFEF2F2),
              foreground: _kSale,
              icon: Icons.local_fire_department_rounded,
            )
          else
            _pill(
              'In stock',
              background: _kSuccessBg,
              foreground: _kSuccess,
              icon: Icons.check_circle_outline_rounded,
            ),

          if (d.ratingCount > 0) ...[
            const SizedBox(height: 12),
            Row(
              children: [
                _stars(d.rating),
                const SizedBox(width: 6),
                Text(
                  d.rating.toStringAsFixed(1),
                  style: _label(
                      size: 13, color: _kInk, weight: FontWeight.w700),
                ),
                const SizedBox(width: 5),
                Text(
                  '(${d.ratingCount} ${d.ratingCount == 1 ? 'review' : 'reviews'})',
                  style: _label(size: 12.5),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }

  Widget _pill(
    String text, {
    required Color background,
    required Color foreground,
    required IconData icon,
  }) =>
      Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        decoration: BoxDecoration(
          color: background,
          borderRadius: BorderRadius.circular(6),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 14, color: foreground),
            const SizedBox(width: 5),
            Text(
              text,
              style: _label(
                  size: 12.5, color: foreground, weight: FontWeight.w700),
            ),
          ],
        ),
      );

  // ---------- Terms ----------

  /// Delivery, payment and returns, every figure from the shop's settings.
  ///
  /// v2 printed "7-Day Returns" and "Free Shipping over UGX 100,000" as
  /// hardcoded badges. Both were invented — the shop's real returns window and
  /// free-delivery threshold live in wp-admin and can be changed there, and a
  /// page promising something the checkout refuses is the fastest way to lose a
  /// shopper at the last step.
  Widget _termsBlock(_Detail d) {
    final rows = <List<dynamic>>[
      [
        Icons.local_shipping_outlined,
        d.freeDeliveryFrom > 0
            ? 'Free delivery on orders over UGX ${_thousands(d.freeDeliveryFrom)}'
            : 'Delivery across Uganda in 1–3 business days',
      ],
      [Icons.payments_outlined, 'Pay on delivery — cash, MTN MoMo or Airtel'],
      if (d.returnsDays > 0)
        [
          Icons.assignment_return_outlined,
          '${d.returnsDays}-day returns, in original condition',
        ],
    ];

    return Container(
      margin: const EdgeInsets.fromLTRB(_pad, 12, _pad, 4),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: _kSurface,
        borderRadius: BorderRadius.circular(_radius),
      ),
      child: Column(
        children: [
          for (var i = 0; i < rows.length; i++) ...[
            if (i > 0) const SizedBox(height: 9),
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(rows[i][0] as IconData, size: 16, color: _kSuccess),
                const SizedBox(width: 9),
                Expanded(
                  child: Text(
                    rows[i][1] as String,
                    style: _text(size: 13, color: _kBody, height: 1.35),
                  ),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }

  /// UGX thousands separators, matching the server's own formatter.
  ///
  /// Only used for the free-delivery threshold, which arrives as a number
  /// rather than a label — every other figure on this page is formatted
  /// server-side precisely so the two cannot disagree about a separator.
  String _thousands(double value) {
    final digits = value.round().toString();
    final out = StringBuffer();
    for (var i = 0; i < digits.length; i++) {
      if (i > 0 && (digits.length - i) % 3 == 0) out.write(',');
      out.write(digits[i]);
    }
    return out.toString();
  }

  // ---------- Description ----------

  Widget _descriptionBlock(_Detail d) {
    // Collapsed at four lines. Imported supplier descriptions run to spec
    // tables and boilerplate, and at full height they push the reviews and the
    // related products off the screen entirely.
    const collapsed = 4;

    return Padding(
      padding: const EdgeInsets.fromLTRB(_pad, 16, _pad, 4),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Description', style: _heading(size: 17)),
          const SizedBox(height: 8),
          Text(
            d.description,
            style: _text(size: 14, color: _kBody, height: 1.55),
            maxLines: _descExpanded ? null : collapsed,
            overflow: _descExpanded ? null : TextOverflow.ellipsis,
          ),
          // The toggle only appears when there is something to reveal, so a
          // two-line description does not get a "Read more" that does nothing.
          if (d.description.length > 180) ...[
            const SizedBox(height: 6),
            _Press(
              onTap: () => setState(() => _descExpanded = !_descExpanded),
              child: Text(
                _descExpanded ? 'Show less' : 'Read more',
                style: _label(
                    size: 13, color: _kPrimaryInk, weight: FontWeight.w700),
              ),
            ),
          ],
        ],
      ),
    );
  }

  // ---------- Specs ----------

  /// The attributes that belong in the Details table — the facts, not the
  /// questions.
  ///
  /// The complement of `_pickable`. Size and colour used to be printed here as
  /// comma strings AND are now chips under the price; leaving them in both
  /// places would have the page state the same list twice, once where it can
  /// be acted on and once where it cannot, which reads as a bug rather than as
  /// thoroughness.
  ///
  /// A single-value attribute stays: "Material — Cotton" is exactly what this
  /// table is for.
  /// Every attribute, which is what the website's own details table prints.
  ///
  /// This used to be the strict complement of `_pickable` — the attributes NOT
  /// offered as chips — so that the page could not state the same list twice.
  /// Now that every attribute is a chip row, that rule would empty this table
  /// completely and take "Material — Cotton" off the page with it.
  ///
  /// So it lists them all, exactly as `app/products/[id]/page.tsx` does. The
  /// two blocks are not a duplicate: the chips are where a choice is MADE, near
  /// the price and the buy button; this is the specification, read by somebody
  /// comparing two products rather than buying one.
  List<_Attribute> _specs(_Detail d) => d.attributes;

  Widget _specsBlock(_Detail d) => Padding(
        padding: const EdgeInsets.fromLTRB(_pad, 16, _pad, 4),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Details', style: _heading(size: 17)),
            const SizedBox(height: 8),
            // The seller's own WooCommerce attributes, and nothing else. The
            // website's spec table used to add "Care: Machine washable" and
            // "Occasion: Casual" to every listing including chargers and
            // blenders; one obviously invented row makes a shopper doubt the
            // real ones beside it.
            for (final a in _specs(d))
              Container(
                padding: const EdgeInsets.symmetric(vertical: 9),
                decoration: const BoxDecoration(
                  border: Border(bottom: BorderSide(color: _kHairline)),
                ),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    SizedBox(
                      width: 110,
                      child: Text(a.name, style: _label(size: 13)),
                    ),
                    Expanded(
                      child: Text(
                        a.values.join(', '),
                        style: _text(size: 13.5, color: _kBody),
                      ),
                    ),
                  ],
                ),
              ),
          ],
        ),
      );

  // ---------- Reviews ----------

  Widget _reviewsBlock(_Detail d) => Padding(
        padding: const EdgeInsets.fromLTRB(_pad, 16, _pad, 4),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Text('Reviews', style: _heading(size: 17)),
                const SizedBox(width: 8),
                Text('(${d.ratingCount})', style: _label(size: 13)),
              ],
            ),
            const SizedBox(height: 10),
            for (final review in d.reviews)
              Container(
                margin: const EdgeInsets.only(bottom: 10),
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: _kSurface,
                  borderRadius: BorderRadius.circular(_radius),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        _stars(review.rating.toDouble(), size: 12),
                        const SizedBox(width: 7),
                        Flexible(
                          child: Text(
                            review.author,
                            style: _label(
                                size: 12.5,
                                color: _kInk,
                                weight: FontWeight.w700),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                        // Only shown when WooCommerce says the reviewer
                        // actually bought it. A "verified" badge on every
                        // review is worth nothing to the ones that earned it.
                        if (review.verified) ...[
                          const SizedBox(width: 6),
                          const Icon(Icons.verified_rounded,
                              size: 13, color: _kSuccess),
                        ],
                      ],
                    ),
                    if (review.body.isNotEmpty) ...[
                      const SizedBox(height: 6),
                      Text(
                        review.body,
                        style: _text(size: 13.5, color: _kBody, height: 1.5),
                      ),
                    ],
                  ],
                ),
              ),
          ],
        ),
      );

  // ---------- Related ----------

  Widget _relatedBlock(_Detail d) => Padding(
        padding: const EdgeInsets.only(top: 16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: _pad),
              child: Text('You may also like', style: _heading(size: 17)),
            ),
            const SizedBox(height: 10),
            SizedBox(
              // The tile is a square photograph plus a fixed text block, the
              // same arithmetic the home and category grids use.
              height: 140 + 66,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(horizontal: _pad),
                itemCount: d.related.length,
                separatorBuilder: (_, __) => const SizedBox(width: 10),
                itemBuilder: (_, i) {
                  final r = d.related[i];
                  return _Press(
                    onTap: () => _openRelated(r),
                    child: SizedBox(
                      width: 140,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          ClipRRect(
                            borderRadius: BorderRadius.circular(_radius),
                            child: SizedBox(
                              width: 140,
                              height: 140,
                              child: r.image.isEmpty
                                  ? const ColoredBox(color: _kHairline)
                                  : CachedNetworkImage(
                                      imageUrl: r.image,
                                      httpHeaders: _kImageHeaders,
                                      fit: BoxFit.cover,
                                      memCacheWidth: 400,
                                      placeholder: (_, __) =>
                                          const ColoredBox(color: _kHairline),
                                      errorWidget: (_, __, ___) =>
                                          const ColoredBox(color: _kHairline),
                                    ),
                            ),
                          ),
                          const SizedBox(height: 6),
                          SizedBox(
                            height: 36,
                            child: Text(
                              r.name,
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                              style: _text(
                                size: 12.5,
                                color: _kInk,
                                weight: FontWeight.w400,
                                height: 18 / 12.5,
                              ),
                            ),
                          ),
                          Text(
                            r.priceLabel,
                            style: _price(
                              size: 14,
                              color:
                                  r.discountPercent > 0 ? _kSale : _kInk,
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ],
                      ),
                    ),
                  );
                },
              ),
            ),
          ],
        ),
      );

  // ---------- The buy bar ----------

  /// Pinned to the foot of the screen, never scrolled.
  ///
  /// The one control the whole page exists to deliver a shopper to. v2 put it
  /// at the bottom of a Column outside the scroll view, which is right; this
  /// keeps that and adds the state the button has to be able to express — a
  /// sold-out product must not offer a cart button that works.
  /// ---- The price, then two buttons side by side ----
  ///
  /// The bar was a heart and one full-width "Add to cart". Two things were
  /// wrong with that.
  ///
  /// The price had scrolled away. This bar is pinned, so on a long page — the
  /// description, the specs, the reviews, the related rail — the shopper is
  /// looking at a button that commits them to a number they can no longer see.
  /// It now carries the figure it is charging, which is the same thing the
  /// checkout bar in the basket does.
  ///
  /// And "Add to cart" alone serves the shopper who is still browsing while
  /// making the one who has decided take an extra step: add, find the basket,
  /// open it. "Buy now" is that shopper's button. It is deliberately not a
  /// separate express checkout — it is the same basket write plus the
  /// navigation they were about to do, because a second path to an order is a
  /// second place for the delivery quote and the stock check to be got wrong.
  ///
  /// "Add to cart" is the outlined one and "Buy now" the filled one: the filled
  /// button should be the one that ends the journey, and orange twice over
  /// makes neither of them the answer.
  Widget _buyBar(_Detail d) {
    final soldOut = !d.inStock;

    Widget button({
      required String label,
      required IconData icon,
      required bool filled,
      VoidCallback? onTap,
    }) =>
        Expanded(
          child: _Press(
            onTap: onTap,
            child: Container(
              height: 46,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: onTap == null
                    ? _kHairline
                    : filled
                        ? _kPrimary
                        : _kWhite,
                borderRadius: BorderRadius.circular(_radius),
                border: Border.all(
                  color: onTap == null
                      ? _kHairline
                      : filled
                          ? _kPrimary
                          : _kPrimary,
                ),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(
                    icon,
                    size: 17,
                    color: onTap == null
                        ? _kMuted
                        : filled
                            ? _kWhite
                            : _kPrimaryInk,
                  ),
                  const SizedBox(width: 7),
                  Flexible(
                    child: Text(
                      label,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: _text(
                        size: 14.5,
                        color: onTap == null
                            ? _kMuted
                            : filled
                                ? _kWhite
                                : _kPrimaryInk,
                        weight: FontWeight.w700,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        );

    return Container(
      decoration: const BoxDecoration(
        color: _kWhite,
        border: Border(top: BorderSide(color: _kLine)),
      ),
      child: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(_pad, 8, _pad, 8),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              // The price, beside the saving when there is one. The whole
              // reason this row exists is that the buy box has scrolled away.
              Row(
                children: [
                  Text(
                    d.priceLabel,
                    style: _price(
                      size: 19,
                      color: soldOut
                          ? _kMuted
                          : (d.discountPercent > 0 ? _kSale : _kInk),
                    ),
                  ),
                  if (!soldOut && d.wasPriceLabel != null) ...[
                    const SizedBox(width: 7),
                    Text(d.wasPriceLabel!, style: _struck(size: 13)),
                  ],
                  const Spacer(),
                  if (!soldOut && d.savingLabel != null)
                    Text(
                      'You save ${d.savingLabel}',
                      style: _label(
                        size: 12,
                        color: _kSuccess,
                        weight: FontWeight.w700,
                      ),
                    ),
                ],
              ),
              const SizedBox(height: 8),
              Row(
                children: [
                  _Press(
                    onTap: () => _toggleWishlist(d),
                    child: Container(
                      width: 46,
                      height: 46,
                      decoration: BoxDecoration(
                        color: _kWhite,
                        borderRadius: BorderRadius.circular(_radius),
                        border:
                            Border.all(color: _wishlisted ? _kSale : _kLine),
                      ),
                      child: Icon(
                        _wishlisted
                            ? Icons.favorite_rounded
                            : Icons.favorite_border_rounded,
                        size: 20,
                        color: _wishlisted ? _kSale : _kBody,
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  // ---- Both buttons go through `_requestPurchase` now ----
                  //
                  // They used to call `_addToCart` and `_buyNow` directly,
                  // which meant a shoe with four sizes went into the basket
                  // with no size on it — silently, from the bar the shopper is
                  // most likely to use, because it is docked and the pickers
                  // are hundreds of pixels up the page.
                  //
                  // `_requestPurchase` adds straight away when there is
                  // nothing left to answer, and otherwise slides the choices
                  // up to the thumb. The argument for that rule, and against
                  // the two obvious alternatives, is on that method.
                  button(
                    label: soldOut ? 'Out of stock' : 'Add to cart',
                    icon: Icons.shopping_bag_outlined,
                    filled: false,
                    onTap: soldOut
                        ? null
                        : () => _requestPurchase(d, buyNow: false),
                  ),
                  if (!soldOut) ...[
                    const SizedBox(width: 8),
                    button(
                      label: 'Buy now',
                      icon: Icons.bolt_rounded,
                      filled: true,
                      onTap: () => _requestPurchase(d, buyNow: true),
                    ),
                  ],
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  // ---------- Skeleton and error ----------

  Widget _skeleton() {
    final width = MediaQuery.of(context).size.width;

    Widget bar(double w, double h) => Container(
          width: w,
          height: h,
          margin: const EdgeInsets.only(bottom: 10),
          decoration: BoxDecoration(
            color: _kHairline,
            borderRadius: BorderRadius.circular(6),
          ),
        );

    return SingleChildScrollView(
      physics: const NeverScrollableScrollPhysics(),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // The same square as the real gallery, so the page does not jump
          // when the photograph lands.
          Container(width: width, height: width, color: _kHairline),
          Padding(
            padding: const EdgeInsets.all(_pad),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                bar(140, 12),
                bar(width - 60, 18),
                bar(width - 140, 18),
                const SizedBox(height: 6),
                bar(120, 26),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _errorState() => Center(
        child: Padding(
          padding: const EdgeInsets.all(28),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.wifi_off_rounded, size: 40, color: _kFaint),
              const SizedBox(height: 14),
              Text(
                'Cannot open this product',
                style: _heading(size: 17),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 6),
              Text(
                _error ?? '',
                style: _text(size: 13.5, color: _kMuted),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 18),
              _Press(
                onTap: _load,
                child: Container(
                  padding: const EdgeInsets.symmetric(
                      horizontal: 26, vertical: 12),
                  decoration: BoxDecoration(
                    color: _kPrimary,
                    borderRadius: BorderRadius.circular(_radius),
                  ),
                  child: Text(
                    'Try again',
                    style: _text(
                        size: 14, color: _kWhite, weight: FontWeight.w700),
                  ),
                ),
              ),
              const SizedBox(height: 10),
              _Press(
                onTap: _back,
                child: Text(
                  'Go back',
                  style: _label(
                      size: 13, color: _kBody, weight: FontWeight.w600),
                ),
              ),
            ],
          ),
        ),
      );
}
