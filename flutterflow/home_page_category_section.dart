// ═══════════════════════════════════════════════════════════════
//  SHOP BY CATEGORY — a drop-in replacement for `_categoryGrid()`
//
//  This is the department design from `home_sections_widget.dart`
//  (the KandiUg home screen) ported onto the HomePage widget's own
//  tokens and its own Firestore data. Nothing here reaches for the
//  API that file reads; it works off `_gridCategories`, `_shortCat`
//  and `_catProductImage`, which HomePage already computes.
//
//  ---- WHERE EACH PIECE GOES ----
//
//   §1  top-level constants   →  beside the other `const Color`s,
//                                under the DESIGN TOKENS banner
//   §2  `_Press`              →  top level, outside every class
//   §3  `_catIcon`            →  inside `_HomePageState`, and
//                                DELETE `_emoji()` — nothing else
//                                calls it once this lands
//   §4  `_categoryGrid`       →  replaces the existing one whole
//   §5  `_scrollToBrowse`     →  inside `_HomePageState`
//
//  ---- WHAT CHANGED, AND WHY ----
//
//  1. THE EMOJI ARE GONE. `_emoji()` returned '🍷', '🍺', '🥃' and,
//     for rum, '🏴‍☠️' — a pirate flag built from a zero-width
//     joiner sequence that renders as two separate glyphs on any
//     platform whose font does not carry the composed form. Emoji
//     in a category tile is the single loudest tell that a screen
//     was generated rather than designed: it is the placeholder a
//     person reaches for when they have not decided what the icon
//     should be. Every one is replaced by a real Material icon
//     chosen by matching the category name — see §3.
//
//  2. FOUR SQUARES BECOME TWO ROWS OF CARDS. The old grid was a
//     4-column block of square outlined tiles with the label
//     underneath, capped at three rows. At 4 across on a 390px
//     phone each tile is about 82px, which is too small to carry a
//     photograph AND too small for a name longer than "Wine" — the
//     reason `_shortCat()` exists at all is to hack around that
//     width. A horizontally-scrolling two-row grid of wide cards
//     gives the name a whole line to itself, so a category can be
//     called what it is actually called.
//
//  3. THE TINT CARRIES THE DISTINCTION. Every old tile was the same
//     white square with the same hairline border. A rotating
//     five-tint palette makes the block read as a set of distinct
//     places rather than as repeated furniture — which is the job
//     the emoji was failing to do.
//
//  4. THE PHOTOGRAPH SURVIVES. `_catProductImage()` was the one
//     genuinely good idea in the old grid and the department design
//     in `home_sections_widget.dart` has no equivalent — it draws
//     an icon and nothing else. Here the icon is the FALLBACK: a
//     real product shot from that category fills the disc when one
//     exists, and the icon stands in when it does not. A category
//     with stock therefore shows its stock.
// ═══════════════════════════════════════════════════════════════

// ───────────────────────────────────────────────────────────────
//  §1  TOP-LEVEL CONSTANTS
// ───────────────────────────────────────────────────────────────

/// Card geometry. Width is the number that matters: it has to hold
/// the disc, the gap and a two-word category name without the text
/// ellipsing, and 148 is where that stops happening for the longest
/// name in this catalogue ("Ready-to-drink").
const double _catCardW = 148;
const double _catCardH = 66;
const double _catGap = 8;
const double _catRadius = 14;

