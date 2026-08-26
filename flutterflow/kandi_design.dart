// Automatic FlutterFlow imports
// ---- Two boilerplate imports are deliberately absent ----
//
// FlutterFlow's generated header normally opens with
//
//     import '/backend/backend.dart';
//     import '/backend/supabase/supabase.dart';
//
// and this project has neither file. See the note at the head of
// home_sections_widget.dart — adding them back breaks the web build in every
// custom widget at once. Do not add them back.
import '/flutter_flow/flutter_flow_theme.dart';
import '/flutter_flow/flutter_flow_util.dart';
import '/custom_code/widgets/index.dart'; // Imports other custom widgets
import '/flutter_flow/custom_functions.dart'; // Imports custom functions
import 'package:flutter/material.dart';
// Begin custom widget code
// DO NOT REMOVE OR MODIFY THE CODE ABOVE!

import 'dart:async';
import 'dart:convert';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:http/http.dart' as http;

// ============================================================
//  KANDI — THE DESIGN SYSTEM
//
//  One file that every other screen imports. It carries the
//  palette, the type scale, the spacing, the shared network
//  layer and the handful of widgets a screen is made of.
//
//  WHY THIS EXISTS
//  -----------------------------------------------------------
//  There were twelve screens and twelve private copies of the
//  palette — `const Color _kPrimary = ...` at the top of every
//  file, redeclared each time because a `_` name cannot cross a
//  file boundary.
//
//  Twelve copies of one decision is twelve chances to disagree,
//  and they already had:
//
//      account_widget.dart           _kPrimarySoft  #FFF1E6
//      category_navigation_menu.dart _kPrimarySoft  #FFF3E8
//
//  Two tints, same name, same intent, on adjacent screens.
//  Nobody typed the wrong colour; the second was written on a
//  different afternoon. That is what a copied constant does over
//  time, and it is why this file is the first thing in the
//  rebuild rather than a tidy-up after it.
//
//  The app had also drifted from the website: ink here was
//  #171717 where the storefront's is #111827. One brand, one
//  value.
//
//  HOW IT REACHES THE OTHER SCREENS
//  -----------------------------------------------------------
//  FlutterFlow generates `/custom_code/widgets/index.dart`,
//  which re-exports every custom widget in the project — and
//  every screen here already imports it (see any header). So a
//  PUBLIC symbol declared in this file is visible in all of them
//  with no extra import line.
//
//  That is also why every name below is public. A `_kPrimary`
//  here would be exactly as unreachable as the twelve it
//  replaces.
//
//  ---- Paste this into FlutterFlow FIRST ----
//
//  Custom Code > Widgets > Add, like the others. It has to exist
//  before any rebuilt screen is pasted, or those screens will
//  not compile: they name `KandiColors`, `KandiType` and the
//  rest directly.
// ============================================================

// ============================================================
//  COLOUR
// ============================================================

/// The shop's palette, and the only place a colour is decided.
///
/// ---- The ground is grey now, and that is the biggest change ----
///
/// Every screen was white, with white cards on it. A white card on a white
/// page has no edge of its own, so the app leaned on hairline borders to say
/// where one thing ended and the next began — and a screen of bordered white
/// rectangles reads as a form rather than as a shop.
///
/// The reference this rebuild follows does the opposite, and so does nearly
/// every large marketplace app: a light grey page with white cards on it. The
/// card then needs no border, because the ground supplies the contrast and the
/// shadow does the lifting. It is also the arrangement that survives a long
/// scroll — forty bordered rectangles is tiring in a way that forty floating
/// cards is not.
///
/// `page` is that grey; `surface` is the white a card is drawn in. Nothing
/// should reach for `Colors.white` directly: a card that names its own white
/// will not follow when the ground next changes.
class KandiColors {
  const KandiColors._();

  // ---- Brand ----
  //
  // Unchanged, deliberately. The brief was a new design, not a new brand: this
  // orange is on the website, the packaging and the receipts, and a phone app
  // in a different orange is a different company as far as a shopper knows.
  static const Color primary = Color(0xFFFF6A00);
  static const Color primaryDark = Color(0xFFE85D00);

  /// The orange that is allowed to carry small text.
  ///
  /// #FF6A00 is a LIGHT hue — 2.9:1 on white — so it fails AA for body copy
  /// and misses the 3:1 graphics threshold too. It is a fill colour and a
  /// display-size colour and nothing else. This burnt step is 6.4:1 and is
  /// what a 13px orange label has to use.
  static const Color primaryInk = Color(0xFFB34A00);

  /// The tint behind an active row, or an avatar with no photograph.
  ///
  /// One value, where the old screens had two differing by three points of
  /// red. See the note at the head of this file.
  static const Color primarySoft = Color(0xFFFFF3E8);

  // ---- Type ----
  //
  // Four steps from one neutral ramp. The old palette mixed a slate ramp
  // (#475569, #64748B, #94A3B8) with neutral hairlines (#E5E7EB, #F3F4F6) —
  // two grey families a few degrees apart in hue, which nobody can name on
  // sight and everybody registers as the screen looking faintly unresolved.
  static const Color ink = Color(0xFF111827);
  static const Color body = Color(0xFF4B5563);
  static const Color muted = Color(0xFF6B7280);
  static const Color faint = Color(0xFF9CA3AF);

  // ---- Surfaces ----
  static const Color page = Color(0xFFF4F5F7);
  static const Color surface = Colors.white;
  static const Color line = Color(0xFFE5E7EB);
  static const Color hairline = Color(0xFFF3F4F6);

  /// The near-black behind a masthead, a bottom bar or any dark panel.
  static const Color band = Color(0xFF111827);

  // ---- Meaning ----
  static const Color success = Color(0xFF16A34A);
  static const Color successSoft = Color(0xFFF0FDF4);
  static const Color sale = Color(0xFFE53935);
  static const Color saleSoft = Color(0xFFFEF2F2);

