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
import '/custom_code/widgets/kandi_product_screen.dart';

import 'dart:async';

import 'package:shared_preferences/shared_preferences.dart';

// ============================================================
//  KANDI — BROWSE
//
//  Search and category, which are one screen.
//
//  WHY THEY ARE ONE SCREEN AND NOT TWO
//  -----------------------------------------------------------
//  The app had `search_widget.dart` (1,653 lines) and
//  `category_navigation_menu.dart` (2,710) and they were the
//  same screen with different arguments: a grid of products, a
//  sort control, a filter sheet, pagination and an empty state.
//  Both call `/api/app/products` — the SAME endpoint, which
//  takes `q` and `category` as two of its parameters.
//
//  Two files meant two grids, two paginators and two empty
//  states, and they had already diverged. Merging them is not
//  tidiness: it is the difference between fixing an infinite
//  scroll bug once and finding out six weeks later that the
//  other screen still has it.
//
//  WHAT OPENS IT
//  -----------------------------------------------------------
//  `KandiBrowseScreen(query: 'boots')`      — a search
//  `KandiBrowseScreen(category: 'men')`     — a department
//  `KandiBrowseScreen(autofocus: true)`     — the search tab
//
//  All three are the same list with a different first request.
// ============================================================

/// How the results can be ordered.
///
/// The values are the server's own sort keys, not the app's. A screen that
/// invents its own vocabulary and translates at the call site is a screen
/// where a typo becomes a silently unsorted list.
const List<({String value, String label})> _kSorts = [
  (value: '', label: 'Most relevant'),
  (value: 'popular', label: 'Most popular'),
  (value: 'newest', label: 'Newest first'),
  (value: 'price_asc', label: 'Price: low to high'),
  (value: 'price_desc', label: 'Price: high to low'),
  (value: 'rating', label: 'Best rated'),
];

/// What a browse screen was opened to look at.
///
/// Rides on the route rather than the constructor — see [KandiNav.open]. Null
/// is the ordinary case: the search tab has no argument, which is precisely
/// what "an empty search box" means.
class KandiBrowseArgs {
  const KandiBrowseArgs({this.query = '', this.category = '', this.title = ''});

  final String query;

  /// A category SLUG — `men`, not `Men`.
  final String category;

  /// What the app bar says. Falls back to the query or the slug.
  final String title;
}

/// Search and category, which are the same screen with a different opening
/// question.
///
/// Opened as
/// `KandiNav.open(context, const KandiBrowseScreen(), args: KandiBrowseArgs(...))`,
/// or placed bare as the shell's search tab.
class KandiBrowseScreen extends StatefulWidget {
  const KandiBrowseScreen({super.key, this.width, this.height});

  final double? width;
  final double? height;

  @override
  State<KandiBrowseScreen> createState() => _KandiBrowseScreenState();
}

class _KandiBrowseScreenState extends State<KandiBrowseScreen> {
  static const String _recentKey = 'kandi-recent-searches-v1';

  final _controller = TextEditingController();
  final _focus = FocusNode();
  final _scroll = ScrollController();

  /// Debounces the search so a request is not sent per keystroke.
  ///
  /// 350ms is roughly the gap between words when somebody is typing rather
  /// than pausing. Shorter and a six-letter query is six requests; longer and
  /// the results feel like they are lagging behind the thumb.
  Timer? _debounce;

  List<KandiProduct> _products = const [];
  List<String> _recent = const [];

  String _sort = '';
  int _page = 1;
  int _totalPages = 1;

  bool _loading = false;
  bool _loadingMore = false;
  bool _failed = false;
  bool _searched = false;

  String _query = '';
  String _category = '';
  String _title = '';

  /// Whether to open with the keyboard up.
  ///
  /// DERIVED rather than passed. It used to be an `autofocus` parameter, and
  /// the rule it encoded is simply "this screen has nothing to show yet": a
  /// department opens straight into results and wants the grid, an empty
  /// search box opens wanting a word. Working that out from the arguments is
  /// one less thing that can be set wrong.
  bool get _autofocus => _query.isEmpty && _category.isEmpty;

  bool _started = false;

  @override
  void initState() {
    super.initState();
    _scroll.addListener(_onScroll);
    _loadRecent();
  }

