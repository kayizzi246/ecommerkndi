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
import '/custom_code/widgets/kandi_cart_store.dart';
import '/custom_code/widgets/kandi_auth_screen.dart';
import '/custom_code/widgets/kandi_account_screen.dart';
import '/custom_code/widgets/kandi_home_screen.dart';
import '/custom_code/widgets/kandi_browse_screen.dart';
import '/custom_code/widgets/kandi_cart_screen.dart';

// ============================================================
//  KANDI — THE SHELL
//
//  The four tabs, and the thing the app did not have.
//
//  WHAT WAS MISSING
//  -----------------------------------------------------------
//  Twelve screens and nothing holding them together. Every one
//  was a destination FlutterFlow had to route to by hand, so
//  moving between them meant a push onto the stack — and a
//  shopper who went home, then search, then cart, then back to
//  home had four copies of the home screen underneath them and
//  a back button that walked through all of it.
//
//  A tab shell fixes that by construction: the four places a
//  shopper actually lives are siblings, not a stack. Tapping
//  Home from anywhere in Home returns to its top rather than
//  pushing another one.
//
//  STATE IS KEPT, WHICH IS MOST OF WHY IT FEELS FAST
//  -----------------------------------------------------------
//  `IndexedStack` keeps every visited tab alive, so switching
//  back to Home does not rebuild it, refetch it or lose the
//  scroll position. Combined with `KandiCache`, the second visit
//  to any tab is free: the widgets are still there and the data
//  is still there.
//
//  The cost is memory — four screens instead of one — and it is
//  the right trade on a shopping app, where the whole loop is
//  browse, look, come back, browse. A `PageView` or a rebuild
//  per tap would throw away the scroll position every time,
//  which is the single most irritating thing a catalogue app
//  can do.
//
//  ---- Tabs are built lazily ----
//
//  An `IndexedStack` normally builds all its children up front,
//  which would mean four screens and four first fetches on
//  launch. Each tab here is wrapped so it renders nothing until
//  it has been visited once — so launch pays for Home alone, and
//  Search costs nothing until somebody taps it.
// ============================================================

/// Which tab is showing.
///
/// Four, and the list is deliberately short. Every marketplace app has
/// converged on roughly this set because they are the four things a shopper
/// does repeatedly; a fifth tab is a tab that makes the other four smaller.
enum KandiTab { home, browse, cart, account }

/// The whole app, on one FlutterFlow page.
///
/// ---- The four tabs are built here now ----
///
/// They used to be handed in, so that this screen owned the CHROME and nothing
/// about what was inside it. That was worth having while each tab needed five
/// or six callbacks: the shell would have had to know every one of them, which
/// is the coupling that makes a shell impossible to change.
///
/// The tabs need nothing now, so the argument has expired — `KandiHomeScreen()`
/// is a complete instruction. What is left is a page with one widget on it and
/// no parameters to declare, which is the whole point of the exercise.
///
/// ---- Width and height, and nothing else, on purpose ----
///
/// FlutterFlow parses THIS class's constructor when the file is saved and maps
/// every named parameter onto one of its own types. `int`, `String`, `bool` and
/// `double` map; a Dart enum does not, and the save fails with
/// `Unable to process parameter "…"` — which is a complaint about the type, not
/// about anything being missing.
///
/// This used to open on `initial: KandiTab.home` and nothing ever passed
/// anything else, because the shell is placed on a page rather than
/// constructed in code. Home is where a shop opens.
class KandiShell extends StatefulWidget {
  const KandiShell({super.key, this.width, this.height});

  final double? width;
  final double? height;

  @override
  State<KandiShell> createState() => _KandiShellState();
}

class _KandiShellState extends State<KandiShell> {
  KandiTab _tab = KandiTab.home;

  /// Which tabs have ever been shown.
  ///
  /// An `IndexedStack` builds every child immediately, so without this the app
  /// would run four screens' `initState` on launch and fire four first
  /// requests for three screens nobody has asked for. A tab enters this set
  /// the first time it is selected and never leaves — which is the point: it
  /// is lazy on the way in and sticky afterwards.
  final Set<KandiTab> _visited = {KandiTab.home};

  @override
  void initState() {
    super.initState();
    // The badge has to be right before the shopper looks at it, and the cart
    // tab may never be opened. Loading here rather than in the cart screen is
    // what makes the count correct on the first frame of the app.
    KandiCart.load();
    KandiAuth.load();
    KandiWishlist.load();

    // The one piece of navigation that cannot be a direct call.
    //
    // This file imports the four tab screens; a screen that imported the shell
    // back to select a tab would close the ring and leave the fifteen files
    // with no order to be pasted in. A function pointer crosses that boundary
    // where an import cannot — see `KandiNav.tabSelector`.
    KandiNav.tabSelector = _installed;
  }

  /// Held in a field so [dispose] can tell whether the pointer still ours.
  late final void Function(int index) _installed = (index) {
    if (!mounted) return;
    if (index < 0 || index >= KandiTab.values.length) return;
    _select(KandiTab.values[index]);
  };