  /// The deal colour, on chips and discount flags.
  ///
  /// Yellow rather than red, matching the storefront: red on a tile meant both
  /// "reduced" and "nearly gone", and one hue cannot carry two meanings on the
  /// same card. Ink on this is 11:1 — a chip in it takes ink type, never
  /// white, which lands at 1.6:1 and cannot be read at all.
  static const Color deal = Color(0xFFFACC15);
}

// ============================================================
//  TYPE
// ============================================================

/// The type scale, as one class.
///
/// Inter throughout, at one of a fixed set of sizes. The screens this replaces
/// each built a `TextStyle` inline at whatever size the moment suggested —
/// nineteen distinct font sizes across the app, most within a pixel of
/// another, which is what makes a set of screens read as several apps.
///
/// A scale is a small set of steps used repeatedly. These are the steps.
class KandiType {
  const KandiType._();

  static TextStyle _base(
    double size,
    FontWeight weight,
    Color color,
    double height,
  ) =>
      GoogleFonts.inter(
        fontSize: size,
        fontWeight: weight,
        color: color,
        height: height,
      );

  /// A screen title, or the one number a screen exists to show.
  static TextStyle display({Color color = KandiColors.ink}) =>
      _base(26, FontWeight.w700, color, 1.15);

  /// A section heading — "Trending now", "Your orders".
  static TextStyle heading({Color color = KandiColors.ink}) =>
      _base(17, FontWeight.w700, color, 1.25);

  /// A card title, a row label, an app-bar title.
  static TextStyle title({Color color = KandiColors.ink}) =>
      _base(15, FontWeight.w600, color, 1.3);

  /// Running text.
  static TextStyle bodyText({Color color = KandiColors.body}) =>
      _base(14, FontWeight.w400, color, 1.5);

  /// A product name on a tile, and anything else that stays small and must
  /// still be read at arm's length.
  static TextStyle label({Color color = KandiColors.ink}) =>
      _base(13, FontWeight.w400, color, 1.35);

  /// Supporting detail: a sold count, a stock line, a caption.
  static TextStyle caption({Color color = KandiColors.muted}) =>
      _base(12, FontWeight.w400, color, 1.35);

  /// The smallest step. Chips and badges only — never a sentence.
  static TextStyle micro({
    Color color = KandiColors.muted,
    FontWeight weight = FontWeight.w600,
  }) =>
      _base(11, weight, color, 1.2);

  /// Money.
  ///
  /// Its own step, because a price is not a heading that happens to be a
  /// number: it is read digit by digit, it must never wrap, and it wants
  /// tabular figures so a column of totals lines up. `fontFeatures` is what
  /// buys that last part — without it Inter's proportional digits leave a
  /// column of UGX prices ragged down its right edge.
  static TextStyle price({
    double size = 16,
    Color color = KandiColors.ink,
    FontWeight weight = FontWeight.w700,
  }) =>
      GoogleFonts.inter(
        fontSize: size,
        fontWeight: weight,
        color: color,
        height: 1.1,
        fontFeatures: const [FontFeature.tabularFigures()],
      );

  /// A price that has been struck through.
  static TextStyle wasPrice({double size = 12}) => GoogleFonts.inter(
        fontSize: size,
        fontWeight: FontWeight.w400,
        color: KandiColors.faint,
        height: 1.1,
        decoration: TextDecoration.lineThrough,
        decorationColor: KandiColors.faint,
        fontFeatures: const [FontFeature.tabularFigures()],
      );
}

// ============================================================
//  MEASUREMENT
// ============================================================

/// Spacing, on a four-point scale.
///
/// The screens being replaced used `EdgeInsets.all(14)` beside
/// `EdgeInsets.all(16)` beside `EdgeInsets.all(15)` — nobody chose that; it is
/// what happens when every padding is decided on its own.
class KandiSpace {
  const KandiSpace._();

  static const double xs = 4;
  static const double sm = 8;
  static const double md = 12;
  static const double lg = 16;
  static const double xl = 24;
  static const double xxl = 32;

  /// The page gutter. Every screen's horizontal padding is this.
  static const double gutter = 12;
}

class KandiRadius {
  const KandiRadius._();

  /// Chips and small badges.
  static const BorderRadius sm = BorderRadius.all(Radius.circular(6));

  /// The default: cards, tiles, images, inputs.
  static const BorderRadius md = BorderRadius.all(Radius.circular(12));

  /// Sheets, and the large panels on a product page.
  static const BorderRadius lg = BorderRadius.all(Radius.circular(20));

  /// Fully round — avatars, icon buttons, pills.
  static const BorderRadius pill = BorderRadius.all(Radius.circular(999));
}

/// The one shadow in the app.
///
/// Low, wide and very light. A card on a grey ground barely needs lifting —
/// the contrast already does that — and a heavier shadow under forty tiles
/// turns the gaps between them grey, which is the haze that makes a scrolling
/// grid feel dirty.
class KandiShadow {
  const KandiShadow._();

  static const List<BoxShadow> card = [
    BoxShadow(color: Color(0x0D111827), blurRadius: 12, offset: Offset(0, 2)),
  ];

  /// For something floating above the page — a bottom bar, a sheet.
  static const List<BoxShadow> raised = [
    BoxShadow(color: Color(0x14111827), blurRadius: 20, offset: Offset(0, -2)),
  ];
}

// ============================================================
//  MONEY
// ============================================================

/// Money, in the shop's only currency.
///
/// One implementation, where each screen carried its own. Grouped by hand
/// rather than through `intl`: a second formatter is a second set of rounding
/// rules for the same figures, and the two disagree the first time somebody
/// passes a double.
String kandiPrice(num value) {
  final whole = value.round().abs().toString();
  final buffer = StringBuffer();
  for (var i = 0; i < whole.length; i++) {
    if (i > 0 && (whole.length - i) % 3 == 0) buffer.write(',');
    buffer.write(whole[i]);
  }
  return 'UGX ${value < 0 ? '-' : ''}${buffer.toString()}';
}