  /// Reads what this screen was opened to look at, once.
  ///
  /// `didChangeDependencies` rather than `initState` because `ModalRoute.of`
  /// needs the element to be in the tree — see [KandiNav.argsOf].
  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_started) return;
    _started = true;

    final args = KandiNav.argsOf<KandiBrowseArgs>(context);
    if (args != null) {
      _query = args.query;
      _category = args.category;
      _title = args.title;
    }

    _controller.text = _query;

    // A department opens straight into results; the search tab opens into the
    // recent list and asks for nothing until there is something to ask about.
    if (_query.isNotEmpty || _category.isNotEmpty) {
      _search(reset: true);
    }
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _scroll.removeListener(_onScroll);
    _scroll.dispose();
    _controller.dispose();
    _focus.dispose();
    super.dispose();
  }

  /// The tile's quick-add button.
  ///
  /// A product with a size to choose opens instead of being added, because a
  /// variable product added without a variation is how an order arrives with
  /// no size on it.
  Future<void> _quickAdd(KandiProduct product) async {
    if (await KandiCart.quickAdd(product)) {
      if (mounted) kandiToast(context, 'Added to your cart');
      return;
    }
    if (!mounted) return;
    await KandiNav.open(
      context,
      const KandiProductScreen(),
      args: product.id,
    );
  }

  void _onScroll() {
    if (_loadingMore || _loading) return;
    if (_page >= _totalPages) return;
    // Half a screen early, so the next page is usually there by the time the
    // shopper reaches the bottom rather than after it.
    if (_scroll.position.pixels >=
        _scroll.position.maxScrollExtent - MediaQuery.of(context).size.height / 2) {
      _loadMore();
    }
  }

  // ============================================================
  //  RECENT SEARCHES
  // ============================================================

  Future<void> _loadRecent() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final list = prefs.getStringList(_recentKey) ?? const <String>[];
      if (mounted) setState(() => _recent = list);
    } catch (_) {
      // An unreadable list is an empty one. Recent searches are a convenience
      // and must never be the reason a screen fails to open.
    }
  }

  Future<void> _remember(String term) async {
    final clean = term.trim();
    if (clean.isEmpty) return;

    // Most recent first, no duplicates, capped at eight. Uncapped it grows
    // until the list is a wall of everything the shopper ever typed, which is
    // the opposite of a shortcut.
    final next = <String>[
      clean,
      ..._recent.where((t) => t.toLowerCase() != clean.toLowerCase()),
    ].take(8).toList();

    if (mounted) setState(() => _recent = next);
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setStringList(_recentKey, next);
    } catch (_) {
      // Already shown on screen; a failed write costs the next launch, not
      // this tap.
    }
  }

  Future<void> _forgetRecent() async {
    if (mounted) setState(() => _recent = const []);
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.remove(_recentKey);
    } catch (_) {}
  }

  // ============================================================
  //  FETCHING
  // ============================================================

  String _url(int page) {
    final params = <String, String>{
      'page': '$page',
      if (_controller.text.trim().isNotEmpty) 'q': _controller.text.trim(),
      if (_category.isNotEmpty) 'category': _category,
      if (_sort.isNotEmpty) 'sort': _sort,
    };
    final query =
        params.entries.map((e) => '${e.key}=${Uri.encodeComponent(e.value)}').join('&');
    return '/api/app/products?$query';
  }

  Future<void> _search({bool reset = false}) async {
    if (reset) {
      setState(() {
        _loading = true;
        _failed = false;
        _page = 1;
        _searched = true;
      });
    }

    final path = _url(1);

    try {
      final products = await KandiCache.read<List<KandiProduct>>(
        'browse:$path',
        // Short. A results list is a query answered at a moment, and the two
        // minutes buy the common case — a shopper opening a product and coming
        // straight back — without pretending an hour-old search is current.
        ttl: const Duration(minutes: 2),
        fetch: () async {
          final result = await KandiApi.get(path);
          if (result.status != 200) throw StateError('browse');
          final data = result.data;
          if (data is Map) {
            _totalPages = data['total_pages'] is int
                ? data['total_pages'] as int
                : 1;
            return KandiProduct.listFrom(data['products']);
          }
          return KandiProduct.listFrom(data);
        },
        onRefresh: (fresh) {
          if (mounted) setState(() => _products = fresh);
        },
      );

      if (!mounted) return;
      setState(() {
        _products = products;
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _failed = true;
      });
    }
  }

  Future<void> _loadMore() async {
    setState(() => _loadingMore = true);

    final next = _page + 1;
    final result = await KandiApi.get(_url(next));

    if (!mounted) return;

    if (result.status == 200) {
      final data = result.data;
      final more = KandiProduct.listFrom(
        data is Map ? data['products'] : data,
      );

      setState(() {
        // Deduplicated on the way in. WooCommerce can repeat a product across
        // pages when the catalogue is edited mid-scroll, and a duplicate key
        // in a Flutter list is a crash rather than a cosmetic problem.
        final seen = _products.map((p) => p.id).toSet();
        _products = [
          ..._products,
          ...more.where((p) => !seen.contains(p.id)),
        ];
        _page = next;
        _loadingMore = false;
      });
    } else {
      // A failed page leaves the list as it is and lets the shopper try again
      // by scrolling. Hammering the endpoint automatically after a failure is
      // how a bad connection becomes a hot phone.
      setState(() => _loadingMore = false);
    }
  }

  void _onTyped(String value) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 350), () {
      if (value.trim().isEmpty && _category.isEmpty) {
        setState(() {
          _products = const [];
          _searched = false;
        });
        return;
      }
      _search(reset: true);
    });
  }

  void _submit(String value) {
    _debounce?.cancel();
    _remember(value);
    _focus.unfocus();
    _search(reset: true);
  }

  // ============================================================
  //  THE SCREEN
  // ============================================================

  @override
  Widget build(BuildContext context) {
    return Container(
      width: widget.width,
      height: widget.height,
      color: KandiColors.page,
      child: Scaffold(
        backgroundColor: KandiColors.page,
        appBar: AppBar(
          backgroundColor: KandiColors.surface,
          surfaceTintColor: KandiColors.surface,
          elevation: 0,
          scrolledUnderElevation: 0,
          titleSpacing: 0,
          leading: IconButton(
            onPressed: () => Navigator.of(context).maybePop(),
            icon: const Icon(Icons.arrow_back_rounded,
                color: KandiColors.ink, size: 22),
          ),
          title: _searchField(),
          actions: [
            KandiCartBadge(
              onTap: () => KandiNav.goTab(context, KandiNav.cartTab),
            ),
            const SizedBox(width: KandiSpace.xs),
          ],
          bottom: PreferredSize(
            preferredSize: const Size.fromHeight(49),
            child: _sortBar(),
          ),
        ),
        body: _body(),
      ),
    );
  }

  Widget _searchField() {
    return Container(
      height: 40,
      margin: const EdgeInsets.only(right: KandiSpace.sm),
      padding: const EdgeInsets.symmetric(horizontal: KandiSpace.md),
      decoration: BoxDecoration(
        color: KandiColors.hairline,
        borderRadius: KandiRadius.md,
      ),
      child: Row(
        children: [
          const Icon(Icons.search_rounded, size: 19, color: KandiColors.muted),
          const SizedBox(width: KandiSpace.sm),
          Expanded(
            child: TextField(
              controller: _controller,
              focusNode: _focus,
              autofocus: _autofocus,
              textInputAction: TextInputAction.search,
              style: KandiType.label(),
              onChanged: _onTyped,
              onSubmitted: _submit,
              decoration: InputDecoration(
                isDense: true,
                border: InputBorder.none,
                hintText: _category.isNotEmpty
                    ? 'Search in ${_title.isEmpty ? _category : _title}'
                    : 'Search Kandi',
                hintStyle: KandiType.label(color: KandiColors.faint),
              ),
            ),
          ),
          if (_controller.text.isNotEmpty)
            GestureDetector(
              onTap: () {
                _controller.clear();
                _onTyped('');
                setState(() {});
              },
              child: const Icon(Icons.close_rounded,
                  size: 18, color: KandiColors.muted),
            ),
        ],
      ),
    );
  }

  Widget _sortBar() {
    return Container(
      height: 49,
      decoration: const BoxDecoration(
        color: KandiColors.surface,
        border: Border(
          bottom: BorderSide(color: KandiColors.line, width: 1),
        ),
      ),
      child: ListView.builder(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: KandiSpace.gutter),
        itemCount: _kSorts.length,
        itemBuilder: (context, index) {
          final sort = _kSorts[index];
          final selected = _sort == sort.value;

          return Padding(
            padding: const EdgeInsets.only(
              right: KandiSpace.sm,
              top: KandiSpace.sm,
              bottom: KandiSpace.sm,
            ),
            child: GestureDetector(
              onTap: () {
                if (selected) return;
                setState(() => _sort = sort.value);
                if (_searched) _search(reset: true);
              },
              child: Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: KandiSpace.md,
                  vertical: KandiSpace.sm,
                ),
                decoration: BoxDecoration(
                  color:
                      selected ? KandiColors.ink : KandiColors.hairline,
                  borderRadius: KandiRadius.pill,
                ),
                child: Text(
                  sort.label,
                  style: KandiType.micro(
                    color: selected ? Colors.white : KandiColors.body,
                    weight: FontWeight.w600,
                  ),
                ),
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _body() {
    if (!_searched && _category.isEmpty) return _recentList();
    if (_loading) return _gridSkeleton();
    if (_failed) {
      return KandiEmpty(
        icon: Icons.wifi_off_rounded,
        title: 'Could not load results',
        message: 'Check your connection and try again.',
        actionLabel: 'Try again',
        onAction: () => _search(reset: true),
      );
    }
    if (_products.isEmpty) return _noResults();
    return _grid();
  }

  /// What the search tab shows before anything has been typed.
  ///
  /// Recent searches rather than a blank screen or invented "trending"
  /// suggestions. The shop has no search-term analytics, so a trending list
  /// would be six words somebody made up — and a shopper who taps one and gets
  /// nothing has learned the app guesses.
  Widget _recentList() {
    if (_recent.isEmpty) {
      return KandiEmpty(
        icon: Icons.search_rounded,
        title: 'What are you looking for?',
        message: 'Search for a product, a brand or a category.',
      );
    }

    return ListView(
      padding: const EdgeInsets.symmetric(vertical: KandiSpace.sm),
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(
            KandiSpace.gutter,
            KandiSpace.md,
            KandiSpace.gutter,
            KandiSpace.sm,
          ),
          child: Row(
            children: [
              Text('Recent searches', style: KandiType.title()),
              const Spacer(),
              GestureDetector(
                onTap: _forgetRecent,
                child: Text(
                  'Clear',
                  style: KandiType.label(color: KandiColors.primaryInk)
                      .copyWith(fontWeight: FontWeight.w600),
                ),
              ),
            ],
          ),
        ),
        for (final term in _recent)
          ListTile(
            leading: const Icon(Icons.history_rounded,
                size: 20, color: KandiColors.muted),
            title: Text(term, style: KandiType.bodyText(color: KandiColors.ink)),
            trailing: const Icon(Icons.north_west_rounded,
                size: 16, color: KandiColors.faint),
            onTap: () {
              _controller.text = term;
              _submit(term);
            },
          ),
      ],
    );
  }

  Widget _grid() {
    final gutter = KandiSpace.gutter;
    final gap = KandiSpace.sm;
    final tileWidth =
        (MediaQuery.of(context).size.width - gutter * 2 - gap) / 2;

    return RefreshIndicator(
      color: KandiColors.primary,
      onRefresh: () async {
        KandiCache.invalidate('browse:${_url(1)}');
        await _search(reset: true);
      },
      child: GridView.builder(
        controller: _scroll,
        padding: EdgeInsets.all(gutter),
        // `+ 1` for the footer row, which carries either the page spinner or
        // the "that is everything" line. Folding it into the grid rather than
        // wrapping the whole thing in a Column keeps one scrollable, so the
        // pull-to-refresh and the infinite scroll share a controller.
        itemCount: _products.length + 1,
        gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
          crossAxisCount: 2,
          mainAxisSpacing: gap,
          crossAxisSpacing: gap,
          mainAxisExtent: tileWidth + 96,
        ),
        itemBuilder: (context, index) {
          if (index >= _products.length) return _footer();
          final product = _products[index];
          return KandiProductTile(
            product: product,
            width: tileWidth,
            onTap: () => KandiNav.open(
              context,
              const KandiProductScreen(),
              args: product.id,
            ),
            onAdd: _quickAdd,
          );
        },
      ),
    );
  }

  Widget _footer() {
    if (_loadingMore) {
      return const Center(
        child: SizedBox(
          width: 22,
          height: 22,
          child: CircularProgressIndicator(
              strokeWidth: 2, color: KandiColors.primary),
        ),
      );
    }
    if (_page >= _totalPages && _products.isNotEmpty) {
      return Center(
        child: Text(
          'That is everything',
          style: KandiType.caption(color: KandiColors.faint),
        ),
      );
    }
    return const SizedBox.shrink();
  }

  Widget _noResults() {
    final term = _controller.text.trim();
    return KandiEmpty(
      icon: Icons.search_off_rounded,
      title: term.isEmpty ? 'Nothing here yet' : 'No results for "$term"',
      // Says what to do next rather than restating the problem. "Try a
      // different spelling" is an instruction; "0 results found" is a fact the
      // shopper can already see.
      message: 'Try a shorter word, or check the spelling.',
      actionLabel: _sort.isEmpty ? null : 'Clear sorting',
      onAction: _sort.isEmpty
          ? null
          : () {
              setState(() => _sort = '');
              _search(reset: true);
            },
    );
  }

  Widget _gridSkeleton() {
    final gutter = KandiSpace.gutter;
    final gap = KandiSpace.sm;
    final tileWidth =
        (MediaQuery.of(context).size.width - gutter * 2 - gap) / 2;

    return GridView.builder(
      padding: EdgeInsets.all(gutter),
      itemCount: 6,
      gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 2,
        mainAxisSpacing: gap,
        crossAxisSpacing: gap,
        mainAxisExtent: tileWidth + 96,
      ),
      itemBuilder: (context, _) => Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          KandiSkeleton(width: tileWidth, height: tileWidth),
          const SizedBox(height: KandiSpace.sm),
          KandiSkeleton(width: tileWidth * 0.9, height: 12),
          const SizedBox(height: KandiSpace.xs),
          KandiSkeleton(width: tileWidth * 0.5, height: 15),
        ],
      ),
    );
  }
}