  @override
  void dispose() {
    // Only if it is still ours. A second shell — the builder previewing this
    // page while the app runs — will have overwritten it, and clearing that
    // one would leave the live shell with a dead tab bar.
    if (KandiNav.tabSelector == _installed) KandiNav.tabSelector = null;
    super.dispose();
  }

  void _select(KandiTab tab) {
    if (tab == _tab) return;
    setState(() {
      _tab = tab;
      _visited.add(tab);
    });
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      width: widget.width,
      height: widget.height,
      color: KandiColors.page,
      child: Scaffold(
        backgroundColor: KandiColors.page,
        body: IndexedStack(
          index: KandiTab.values.indexOf(_tab),
          children: [
            _lazy(KandiTab.home, const KandiHomeScreen()),
            // No argument, which IS the search tab: the browse screen turns
            // "nothing to show yet" into "open with the keyboard up".
            _lazy(KandiTab.browse, const KandiBrowseScreen()),
            _lazy(KandiTab.cart, const KandiCartScreen()),
            _lazy(KandiTab.account, const KandiAccountScreen()),
          ],
        ),
        bottomNavigationBar: _bar(),
      ),
    );
  }

  /// A tab, or nothing until it has been visited.
  Widget _lazy(KandiTab tab, Widget child) =>
      _visited.contains(tab) ? child : const SizedBox.shrink();

  Widget _bar() {
    return Container(
      decoration: const BoxDecoration(
        color: KandiColors.surface,
        boxShadow: KandiShadow.raised,
      ),
      child: SafeArea(
        top: false,
        child: SizedBox(
          height: 58,
          child: Row(
            children: [
              _item(
                KandiTab.home,
                Icons.home_outlined,
                Icons.home_rounded,
                'Home',
              ),
              _item(
                KandiTab.browse,
                Icons.search_outlined,
                Icons.search_rounded,
                'Search',
              ),
              _cartItem(),
              _item(
                KandiTab.account,
                Icons.person_outline_rounded,
                Icons.person_rounded,
                'Account',
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _item(KandiTab tab, IconData icon, IconData active, String label) {
    final selected = _tab == tab;

    return Expanded(
      child: InkWell(
        onTap: () => _select(tab),
        // No splash on a bottom bar. The ripple runs past the item's own
        // bounds into its neighbours, which reads as the wrong tab responding.
        splashColor: Colors.transparent,
        highlightColor: Colors.transparent,
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              // A filled icon for the selected tab, an outlined one otherwise.
              // Colour alone is not enough: it is the only signal on the bar,
              // and roughly one man in twelve cannot rely on it.
              selected ? active : icon,
              size: 23,
              color: selected ? KandiColors.primary : KandiColors.muted,
            ),
            const SizedBox(height: 2),
            Text(
              label,
              style: KandiType.micro(
                color: selected ? KandiColors.primary : KandiColors.muted,
                weight: selected ? FontWeight.w700 : FontWeight.w500,
              ),
            ),
          ],
        ),
      ),
    );
  }

  /// The cart tab, with the live count on it.
  ///
  /// Its own builder rather than a parameter on `_item`, because it is the one
  /// tab that has to rebuild when something OTHER than the selection changes —
  /// adding from a product page four screens deep has to move this number.
  Widget _cartItem() {
    const tab = KandiTab.cart;
    final selected = _tab == tab;

    return Expanded(
      child: InkWell(
        onTap: () => _select(tab),
        splashColor: Colors.transparent,
        highlightColor: Colors.transparent,
        child: ValueListenableBuilder<int>(
          valueListenable: KandiCart.count,
          builder: (context, count, _) {
            return Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Stack(
                  clipBehavior: Clip.none,
                  children: [
                    Icon(
                      selected
                          ? Icons.shopping_bag_rounded
                          : Icons.shopping_bag_outlined,
                      size: 23,
                      color:
                          selected ? KandiColors.primary : KandiColors.muted,
                    ),
                    if (count > 0)
                      Positioned(
                        right: -7,
                        top: -5,
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 5),
                          constraints: const BoxConstraints(minWidth: 17),
                          height: 17,
                          decoration: BoxDecoration(
                            color: KandiColors.primary,
                            borderRadius: KandiRadius.pill,
                            border: Border.all(
                                color: KandiColors.surface, width: 1.5),
                          ),
                          alignment: Alignment.center,
                          child: Text(
                            count > 99 ? '99+' : '$count',
                            style: KandiType.micro(
                              color: Colors.white,
                              weight: FontWeight.w700,
                            ).copyWith(fontSize: 10),
                          ),
                        ),
                      ),
                  ],
                ),
                const SizedBox(height: 2),
                Text(
                  'Cart',
                  style: KandiType.micro(
                    color: selected ? KandiColors.primary : KandiColors.muted,
                    weight: selected ? FontWeight.w700 : FontWeight.w500,
                  ),
                ),
              ],
            );
          },
        ),
      ),
    );
  }
}