/// "2.4K sold" — the compact form a tile prints beside a price.
String kandiCompact(num value) {
  if (value >= 1000000) return '${(value / 1000000).toStringAsFixed(1)}M';
  if (value >= 1000) return '${(value / 1000).toStringAsFixed(1)}K';
  return value.round().toString();
}

// ============================================================
//  SPEED
// ============================================================

/// Where the storefront lives.
const String kandiApiBase = 'https://kandiug.com';

/// One in-memory cache, shared by every screen.
///
/// ---- The problem this solves, and it is the main one ----
///
/// There was no caching anywhere in the app. Not a stale-while-revalidate, not
/// a memo, nothing: every screen fired its fetches from `initState` and threw
/// the answer away when it was popped. A shopper who opened the home screen,
/// tapped a product, pressed back and tapped another paid for the home feed
/// twice — over a Ugandan mobile connection — to render bytes the phone had
/// held a few seconds earlier.
///
/// That is the difference between an app that feels instant and one that
/// spins, and no amount of widget tuning touches it.
///
/// ---- How it behaves ----
///
/// Read-through with a TTL and — the part that decides how it FEELS — a stale
/// entry is returned immediately while a refresh runs behind it. A screen
/// visited before paints from memory on the same frame and corrects itself a
/// moment later, which is what "fast" means to somebody holding a phone.
///
/// Deliberately memory-only. A disk cache survives a restart and then needs
/// invalidating, versioning and a size budget; this is a shopping session, and
/// a session is exactly the lifetime worth caching for.
class KandiCache {
  KandiCache._();

  static final Map<String, _KandiEntry> _entries = <String, _KandiEntry>{};

  /// Bounded, because a search screen can otherwise mint a key per keystroke
  /// and hold every result of a long session.
  static const int _maxEntries = 60;
  static const Duration _defaultTtl = Duration(minutes: 5);

  /// Reads through the cache, fetching when there is nothing fresh.
  ///
  /// `onRefresh` fires only when a STALE value was served and the background
  /// fetch has since produced a newer one — the caller's cue to `setState`. It
  /// never fires on a miss, because the returned future already carries that
  /// answer.
  static Future<T> read<T>(
    String key, {
    required Future<T> Function() fetch,
    Duration ttl = _defaultTtl,
    void Function(T fresh)? onRefresh,
  }) async {
    final entry = _entries[key];

    if (entry != null) {
      if (DateTime.now().difference(entry.storedAt) < ttl) {
        return entry.value as T;
      }

      // Stale: hand back what we have and correct it behind the shopper.
      unawaited(() async {
        try {
          final value = await fetch();
          _put(key, value);
          onRefresh?.call(value);
        } catch (_) {
          // A failed refresh leaves the stale value in place, which is right:
          // something on the screen beats an error replacing something that
          // was working.
        }
      }());
      return entry.value as T;
    }

    final value = await fetch();
    _put(key, value);
    return value;
  }

  /// What is held for this key right now — fresh or stale — without fetching.
  ///
  /// This is what lets a screen paint on its first frame instead of after a
  /// spinner: `build` asks synchronously and renders while `initState`'s fetch
  /// is still in flight.
  static T? peek<T>(String key) {
    final value = _entries[key]?.value;
    return value is T ? value : null;
  }

  static void _put(String key, Object? value) {
    if (_entries.length >= _maxEntries && !_entries.containsKey(key)) {
      // Oldest out. Dart iterates a map in insertion order, so the first key
      // is the least recently ADDED — good enough for a session cache and far
      // cheaper than tracking access times.
      _entries.remove(_entries.keys.first);
    }
    _entries[key] = _KandiEntry(value, DateTime.now());
  }

  /// Stores a value directly, without a fetch.
  ///
  /// For the screens that cannot express their load as a single `read` — the
  /// seller dashboard issues two calls in parallel and has to interpret a 401
  /// across both, so it fetches by hand and hands the results here.
  ///
  /// Without this, a screen that seeds its state from `peek` never hits:
  /// nothing would ever put a value under the key it is peeking at. That is
  /// exactly the bug this was added to fix.
  static void write(String key, Object? value) => _put(key, value);

  /// Drops one key, or everything.
  ///
  /// Called after a write that invalidates a read — adding to the cart makes
  /// the cart's own key wrong. A screen that mutates data is responsible for
  /// saying so.
  static void invalidate([String? key]) {
    if (key == null) {
      _entries.clear();
    } else {
      _entries.remove(key);
    }
  }
}

class _KandiEntry {
  const _KandiEntry(this.value, this.storedAt);
  final Object? value;
  final DateTime storedAt;
}

/// One call to the storefront.
///
/// Returns the status and the decoded body together rather than throwing:
/// every caller has a screen state for failure and none wants a stack trace.
/// Status `0` means the request never reached the server, which callers keep
/// separate from a real status so they can say "check your connection" rather
/// than inventing an explanation the server never gave.
class KandiApi {
  const KandiApi._();

  static Future<({int status, dynamic data})> get(
    String path, {
    Map<String, String>? headers,
    Duration timeout = const Duration(seconds: 20),
  }) async {
    try {
      final response = await http
          .get(Uri.parse('$kandiApiBase$path'), headers: headers)
          .timeout(timeout);
      return (status: response.statusCode, data: _decode(response.body));
    } catch (_) {
      return (status: 0, data: null);
    }
  }