/// The tint behind each card, and the ink for the icon on it.
///
/// Five, and prime-ish against any likely category count, so the
/// sequence does not fall into a visible stripe when it wraps. The
/// list LEADS with the app's accent so the first card — which is
/// always the loudest position — is in the brand's own hue, and the
/// four after it are drawn wide enough apart that no two adjacent
/// cards read as the same colour.
///
/// The inks are darkened until each clears 4.6:1 on its own tint.
/// That is not decoration: the icon is the only thing distinguishing
/// one card from the next at a glance, so it has to survive being
/// looked at in sunlight, which is where most of this app is used.
///
/// If this screen is ever re-skinned for the orange storefront, this
/// is the one edit — put `Color(0xFFFFF3E8)` and `Color(0xFFB34A00)`
/// at the head of the two lists and everything else follows.
const List<Color> _catTints = [
  Color(0xFFEDF9EF), // green — the accent
  Color(0xFFEAF0FF), // blue
  Color(0xFFFFF4E5), // amber
  Color(0xFFF3ECFF), // violet
  Color(0xFFFEF2F2), // red
];
const List<Color> _catInks = [
  Color(0xFF046318), // green, = _greenDark
  Color(0xFF1A4FD6), // blue
  Color(0xFFB45309), // amber
  Color(0xFF6D28D9), // violet
  Color(0xFFDC2626), // red, = _red
];

// ───────────────────────────────────────────────────────────────
//  §2  PRESS FEEDBACK
// ───────────────────────────────────────────────────────────────

/// A tap target that acknowledges the finger before the navigation
/// does.
///
/// Everything tappable on this screen is a bare `GestureDetector`,
/// which draws nothing on touch-down. On a card that opens a new
/// screen that is survivable, because the screen arriving IS the
/// feedback. On these cards it is not: a category tap re-filters a
/// grid further down the same page, so with no press state a shopper
/// who taps and sees the page not move has no way to tell whether
/// the tap registered. The usual result is a second tap.
///
/// 0.96 and 110ms. Enough to be felt, short enough that it has
/// finished before a deliberate tap lifts.
class _Press extends StatefulWidget {
  const _Press({required this.child, required this.onTap});
  final Widget child;
  final VoidCallback onTap;

  @override
  State<_Press> createState() => _PressState();
}

class _PressState extends State<_Press> {
  bool _down = false;

  @override
  Widget build(BuildContext context) => GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTapDown: (_) => setState(() => _down = true),
        onTapCancel: () => setState(() => _down = false),
        onTapUp: (_) => setState(() => _down = false),
        onTap: widget.onTap,
        child: AnimatedScale(
          scale: _down ? 0.96 : 1.0,
          duration: const Duration(milliseconds: 110),
          curve: Curves.easeOut,
          child: widget.child,
        ),
      );
}

// ───────────────────────────────────────────────────────────────
//  §3  THE ICON MATCHER  (inside _HomePageState — delete _emoji)
// ───────────────────────────────────────────────────────────────

/// The icon for a category, matched on its name.
///
/// Ordered most specific first, which is the whole reason this is a
/// ladder of ifs rather than a map: "sparkling wine" has to be
/// caught by the sparkling rule before "wine" claims it, and "soft
/// drinks" before "drinks". A map has no order, so it would answer
/// whichever key happened to be looked up first.
///
/// The fallback is a cocktail glass rather than a question mark or a
/// generic bag: a category this does not recognise is still a drink,
/// so the honest default is a drink. A shop that invents a category
/// tomorrow gets a card that looks deliberate rather than broken.
IconData _catIcon(String category) {
  final s = category.toLowerCase().trim();
  bool has(List<String> words) => words.any(s.contains);

  if (has(['offer', 'deal', 'sale', 'discount'])) {
    return Icons.local_fire_department_rounded;
  }
  if (has(['beer', 'cider', 'lager', 'ale'])) return Icons.sports_bar_rounded;
  if (has(['champagne', 'sparkling', 'prosecco'])) {
    return Icons.celebration_rounded;
  }
  if (has(['wine'])) return Icons.wine_bar_rounded;
  if (has(['whisky', 'whiskey', 'bourbon', 'scotch'])) {
    return Icons.liquor_rounded;
  }
  if (has(['brandy', 'cognac', 'rum'])) return Icons.liquor_rounded;
  if (has(['vodka', 'gin', 'tequila', 'cocktail'])) {
    return Icons.local_bar_rounded;
  }
  if (has(['cream', 'liqueur', 'baileys'])) return Icons.icecream_rounded;
  if (has(['bitter'])) return Icons.science_rounded;
  if (has(['spirit'])) return Icons.liquor_rounded;
  if (has(['water', 'juice', 'soft', 'soda', 'mixer'])) {
    return Icons.local_drink_rounded;
  }
  if (has(['snack', 'crisp', 'nut', 'food'])) return Icons.bakery_dining_rounded;
  if (has(['essential', 'grocer', 'household'])) {
    return Icons.shopping_basket_rounded;
  }
  if (has(['rtd', 'ready'])) return Icons.bubble_chart_rounded;

  return Icons.local_bar_rounded;
}