  static Future<({int status, dynamic data})> post(
    String path, {
    Object? body,
    Map<String, String>? headers,
    Duration timeout = const Duration(seconds: 25),
  }) async {
    try {
      final response = await http
          .post(
            Uri.parse('$kandiApiBase$path'),
            headers: {'Content-Type': 'application/json', ...?headers},
            body: body == null ? null : jsonEncode(body),
          )
          .timeout(timeout);
      return (status: response.statusCode, data: _decode(response.body));
    } catch (_) {
      return (status: 0, data: null);
    }
  }

  static dynamic _decode(String body) {
    try {
      return jsonDecode(body);
    } catch (_) {
      return null;
    }
  }

  /// A readable message out of an error body, or the fallback.
  static String message(dynamic data, String fallback) {
    if (data is Map && data['message'] is String) {
      final text = (data['message'] as String).trim();
      if (text.isNotEmpty) return text;
    }
    return fallback;
  }
}

/// A product photograph, sized for the box it is going into.
///
/// ---- Why this is not a bare CachedNetworkImage ----
///
/// `memCacheWidth` is the whole point. Without it Flutter decodes the file at
/// its natural size and holds the full bitmap: a 1200px product shot in a
/// 170px tile is roughly fifty times the pixels needed, and a grid of twenty
/// is what makes a mid-range Android phone stutter while scrolling.
///
/// The width comes from the box being drawn into, multiplied by the device
/// pixel ratio so it stays sharp on a 3x screen.
class KandiImage extends StatelessWidget {
  const KandiImage({
    super.key,
    required this.url,
    required this.width,
    this.height,
    this.fit = BoxFit.cover,
    this.radius = KandiRadius.md,
  });

  final String url;
  final double width;
  final double? height;
  final BoxFit fit;
  final BorderRadius radius;

  @override
  Widget build(BuildContext context) {
    if (url.trim().isEmpty) return _placeholder();

    final ratio = MediaQuery.of(context).devicePixelRatio;

    return ClipRRect(
      borderRadius: radius,
      child: CachedNetworkImage(
        imageUrl: url,
        width: width,
        height: height,
        fit: fit,
        memCacheWidth: (width * ratio).round(),
        // A fade on every tile of a scrolling grid is twenty animations
        // competing for one frame budget. Short enough to read as "arrived"
        // rather than as an effect.
        fadeInDuration: const Duration(milliseconds: 120),
        placeholder: (_, __) => _placeholder(),
        errorWidget: (_, __, ___) => _placeholder(),
      ),
    );
  }

  Widget _placeholder() => Container(
        width: width,
        height: height,
        decoration: BoxDecoration(
          color: KandiColors.hairline,
          borderRadius: radius,
        ),
        child: const Center(
          child: Icon(Icons.image_outlined, size: 22, color: KandiColors.faint),
        ),
      );
}

// ============================================================
//  THE PIECES A SCREEN IS MADE OF
// ============================================================

/// A white card on the grey page.
///
/// The most repeated object in the app. No border: the ground supplies the
/// edge, and a card with both a shadow and a hairline is wearing a belt and
/// braces — see the note on `KandiColors.page`.
class KandiCard extends StatelessWidget {
  const KandiCard({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(KandiSpace.lg),
    this.onTap,
    this.radius = KandiRadius.md,
    this.margin,
  });

  final Widget child;
  final EdgeInsetsGeometry padding;
  final VoidCallback? onTap;
  final BorderRadius radius;
  final EdgeInsetsGeometry? margin;

  @override
  Widget build(BuildContext context) {
    final card = Container(
      margin: margin,
      decoration: BoxDecoration(
        color: KandiColors.surface,
        borderRadius: radius,
        boxShadow: KandiShadow.card,
      ),
      child: Padding(padding: padding, child: child),
    );

    if (onTap == null) return card;

    // `Material` + `InkWell` rather than `GestureDetector`: a tap in a
    // shopping app should show that it landed, and a card that responds to
    // nothing feels broken long before anybody can say why.
    return Material(
      color: Colors.transparent,
      child: InkWell(onTap: onTap, borderRadius: radius, child: card),
    );
  }
}

/// The heading above a section, with an optional "See all".
///
/// One component so the sections cannot drift apart. The screens being
/// replaced had five heading treatments between them; a shared one is the only
/// thing that keeps a long scroll reading as one app.
class KandiSectionHeader extends StatelessWidget {
  const KandiSectionHeader({
    super.key,
    required this.title,
    this.subtitle,
    this.actionLabel,
    this.onAction,
    this.padding = const EdgeInsets.fromLTRB(
      KandiSpace.gutter,
      KandiSpace.lg,
      KandiSpace.gutter,
      KandiSpace.md,
    ),
  });

  final String title;
  final String? subtitle;
  final String? actionLabel;
  final VoidCallback? onAction;
  final EdgeInsetsGeometry padding;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: padding,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: KandiType.heading()),
                if (subtitle != null) ...[
                  const SizedBox(height: 2),
                  Text(subtitle!, style: KandiType.caption()),
                ],
              ],
            ),
          ),
          if (onAction != null)
            GestureDetector(
              onTap: onAction,
              behavior: HitTestBehavior.opaque,
              child: Padding(
                // A bare text link is a 16px-tall tap target. This padding is
                // the hit area, not decoration.
                padding: const EdgeInsets.symmetric(
                  horizontal: KandiSpace.xs,
                  vertical: KandiSpace.sm,
                ),
                child: Row(
                  children: [
                    Text(
                      actionLabel ?? 'See all',
                      // `primaryInk`, not `primary`: this is 13px text and
                      // #FF6A00 does not pass AA at that size. See the token.
                      style: KandiType.label(color: KandiColors.primaryInk)
                          .copyWith(fontWeight: FontWeight.w600),
                    ),
                    const SizedBox(width: 2),
                    const Icon(
                      Icons.chevron_right_rounded,
                      size: 18,
                      color: KandiColors.primaryInk,
                    ),
                  ],
                ),
              ),
            ),
        ],
      ),
    );
  }
}

/// A small badge — "New", "-35%", "Free delivery".
class KandiChip extends StatelessWidget {
  const KandiChip({
    super.key,
    required this.label,
    this.background = KandiColors.hairline,
    this.foreground = KandiColors.body,
    this.icon,
  });

  final String label;
  final Color background;
  final Color foreground;
  final IconData? icon;

  /// The deal badge. Ink on yellow, never white on yellow — see
  /// `KandiColors.deal`.
  factory KandiChip.deal(String label) => KandiChip(
        label: label,
        background: KandiColors.deal,
        foreground: KandiColors.ink,
      );

  factory KandiChip.fresh(String label) => KandiChip(
        label: label,
        background: KandiColors.successSoft,
        foreground: KandiColors.success,
      );

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
      decoration: BoxDecoration(color: background, borderRadius: KandiRadius.sm),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[
            Icon(icon, size: 11, color: foreground),
            const SizedBox(width: 3),
          ],
          Text(
            label,
            style: KandiType.micro(color: foreground, weight: FontWeight.w700),
          ),
        ],
      ),
    );
  }
}

enum KandiButtonTone { primary, outline }

/// The primary action on a screen.
class KandiButton extends StatelessWidget {
  const KandiButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.busy = false,
    this.icon,
    this.expand = true,
    this.tone = KandiButtonTone.primary,
  });

  final String label;
  final VoidCallback? onPressed;
  final bool busy;
  final IconData? icon;
  final bool expand;
  final KandiButtonTone tone;

  @override
  Widget build(BuildContext context) {
    final filled = tone == KandiButtonTone.primary;
    final disabled = onPressed == null || busy;
    final foreground = filled ? Colors.white : KandiColors.primaryInk;

    final child = busy
        ? const SizedBox(
            width: 20,
            height: 20,
            child:
                CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
          )
        : Row(
            mainAxisSize: expand ? MainAxisSize.max : MainAxisSize.min,
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              if (icon != null) ...[
                Icon(icon, size: 18, color: foreground),
                const SizedBox(width: KandiSpace.sm),
              ],
              Text(
                label,
                style: KandiType.title(color: foreground)
                    .copyWith(fontWeight: FontWeight.w700),
              ),
            ],
          );

    return SizedBox(
      width: expand ? double.infinity : null,
      height: 50,
      child: Material(
        color: filled
            ? (disabled
                ? const Color(0x73FF6A00) // primary at 45%
                : KandiColors.primary)
            : Colors.transparent,
        borderRadius: KandiRadius.md,
        child: InkWell(
          onTap: disabled ? null : onPressed,
          borderRadius: KandiRadius.md,
          child: Container(
            decoration: BoxDecoration(
              borderRadius: KandiRadius.md,
              border: filled
                  ? null
                  : Border.all(color: KandiColors.primary, width: 1.4),
            ),
            alignment: Alignment.center,
            padding:
                EdgeInsets.symmetric(horizontal: expand ? 0 : KandiSpace.xl),
            child: child,
          ),
        ),
      ),
    );
  }
}

/// The shimmer placeholder a screen shows while its first fetch is in flight.
///
/// ---- Why a skeleton and not a spinner ----
///
/// A spinner says "something is happening". A skeleton says "something is
/// happening HERE, and it will be this shape" — measurably less annoying on a
/// slow connection, because the layout does not jump when the content lands.
/// The boxes were already the right size.
///
/// With `KandiCache` in front of every read this is only seen on a genuinely
/// cold screen, which is exactly when a shopper most needs telling that the
/// app is working.
class KandiSkeleton extends StatefulWidget {
  const KandiSkeleton({
    super.key,
    required this.width,
    required this.height,
    this.radius = KandiRadius.md,
  });

  final double width;
  final double height;
  final BorderRadius radius;

  @override
  State<KandiSkeleton> createState() => _KandiSkeletonState();
}

class _KandiSkeletonState extends State<KandiSkeleton>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1100),
  )..repeat();

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _controller,
      builder: (context, _) {
        // A sweep rather than a pulse. A pulsing block reads as a warning; a
        // sweep reads as loading, which is the convention every shopper has
        // already learned from other apps.
        final t = _controller.value;
        return Container(
          width: widget.width,
          height: widget.height,
          decoration: BoxDecoration(
            borderRadius: widget.radius,
            gradient: LinearGradient(
              begin: Alignment(-1 - t * 2, 0),
              end: Alignment(1 - t * 2, 0),
              colors: const [
                KandiColors.hairline,
                Color(0xFFE8EAED),
                KandiColors.hairline,
              ],
            ),
          ),
        );
      },
    );
  }
}

/// What a screen shows when it has nothing to show.
///
/// An icon, a sentence and — the part that matters — a way out. An empty state
/// with no action is a dead end, and a dead end in a shop is a shopper who
/// closes the app.
class KandiEmpty extends StatelessWidget {
  const KandiEmpty({
    super.key,
    required this.icon,
    required this.title,
    this.message,
    this.actionLabel,
    this.onAction,
  });

  final IconData icon;
  final String title;
  final String? message;
  final String? actionLabel;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(KandiSpace.xxl),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 64,
              height: 64,
              decoration: const BoxDecoration(
                color: KandiColors.primarySoft,
                shape: BoxShape.circle,
              ),
              child: Icon(icon, size: 28, color: KandiColors.primary),
            ),
            const SizedBox(height: KandiSpace.lg),
            Text(title, style: KandiType.heading(), textAlign: TextAlign.center),
            if (message != null) ...[
              const SizedBox(height: KandiSpace.sm),
              Text(
                message!,
                style: KandiType.bodyText(),
                textAlign: TextAlign.center,
              ),
            ],
            if (onAction != null) ...[
              const SizedBox(height: KandiSpace.xl),
              KandiButton(
                label: actionLabel ?? 'Start shopping',
                onPressed: onAction,
                expand: false,
              ),
            ],
          ],
        ),
      ),
    );
  }
}