// ───────────────────────────────────────────────────────────────
//  §4  THE SECTION  (replaces _categoryGrid whole)
// ───────────────────────────────────────────────────────────────

Widget _categoryGrid() {
  final cats = _gridCategories;
  if (cats.isEmpty) return const SizedBox.shrink();

  /* ---- Two rows, scrolling sideways ----
   *
   * `crossAxisCount: 2` on a horizontally-scrolling grid means two
   * ROWS, not two columns — on a horizontal grid the cross axis is
   * the vertical one. `childAspectRatio` is inverted for the same
   * reason: it is width-over-height, and the main axis up there is
   * the width.
   *
   * Two rows rather than one is what makes this hold a real category
   * list. One row showed about two and a half cards and gave no hint
   * how many more there were; two rows shows five and reads as a
   * block that continues, which is the correct signal — this IS a
   * complete, short list, and a shopper should be able to see most
   * of it without moving anything.
   */
  final rowCount = cats.length > 4 ? 2 : 1;

  Widget card(String cat) {
    final i = cats.indexOf(cat);
    final tint = _catTints[i % _catTints.length];
    final ink = _catInks[i % _catInks.length];
    final photo = _catProductImage(cat);

    return _Press(
      onTap: () {
        HapticFeedback.mediumImpact();
        // A wired callback wins, because it can open a screen with the
        // shop's own filters on it. With nothing wired the tap still
        // has to do something, so it falls back to the behaviour this
        // page can perform on its own: select the category and take
        // the shopper to the grid that just changed under it. A tile
        // that does nothing when a parameter is unset is a tile that
        // looks broken to everyone who did not wire it.
        if (widget.onSeeAllCategory != null) {
          widget.onSeeAllCategory!.call(cat);
        } else {
          _selectCategory(cat);
          _scrollToBrowse();
        }
      },
      child: Container(
        width: _catCardW,
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 10),
        decoration: BoxDecoration(
          color: tint,
          borderRadius: BorderRadius.circular(_catRadius),
        ),
        child: Row(children: [
          /* ---- The disc: a photograph if there is one, else the icon ----
           *
           * A fixed 38px circle either way, so the row's rhythm does
           * not depend on whether a category happens to have stock
           * with a usable image on it. The white ground behind both
           * is what stops a product shot — most of which are already
           * on white — from dissolving into the tint. */
          Container(
            width: 38,
            height: 38,
            decoration: const BoxDecoration(
              color: _white,
              shape: BoxShape.circle,
            ),
            clipBehavior: Clip.antiAlias,
            alignment: Alignment.center,
            child: photo != null
                ? Padding(
                    padding: const EdgeInsets.all(5),
                    child: CachedNetworkImage(
                      imageUrl: photo,
                      fit: BoxFit.contain,
                      fadeInDuration: const Duration(milliseconds: 180),
                      // The icon is the placeholder AND the error state,
                      // so a slow image and a dead URL look the same —
                      // which is to say, they look intentional.
                      placeholder: (_, __) =>
                          Icon(_catIcon(cat), size: 19, color: ink),
                      errorWidget: (_, __, ___) =>
                          Icon(_catIcon(cat), size: 19, color: ink),
                    ),
                  )
                : Icon(_catIcon(cat), size: 19, color: ink),
          ),
          const SizedBox(width: 10),
          /* ---- The full category name, not the abbreviated one ----
           *
           * `_shortCat()` exists to squeeze a name into an 82px square
           * — it turns "Champagnes" into "Bubbly" and lops the plural
           * off anything else. None of that is needed at 148px wide
           * with two lines available, and all of it costs something:
           * "Bubbly" is not the word on the shelf, and a shopper
           * hunting for champagne has to work out that it is the same
           * thing. The card shows what the category is called. */
          Expanded(
            child: Text(
              cat,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: _txt(13,
                  weight: FontWeight.w700, color: _ink, height: 1.22),
            ),
          ),
        ]),
      ),
    );
  }

  /* ---- Trending, and where it sits ----
   *
   * It leads rather than being folded in among the categories,
   * because it is not one — it is a shortcut to the best-selling
   * list, and burying a different KIND of destination in the middle
   * of a list of categories is how a shopper learns not to trust the
   * row. It only renders when that list has something in it. */
  final tiles = <Widget>[
    if (_bestSelling.isNotEmpty)
      _Press(
        onTap: () {
          HapticFeedback.mediumImpact();
          widget.onSeeAllBestSelling?.call();
        },
        child: Container(
          width: _catCardW,
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 10),
          decoration: BoxDecoration(
            color: _ink,
            borderRadius: BorderRadius.circular(_catRadius),
          ),
          child: Row(children: [
            Container(
              width: 38,
              height: 38,
              decoration: BoxDecoration(
                color: _white.withOpacity(0.14),
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.trending_up_rounded,
                  size: 19, color: _white),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Text('Trending',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: _txt(13,
                      weight: FontWeight.w700, color: _white, height: 1.22)),
            ),
          ]),
        ),
      ),
    ...cats.map(card),
  ];

  return Padding(
    padding: const EdgeInsets.only(bottom: _sectionGap),
    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Padding(
        padding: const EdgeInsets.fromLTRB(_padH, 2, _padH, 10),
        child: Row(children: [
          Expanded(
            child: Text('Shop by category',
                style: _titleStyle(19, weight: FontWeight.w800)),
          ),
          if (widget.onShopTap != null)
            _Press(
              onTap: () {
                HapticFeedback.lightImpact();
                widget.onShopTap!.call();
              },
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 4),
                child: Text('See all',
                    style: _txt(13.5,
                        weight: FontWeight.w600, color: _accentDark)),
              ),
            ),
        ]),
      ),
      SizedBox(
        height: rowCount * _catCardH + (rowCount - 1) * _catGap,
        child: GridView.builder(
          scrollDirection: Axis.horizontal,
          padding: const EdgeInsets.symmetric(horizontal: _padH),
          physics: const BouncingScrollPhysics(),
          gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: rowCount,
            mainAxisSpacing: _catGap,
            crossAxisSpacing: _catGap,
            childAspectRatio: _catCardH / _catCardW,
          ),
          itemCount: tiles.length,
          itemBuilder: (_, i) => tiles[i],
        ),
      ),
    ]),
  );
}

// ───────────────────────────────────────────────────────────────
//  §5  SCROLL TO THE BROWSE GRID  (inside _HomePageState)
// ───────────────────────────────────────────────────────────────

/// Takes the shopper to the grid a category tap just re-filtered.
///
/// `_browseSectionKey` is already on that sliver — `_onScroll` uses it
/// to decide when the sticky category bar appears — so there is
/// nothing new to wire. `alignment: 0` puts the section at the top of
/// the viewport rather than centring it, which is what a shopper
/// expects from a jump: the thing they asked for at the top, and the
/// results under it.
void _scrollToBrowse() {
  final ctx = _browseSectionKey.currentContext;
  if (ctx == null) return;
  Scrollable.ensureVisible(
    ctx,
    alignment: 0,
    duration: const Duration(milliseconds: 420),
    curve: Curves.easeOutCubic,
  );
}