/// The app bar every screen wears.
PreferredSizeWidget kandiAppBar(
  BuildContext context,
  String title, {
  List<Widget>? actions,
  bool showBack = true,
  VoidCallback? onBack,
}) {
  return AppBar(
    backgroundColor: KandiColors.surface,
    surfaceTintColor: KandiColors.surface,
    elevation: 0,
    scrolledUnderElevation: 0,
    centerTitle: false,
    leading: showBack
        ? IconButton(
            onPressed: onBack ?? () => Navigator.of(context).maybePop(),
            icon: const Icon(Icons.arrow_back_rounded,
                color: KandiColors.ink, size: 22),
          )
        : null,
    title: Text(title, style: KandiType.title().copyWith(fontSize: 16)),
    actions: actions,
    bottom: const PreferredSize(
      preferredSize: Size.fromHeight(1),
      child: Divider(height: 1, thickness: 1, color: KandiColors.line),
    ),
  );
}

/// A short message at the foot of the screen.
///
/// Wrapped so every screen reports success and failure the same way, and so
/// the colour decision is made once rather than at forty call sites.
void kandiToast(BuildContext context, String message, {bool error = false}) {
  ScaffoldMessenger.of(context)
    ..clearSnackBars()
    ..showSnackBar(
      SnackBar(
        content: Text(message, style: KandiType.label(color: Colors.white)),
        backgroundColor: error ? KandiColors.sale : KandiColors.band,
        behavior: SnackBarBehavior.floating,
        shape: const RoundedRectangleBorder(borderRadius: KandiRadius.md),
        margin: const EdgeInsets.all(KandiSpace.lg),
        duration: const Duration(seconds: 3),
      ),
    );
}

// ============================================================
//  THE FLUTTERFLOW ENTRY POINT
// ============================================================

/// A visible check that the design system is in the project.
///
/// FlutterFlow requires every custom-code file to export a widget, and this
/// file is otherwise tokens and helpers. Rather than a `SizedBox.shrink()`
/// that proves nothing, this renders the palette and the type scale — so
/// dropping it on a blank page answers "did the paste work, and is the app
/// seeing the values I think it is" in one glance.
///
/// Not meant to ship on a shopper-facing screen.
class KandiDesign extends StatelessWidget {
  const KandiDesign({super.key, this.width, this.height});

  final double? width;
  final double? height;

  @override
  Widget build(BuildContext context) {
    const swatches = <String, Color>{
      'primary': KandiColors.primary,
      'primaryInk': KandiColors.primaryInk,
      'ink': KandiColors.ink,
      'body': KandiColors.body,
      'muted': KandiColors.muted,
      'line': KandiColors.line,
      'page': KandiColors.page,
      'deal': KandiColors.deal,
      'success': KandiColors.success,
      'sale': KandiColors.sale,
    };

    return Container(
      width: width,
      height: height,
      color: KandiColors.page,
      padding: const EdgeInsets.all(KandiSpace.lg),
      child: ListView(
        children: [
          Text('Kandi design system', style: KandiType.display()),
          const SizedBox(height: KandiSpace.lg),
          KandiCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Colour', style: KandiType.heading()),
                const SizedBox(height: KandiSpace.md),
                Wrap(
                  spacing: KandiSpace.sm,
                  runSpacing: KandiSpace.sm,
                  children: swatches.entries
                      .map(
                        (entry) => Column(
                          children: [
                            Container(
                              width: 52,
                              height: 36,
                              decoration: BoxDecoration(
                                color: entry.value,
                                borderRadius: KandiRadius.sm,
                                border: Border.all(color: KandiColors.line),
                              ),
                            ),
                            const SizedBox(height: 4),
                            SizedBox(
                              width: 56,
                              child: Text(
                                entry.key,
                                style: KandiType.micro(),
                                textAlign: TextAlign.center,
                              ),
                            ),
                          ],
                        ),
                      )
                      .toList(),
                ),
              ],
            ),
          ),
          const SizedBox(height: KandiSpace.md),
          KandiCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Type', style: KandiType.heading()),
                const SizedBox(height: KandiSpace.md),
                Text('Display 26', style: KandiType.display()),
                Text('Heading 17', style: KandiType.heading()),
                Text('Title 15', style: KandiType.title()),
                Text('Body 14', style: KandiType.bodyText()),
                Text('Label 13', style: KandiType.label()),
                Text('Caption 12', style: KandiType.caption()),
                Text('MICRO 11', style: KandiType.micro()),
                const SizedBox(height: KandiSpace.sm),
                Text(kandiPrice(145000), style: KandiType.price(size: 20)),
              ],
            ),
          ),
          const SizedBox(height: KandiSpace.md),
          Row(
            children: [
              KandiChip.deal('-35%'),
              const SizedBox(width: KandiSpace.sm),
              KandiChip.fresh('New'),
              const SizedBox(width: KandiSpace.sm),
              const KandiChip(label: 'Free delivery'),
            ],
          ),
          const SizedBox(height: KandiSpace.md),
          KandiButton(label: 'Primary action', onPressed: () {}),
          const SizedBox(height: KandiSpace.sm),
          KandiButton(
            label: 'Outline action',
            onPressed: () {},
            tone: KandiButtonTone.outline,
          ),
          const SizedBox(height: KandiSpace.md),
          const Row(
            children: [
              KandiSkeleton(width: 90, height: 90),
              SizedBox(width: KandiSpace.sm),
              KandiSkeleton(width: 90, height: 90),
            ],
          ),
        ],
      ),
    );
  }
}

// ============================================================
//  THE PRODUCT, AND THE TILE THAT DRAWS IT
// ============================================================

/// One product, exactly as `/api/app/*` sends it.
///
/// ---- Why the app does not compute anything here ----
///
/// Every money figure arrives pre-formatted: `priceLabel`, `wasPriceLabel`,
/// `savingLabel`, `discountPercent`. That is deliberate on the server's side
/// (see `lib/app-api.ts`) and the app should not undo it.
///
/// A price is not one number, it is a set of related ones — what you pay, what
/// it was, what you save, what percentage that is — and any second
/// implementation of that arithmetic eventually disagrees with the first. A
/// shopper who sees "Save UGX 5,000" on the web and "Save UGX 4,999" in the app
/// has found a bug in the shop, not a rounding difference.
///
/// So `kandiPrice` exists for figures the app computes ITSELF — a cart total, a
/// payout — and never for a product's own price.
class KandiProduct {
  const KandiProduct({
    required this.id,
    required this.name,
    required this.image,
    required this.priceLabel,
    this.slug = '',
    this.url = '',
    this.gallery = const [],
    this.price = 0,
    this.wasPriceLabel,
    this.savingLabel,
    this.discountPercent = 0,
    this.inStock = true,
    this.stockQuantity,
    this.rating = 0,
    this.ratingCount = 0,
    this.totalSales = 0,
    this.categoryName,
    this.sellerName,
    this.isNew = false,
    this.hasOptions = false,
  });

  final int id;
  final String name;
  final String slug;
  final String url;
  final String image;
  final List<String> gallery;
  final num price;
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
  final bool isNew;

  /// Whether buying this needs a size or a colour chosen first.
  ///
  /// The tile's cart button uses it to choose between adding straight to the
  /// basket and opening the product page. Adding a variable product without a
  /// variation is how an order arrives with no size on it.
  final bool hasOptions;

  static KandiProduct? fromJson(dynamic raw) {
    if (raw is! Map) return null;
    final id = _int(raw['id']);
    if (id == 0) return null;

    return KandiProduct(
      id: id,
      name: (raw['name'] ?? '').toString(),
      slug: (raw['slug'] ?? '').toString(),
      url: (raw['url'] ?? '').toString(),
      image: (raw['image'] ?? '').toString(),
      gallery: raw['gallery'] is List
          ? (raw['gallery'] as List).map((e) => e.toString()).toList()
          : const [],
      price: _num(raw['price']),
      // Falls back to formatting the raw number, so a tile still shows a price
      // if an older endpoint ever answers without the label.
      priceLabel: (raw['priceLabel']?.toString() ?? '').isNotEmpty
          ? raw['priceLabel'].toString()
          : kandiPrice(_num(raw['price'])),
      wasPriceLabel: _text(raw['wasPriceLabel']),
      savingLabel: _text(raw['savingLabel']),
      discountPercent: _int(raw['discountPercent']),
      inStock: raw['inStock'] != false,
      stockQuantity:
          raw['stockQuantity'] == null ? null : _int(raw['stockQuantity']),
      rating: _num(raw['rating']).toDouble(),
      ratingCount: _int(raw['ratingCount']),
      totalSales: _int(raw['totalSales']),
      categoryName: _text(raw['categoryName']),
      sellerName: _text(raw['sellerName']),
      isNew: raw['isNew'] == true,
      hasOptions: raw['hasOptions'] == true,
    );
  }

  /// A whole list, with anything unparseable dropped rather than throwing. One
  /// malformed product should cost one tile, not the grid.
  static List<KandiProduct> listFrom(dynamic raw) {
    if (raw is! List) return const [];
    return raw
        .map(KandiProduct.fromJson)
        .whereType<KandiProduct>()
        .toList(growable: false);
  }

  static int _int(dynamic v) =>
      v is int ? v : (v is num ? v.toInt() : int.tryParse('$v') ?? 0);

  static num _num(dynamic v) => v is num ? v : (num.tryParse('$v') ?? 0);

  static String? _text(dynamic v) {
    final s = v?.toString().trim() ?? '';
    return s.isEmpty ? null : s;
  }
}

/// The product tile every grid and rail in the app draws.
///
/// ---- What is on it, and what deliberately is not ----
///
/// Photograph, up to two lines of name, price, and at most one badge. That is
/// the whole tile.
///
/// The screens this replaces put a rating row, a sold count, a colour swatch
/// strip, a stock bar AND a seller name on the same card. The result is that
/// none of them is read: a tile is scanned in well under a second, and six
/// competing facts in that second average out to nothing. The two that survive
/// are the two a shopper actually decides on — what it looks like and what it
/// costs.
class KandiProductTile extends StatelessWidget {
  const KandiProductTile({
    super.key,
    required this.product,
    required this.width,
    this.onTap,
    this.onAdd,
  });

  final KandiProduct product;

  /// The tile's width, which is also the photograph's decode width. Passed in
  /// rather than measured: a `LayoutBuilder` per tile in a scrolling grid is a
  /// layout pass per tile per frame.
  final double width;

  final VoidCallback? onTap;

  /// Tapping the cart button. Null hides it — a wishlist row, say, where the
  /// action belongs to the row rather than the tile.
  final void Function(KandiProduct product)? onAdd;

  @override
  Widget build(BuildContext context) {
    final soldOut = !product.inStock;

    return Material(
      color: KandiColors.surface,
      borderRadius: KandiRadius.md,
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: SizedBox(
          width: width,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              _photograph(soldOut),
              Padding(
                padding: const EdgeInsets.fromLTRB(
                  KandiSpace.sm,
                  KandiSpace.sm,
                  KandiSpace.sm,
                  KandiSpace.md,
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      product.name,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: KandiType.label(),
                    ),
                    const SizedBox(height: KandiSpace.xs),
                    _money(),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _photograph(bool soldOut) {
    return Stack(
      children: [
        // Square, and the same ratio everywhere in the app. A grid whose tiles
        // share one ratio can be laid out without measuring any of them, which
        // is what keeps a long scroll smooth.
        KandiImage(
          url: product.image,
          width: width,
          height: width,
          radius: BorderRadius.zero,
        ),

        // At most one badge, and the order is the order of usefulness: a
        // discount is a reason to buy now, "New" is a reason to look. Two
        // badges in one corner is two things to read where the tile has budget
        // for neither.
        if (product.discountPercent > 0)
          Positioned(
            top: KandiSpace.sm,
            left: KandiSpace.sm,
            child: KandiChip.deal('-${product.discountPercent}%'),
          )
        else if (product.isNew)
          Positioned(
            top: KandiSpace.sm,
            left: KandiSpace.sm,
            child: KandiChip.fresh('New'),
          ),

        if (soldOut)
          Positioned.fill(
            child: Container(
              color: const Color(0xB3FFFFFF),
              alignment: Alignment.center,
              child: Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: KandiSpace.md,
                  vertical: KandiSpace.xs,
                ),
                decoration: const BoxDecoration(
                  color: KandiColors.band,
                  borderRadius: KandiRadius.pill,
                ),
                child: Text(
                  'Sold out',
                  style: KandiType.micro(
                    color: Colors.white,
                    weight: FontWeight.w700,
                  ),
                ),
              ),
            ),
          ),

        // Bottom right, over the photograph, which is where every marketplace
        // app puts it: the thumb is already there and it costs the text block
        // no height.
        if (onAdd != null && !soldOut)
          Positioned(
            bottom: KandiSpace.sm,
            right: KandiSpace.sm,
            child: _addButton(),
          ),
      ],
    );
  }

  Widget _addButton() {
    return Material(
      color: KandiColors.surface,
      shape: const CircleBorder(),
      elevation: 1.5,
      shadowColor: const Color(0x33111827),
      child: InkWell(
        onTap: () => onAdd!(product),
        customBorder: const CircleBorder(),
        child: SizedBox(
          width: 34,
          height: 34,
          child: Icon(
            // A product with a size to choose cannot be added from a grid, so
            // the icon says so: sliders mean "there is a step", a cart means
            // "this goes straight in". Drawing a cart on both is what teaches a
            // shopper that the button lies.
            product.hasOptions
                ? Icons.tune_rounded
                : Icons.add_shopping_cart_rounded,
            size: 17,
            color: KandiColors.ink,
          ),
        ),
      ),
    );
  }

  Widget _money() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.baseline,
          textBaseline: TextBaseline.alphabetic,
          children: [
            Flexible(
              child: Text(
                product.priceLabel,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: KandiType.price(size: 15),
              ),
            ),
            if (product.wasPriceLabel != null) ...[
              const SizedBox(width: KandiSpace.xs),
              Flexible(
                child: Text(
                  product.wasPriceLabel!,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: KandiType.wasPrice(),
                ),
              ),
            ],
          ],
        ),
        // The saving in money, under the price. "-17%" is arithmetic the
        // shopper has to do; "Save UGX 5,000" is the answer, and it is the
        // figure the website prints for the same reason.
        if (product.savingLabel != null) ...[
          const SizedBox(height: 2),
          Text(
            'Save ${product.savingLabel!}',
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: KandiType.micro(
              color: KandiColors.primaryInk,
              weight: FontWeight.w700,
            ),
          ),
        ],
      ],
    );
  }
}

/// A horizontal rail of products.
///
/// `ListView.builder`, always. Several of the screens this replaces used a
/// plain `ListView(children: [...])`, which builds every child before the first
/// frame — a twenty-product rail is twenty tiles and twenty image decodes for
/// the two-and-a-bit a phone can actually show.
class KandiProductRail extends StatelessWidget {
  const KandiProductRail({
    super.key,
    required this.products,
    this.onTap,
    this.onAdd,
    this.tileWidth = 150,
  });

  final List<KandiProduct> products;
  final void Function(KandiProduct product)? onTap;
  final void Function(KandiProduct product)? onAdd;
  final double tileWidth;

  @override
  Widget build(BuildContext context) {
    if (products.isEmpty) return const SizedBox.shrink();

    return SizedBox(
      // Tile plus its text block. Fixed rather than measured so the rail has an
      // intrinsic height and needs no layout pass to find one.
      height: tileWidth + 96,
      child: ListView.builder(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: KandiSpace.gutter),
        itemCount: products.length,
        // The tiles are a known, uniform width, so the list can jump straight
        // to any offset instead of measuring its way there. It is what makes a
        // long rail fling smoothly.
        itemExtent: tileWidth + KandiSpace.sm,
        itemBuilder: (context, index) {
          final product = products[index];
          return Padding(
            padding: const EdgeInsets.only(right: KandiSpace.sm),
            child: KandiProductTile(
              product: product,
              width: tileWidth,
              onTap: onTap == null ? null : () => onTap!(product),
              onAdd: onAdd,
            ),
          );
        },
      ),
    );
  }
}

/// The skeleton a rail shows before its products arrive.
class KandiRailSkeleton extends StatelessWidget {
  const KandiRailSkeleton({super.key, this.tileWidth = 150});

  final double tileWidth;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: tileWidth + 96,
      child: ListView.builder(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: KandiSpace.gutter),
        // Four is what fits a phone plus the sliver of a fifth. More would be
        // animation controllers nobody can see.
        itemCount: 4,
        itemBuilder: (context, _) => Padding(
          padding: const EdgeInsets.only(right: KandiSpace.sm),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              KandiSkeleton(width: tileWidth, height: tileWidth),
              const SizedBox(height: KandiSpace.sm),
              KandiSkeleton(width: tileWidth * 0.85, height: 12),
              const SizedBox(height: KandiSpace.xs),
              KandiSkeleton(width: tileWidth * 0.5, height: 14),
            ],
          ),
        ),
      ),
    );
  }
}
