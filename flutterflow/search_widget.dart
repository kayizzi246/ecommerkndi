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

import 'dart:async';
import 'dart:convert';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

// ============================================================
// IMAGE DELIVERY
// ============================================================

/// The \`Accept\` header every photograph in this screen is fetched with.
///
/// ---- Why an app has to say this out loud ----
///
/// The API now hands back image URLs pointing at the storefront's image
/// optimiser (\`/_next/image?...\`) rather than at the raw WordPress upload, and
/// that endpoint picks its output format from the REQUEST: a client that says
/// it takes WebP gets WebP, and a client that says nothing gets the original
/// format back, resized.
///
/// Dart's HTTP client — which is what \`cached_network_image\` uses — sends no
/// \`Accept\` header at all. So without this line the app would collect the
/// resizing and the CDN delivery and silently leave the format conversion on
/// the table, which on this catalogue is about 45% of the bytes. Flutter
/// decodes WebP natively on both Android and iOS, so there is nothing to lose
/// by asking for it.
///
/// \`image/*\` after it is the fallback for any URL that is not going through
/// the optimiser — a seller avatar on another domain, say — where the server
/// should simply send whatever it has.
const Map<String, String> _kImageHeaders = <String, String>{
  'Accept': 'image/webp,image/*;q=0.8',
};


// ============================================================
//  KANDI — SEARCH  (v3)
//
//  Sibling of cart_widget.dart, checkout_widget.dart and
//  delivery_address_widget.dart. Same brand, same type, same
//  API, same conventions.
//
//  WHAT THE PREVIOUS VERSION WAS, AND WHY NONE OF IT SURVIVED
//  -----------------------------------------------------------
//  The screen this replaces was called GOLDLINE and belonged to
//  a different shop. It is worth listing what it did, because
//  every one of these is a category of bug rather than a detail:
//
//    • IT SEARCHED SUPABASE. `ProductsTable().queryRows(...)` read
//      a Postgres table. The catalogue lives in WooCommerce. A
//      shopper searching the app was searching a copy that
//      nothing keeps in step — products added in wp-admin were
//      unfindable, deleted ones still appeared, and prices were
//      whatever the copy last said.
//
//    • IT DOWNLOADED THE WHOLE CATALOGUE TO FILTER IT. Every
//      product, on open, then `.where()` in Dart. That is fine
//      for eighty products and ruinous for eight thousand, on a
//      Ugandan mobile connection, before the shopper has typed a
//      letter.
//
//    • IT INVENTED THE DEPARTMENTS. Hard-coded Women / Men / Kids
//      tabs, matched to products by searching for substrings in
//      the category name — `cat.contains('women')`. A shop whose
//      categories are named anything else has three empty tabs,
//      and a real category that does not contain one of those
//      words is invisible. This is the exact bug
//      `/api/app/products` was written to end.
//
//    • IT SORTED IN DART. `filtered.sort((a, b) => a.price...)`
//      beside a website that sorts with `sortProducts`. The first
//      time either changed, "Price: low to high" meant two
//      different orders in two places — which reads to a shopper
//      as the app lying about prices.
//
//    • IT WAS A DIFFERENT BRAND. Fraunces + DM Sans, a gold
//      palette, "designers", "Comp. Value". Not this shop.
//
//  v3 asks the shop. One endpoint, which is the same one the
//  Shop screen uses and which runs the website's own
//  `filterProducts` and `sortProducts`:
//
//      GET {_kApiBaseUrl}/api/app/products
//          ?q= &sort= &page= &category=
//          &min_price= &max_price= &sale= &stock=
//
//  Everything on this screen — the departments, the ordering,
//  the prices, the discount badges — comes back from there
//  already decided. Nothing is computed in Dart, so the app and
//  the site cannot disagree.
//
//  SUGGESTIONS AS YOU TYPE
//  -----------------------------------------------------------
//      GET {_kApiBaseUrl}/api/search-suggest?q=
//
//  Debounced at 250ms and cancelled by sequence number, so a
//  slow answer for "sh" can never overwrite a fast one for
//  "shoes" — the bug that makes a search box feel haunted.
//
//  SETUP  (FlutterFlow)
//  -----------------------------------------------------------
//  • Custom Widget name:  SearchPage   (must match the class)
//  • Dependencies (Settings ▸ Pubspec):
//        http: ^1.2.0
//        cached_network_image: ^3.3.1
//        google_fonts: ^6.1.0
//        shared_preferences: ^2.2.2
//  • Parameters — all optional:
//        width, height    double?
//        onBackTap        Action
//
//  NOT USED HERE: Supabase, and no `userId`. Search needs no
//  account. Tapping a result opens `ProductDetailPage`, and the
//  basket is `ShoppingCartPage` — both reached through statics
//  on their widget classes, which is the only thing FlutterFlow
//  lets cross a file boundary (see cart_widget.dart).
//
//  WHAT CHANGED IN v3.1 — THE SCREEN, NOT THE SEARCH
//  -----------------------------------------------------------
//  None of the above moved. This was a layout pass, matching
//  the screen to the marketplace app a Ugandan shopper already
//  has installed, in Kandi's colours rather than that app's.
//
//  1. THE HEADER IS THE BRAND'S. It was near-black, which is a
//     perfectly good search header belonging to no shop in
//     particular. It is #FF6A00 now, with the field white and
//     fully rounded on it and the run-the-search button in ink —
//     orange on orange is a button that disappears into its own
//     header. The SafeArea moved down into `_searchBar` so the
//     status bar strip is painted too.
//
//  2. THE DEPARTMENTS ARE A GRID OF PICTURES. They were a
//     full-width list of names with counts and chevrons, which
//     is a settings screen — the wrong shape for a shopper who
//     has not decided what they want yet and is being asked to
//     already know. Two columns of cards now, each carrying a
//     photograph of something the department actually contains.
//
//     That picture costs NO extra request: `/api/app/products`
//     returns the departments and the first page of the
//     catalogue in one response, so the card borrows the first
//     product filed under the department or one of its children.
//     See `_Department.image`.
//
//  3. THE HISTORY LOST ITS LITTLE CROSSES. Each chip was two
//     targets four pixels apart, and the one people hit by
//     accident was the one that deleted the search they meant to
//     run. Long press forgets a term; the bin beside the heading
//     clears the lot.
// ============================================================

const String _kApiBaseUrl = 'https://kandiug.com';

const Color _kOrange = Color(0xFFFF6A00);
const Color _kOrangeDark = Color(0xFFE85D00);
const Color _kInk = Color(0xFF111827);
const Color _kBody = Color(0xFF4B5563);
const Color _kMuted = Color(0xFF6B7280);
const Color _kFaint = Color(0xFF9CA3AF);
const Color _kLine = Color(0xFFE5E7EB);
const Color _kHairline = Color(0xFFF3F4F6);
const Color _kSurface = Color(0xFFF9FAFB);
const Color _kSale = Color(0xFFE53935);

TextStyle _type({
  double size = 14,
  FontWeight weight = FontWeight.w400,
  Color color = _kInk,
  double height = 1.4,
}) =>
    GoogleFonts.poppins(
      fontSize: size,
      fontWeight: weight,
      color: color,
      height: height,
    );

/// One product, exactly as `/api/app/products` serialises it.
///
/// The labels arrive already formatted — `priceLabel`, `wasPriceLabel`,
/// `savingLabel` — because the server formats every figure the shop shows.
/// Formatting a price in Dart is how an app ends up writing "UGX 145854" under
/// a website that writes "UGX 145,854".
class _Product {
  final int id;
  final String name;
  final String image;
  final String priceLabel;
  final String? wasPriceLabel;
  final int discountPercent;
  final bool inStock;
  final double price;

  const _Product({
    required this.id,
    required this.name,
    required this.image,
    required this.priceLabel,
    required this.wasPriceLabel,
    required this.discountPercent,
    required this.inStock,
    required this.price,
  });

  static _Product? fromJson(dynamic raw) {
    if (raw is! Map) return null;
    final j = Map<String, dynamic>.from(raw);
    final id = (j['id'] is num) ? (j['id'] as num).toInt() : null;
    if (id == null) return null;
    return _Product(
      id: id,
      name: (j['name'] ?? '').toString(),
      image: (j['image'] ?? '').toString(),
      priceLabel: (j['priceLabel'] ?? '').toString(),
      wasPriceLabel: j['wasPriceLabel']?.toString(),
      discountPercent: (j['discountPercent'] is num)
          ? (j['discountPercent'] as num).toInt()
          : 0,
      inStock: j['inStock'] != false,
      price: (j['price'] is num) ? (j['price'] as num).toDouble() : 0,
    );
  }
}

/// A department, from the shop's own WooCommerce terms.
class _Department {
  final String name;
  final String slug;
  final int count;

  /// A photograph of something IN this department, for the discovery card.
  ///
  /// ---- Where it comes from, and why not from the category ----
  ///
  /// WooCommerce categories can carry their own image and in this shop they
  /// mostly do not — the owner adds products, not category artwork, which is
  /// the normal state of a small catalogue. So `/api/app/products` has no
  /// picture to send for a department and a card built on one would be a grid
  /// of grey squares.
  ///
  /// It is borrowed from the catalogue instead: the first product on the
  /// response's own first page whose category is this department or one of its
  /// children. That is free — the departments and the products arrive in the
  /// SAME response, so nothing extra is fetched — and it is honest, because
  /// the picture is of stock the department actually contains rather than of a
  /// mood board.
  ///
  /// Null when the first page happened to contain nothing from this
  /// department, which the card draws as a tinted tile with the initial in it.
  final String? image;

  const _Department({
    required this.name,
    required this.slug,
    required this.count,
    this.image,
  });
}

class SearchPage extends StatefulWidget {
  const SearchPage({
    super.key,
    this.width,
    this.height,
    this.onBackTap,
  });

  final double? width;
  final double? height;
  final Future Function()? onBackTap;

  /// Opens search.
  static Future<void> open(BuildContext context) {
    return Navigator.of(context).push(
      MaterialPageRoute<void>(builder: (_) => const SearchPage()),
    );
  }

  @override
  State<SearchPage> createState() => _SearchPageState();
}

class _SearchPageState extends State<SearchPage> {
  final _controller = TextEditingController();
  final _focus = FocusNode();
  final _scroll = ScrollController();

  Timer? _debounce;

  /// Guards against out-of-order responses.
  ///
  /// Every request takes the next number and only writes its result if it is
  /// still the newest. Without this a slow answer for "sh" lands after a fast
  /// one for "shoes" and replaces it — the search box that keeps showing you
  /// what you typed two letters ago.
  int _sequence = 0;

  List<_Product> _results = <_Product>[];
  List<_Product> _suggestions = <_Product>[];
  List<_Department> _departments = <_Department>[];
  List<String> _recent = <String>[];

  bool _loading = false;
  bool _loadingMore = false;
  bool _searched = false;
  String _error = '';

  int _page = 1;
  int _totalPages = 1;
  int _total = 0;

  String _sort = 'newest';
  String? _category;
  bool _saleOnly = false;
  bool _inStockOnly = false;

  static const Map<String, String> _sortLabels = <String, String>{
    'newest': 'Newest',
    'price_asc': 'Price: low to high',
    'price_desc': 'Price: high to low',
    'discount': 'Biggest discount',
    'popular': 'Most popular',
  };

  @override
  void initState() {
    super.initState();
    _loadRecent();
    _loadDepartments();
    _scroll.addListener(_onScroll);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _focus.requestFocus();
    });
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _controller.dispose();
    _focus.dispose();
    _scroll.removeListener(_onScroll);
    _scroll.dispose();
    super.dispose();
  }

  String get _query => _controller.text.trim();

  bool get _hasFilters =>
      _saleOnly || _inStockOnly || _category != null || _sort != 'newest';

  // ==========================================================
  // RECENT SEARCHES
  // ==========================================================

  Future<void> _loadRecent() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      if (!mounted) return;
      setState(() => _recent = prefs.getStringList('kandi_recent_search') ?? []);
    } catch (_) {}
  }

  Future<void> _rememberSearch(String term) async {
    final value = term.trim();
    if (value.isEmpty) return;
    try {
      final prefs = await SharedPreferences.getInstance();
      final list = List<String>.from(_recent)
        ..removeWhere((e) => e.toLowerCase() == value.toLowerCase())
        ..insert(0, value);
      final trimmed = list.length > 12 ? list.sublist(0, 12) : list;
      await prefs.setStringList('kandi_recent_search', trimmed);
      if (!mounted) return;
      setState(() => _recent = trimmed);
    } catch (_) {}
  }

  Future<void> _forgetSearch(String term) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final list = List<String>.from(_recent)..remove(term);
      await prefs.setStringList('kandi_recent_search', list);
      if (!mounted) return;
      setState(() => _recent = list);
    } catch (_) {}
  }

  Future<void> _clearRecent() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setStringList('kandi_recent_search', <String>[]);
      if (!mounted) return;
      setState(() => _recent = <String>[]);
    } catch (_) {}
  }

  // ==========================================================
  // THE SHOP
  // ==========================================================

  /// The shop's real departments, for the filter sheet.
  ///
  /// Asked for once, with an empty query, purely for the `departments` block
  /// the endpoint always returns. They are WooCommerce terms with stock behind
  /// them — never a list baked into this file.
  Future<void> _loadDepartments() async {
    try {
      // No `per_page`: the endpoint fixes its page size at 24 to match the
      // website's listing pages and ignores the parameter. Sending one that
      // does nothing reads as a contract this app relies on and would be the
      // first thing somebody "fixed" by adding it server-side.
      final res = await http
          .get(Uri.parse('$_kApiBaseUrl/api/app/products'))
          .timeout(const Duration(seconds: 20));
      final data = jsonDecode(res.body);
      if (data is! Map || !mounted) return;
      final list = data['departments'];
      if (list is! List) return;

      // The products from the same response, indexed by the category slug each
      // one belongs to. This is the pool the department cards borrow their
      // photographs from — see `_Department.image`.
      final shots = <String, String>{};
      final products = data['products'];
      if (products is List) {
        for (final raw in products.whereType<Map>()) {
          final slug = (raw['categorySlug'] ?? '').toString();
          final image = (raw['image'] ?? '').toString();
          if (slug.isEmpty || !image.startsWith('http')) continue;
          shots.putIfAbsent(slug, () => image);
        }
      }

      setState(() {
        _departments = list
            .whereType<Map>()
            .map((raw) {
              final slug = (raw['slug'] ?? '').toString();

              // The department's own slug first, then its children's. A
              // product is filed under the deepest category it belongs to —
              // "Sneakers", not "Shoes" — so a top-level department almost
              // never matches a product directly and searching only its own
              // slug would leave every card blank.
              final slugs = <String>[slug];
              final children = raw['children'];
              if (children is List) {
                for (final child in children.whereType<Map>()) {
                  slugs.add((child['slug'] ?? '').toString());
                }
              }

              return _Department(
                name: (raw['name'] ?? '').toString(),
                slug: slug,
                count:
                    (raw['count'] is num) ? (raw['count'] as num).toInt() : 0,
                image: slugs
                    .map((s) => shots[s])
                    .firstWhere((s) => s != null, orElse: () => null),
              );
            })
            .where((d) => d.slug.isNotEmpty)
            .toList();
      });
    } catch (_) {}
  }

  void _onTyped(String value) {
    _debounce?.cancel();

    if (value.trim().isEmpty) {
      setState(() {
        _suggestions = <_Product>[];
        _searched = false;
        _results = <_Product>[];
        _error = '';
      });
      return;
    }

    // 250ms: past the gap between letters in a word, short enough that the
    // list appears while the shopper is still looking at the field.
    _debounce = Timer(const Duration(milliseconds: 250), () => _suggest(value));
  }

  Future<void> _suggest(String value) async {
    final term = value.trim();
    if (term.length < 2) return;

    final ticket = ++_sequence;

    try {
      final res = await http
          .get(Uri.parse(
              '$_kApiBaseUrl/api/search-suggest?q=${Uri.encodeQueryComponent(term)}'))
          .timeout(const Duration(seconds: 15));

      if (!mounted || ticket != _sequence) return;

      final data = jsonDecode(res.body);
      if (data is! Map) return;
      final list = data['suggestions'];
      if (list is! List) return;

      // `/api/search-suggest` predates the app and sends the website's own
      // shape — `price` and `regular_price` as numbers, no formatted labels.
      // Mapped here rather than changing that endpoint, which the website's
      // search box also uses.
      setState(() {
        _suggestions = list.whereType<Map>().map((raw) {
          final j = Map<String, dynamic>.from(raw);
          final price = (j['price'] is num) ? (j['price'] as num).toDouble() : 0.0;
          final regular = (j['regular_price'] is num)
              ? (j['regular_price'] as num).toDouble()
              : 0.0;
          final reduced = j['on_sale'] == true && regular > price;
          return _Product(
            id: (j['id'] is num) ? (j['id'] as num).toInt() : 0,
            name: (j['name'] ?? '').toString(),
            image: (j['image'] ?? '').toString(),
            priceLabel: _ugx(price),
            wasPriceLabel: reduced ? _ugx(regular) : null,
            discountPercent: reduced
                ? (((regular - price) / regular) * 100).round()
                : 0,
            inStock: true,
            price: price,
          );
        }).toList();
      });
    } catch (_) {
      // A failed suggestion is not worth a message. The shopper can still
      // press search, which is the path that reports its own failures.
    }
  }

  /// Runs the search. `reset` false appends the next page.
  Future<void> _search({bool reset = true}) async {
    final term = _query;
    if (term.isEmpty && _category == null) return;

    _focus.unfocus();
    final ticket = ++_sequence;

    setState(() {
      if (reset) {
        _page = 1;
        _loading = true;
        _results = <_Product>[];
      } else {
        _loadingMore = true;
      }
      _suggestions = <_Product>[];
      _searched = true;
      _error = '';
    });

    if (reset) await _rememberSearch(term);

    final params = <String, String>{
      if (term.isNotEmpty) 'q': term,
      'sort': _sort,
      'page': '$_page',
      if (_category != null) 'category': _category!,
      if (_saleOnly) 'sale': '1',
      if (_inStockOnly) 'stock': '1',
    };

    try {
      final uri = Uri.parse('$_kApiBaseUrl/api/app/products')
          .replace(queryParameters: params);
      final res = await http.get(uri).timeout(const Duration(seconds: 30));

      if (!mounted || ticket != _sequence) return;

      if (res.statusCode == 429) {
        setState(() {
          _loading = false;
          _loadingMore = false;
          _error = 'Too many searches just now. Give it a moment.';
        });
        return;
      }

      final data = jsonDecode(res.body);
      if (res.statusCode != 200 || data is! Map) {
        setState(() {
          _loading = false;
          _loadingMore = false;
          _error = 'Could not search just now. Please try again.';
        });
        return;
      }

      final list = (data['products'] as List?) ?? const [];
      final parsed = list
          .map(_Product.fromJson)
          .whereType<_Product>()
          .toList();

      setState(() {
        _loading = false;
        _loadingMore = false;
        _results = reset ? parsed : (<_Product>[..._results, ...parsed]);
        _total = (data['total'] is num) ? (data['total'] as num).toInt() : parsed.length;
        _totalPages =
            (data['totalPages'] is num) ? (data['totalPages'] as num).toInt() : 1;
      });
    } catch (_) {
      if (!mounted || ticket != _sequence) return;
      setState(() {
        _loading = false;
        _loadingMore = false;
        _error = 'Could not reach the shop. Check your connection.';
      });
    }
  }

  void _onScroll() {
    if (_loading || _loadingMore) return;
    if (_page >= _totalPages) return;
    if (!_scroll.hasClients) return;
    // 600px from the bottom: far enough that the next page usually lands
    // before the shopper reaches it, close enough not to fetch pages nobody
    // scrolls to.
    if (_scroll.position.pixels >=
        _scroll.position.maxScrollExtent - 600) {
      _page += 1;
      _search(reset: false);
    }
  }

  String _ugx(double amount) {
    final whole = amount.round().toString();
    final buffer = StringBuffer();
    for (var i = 0; i < whole.length; i++) {
      if (i > 0 && (whole.length - i) % 3 == 0) buffer.write(',');
      buffer.write(whole[i]);
    }
    return 'UGX $buffer';
  }

  void _clear() {
    _controller.clear();
    setState(() {
      _suggestions = <_Product>[];
      _results = <_Product>[];
      _searched = false;
      _error = '';
    });
    _focus.requestFocus();
  }

  // ==========================================================
  // BUILD
  // ==========================================================

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      // ---- The SafeArea moved down into the pieces ----
      //
      // It used to wrap the whole column, which meant the status bar strip
      // above the search field was painted by the Scaffold — white. Now that
      // the header is brand orange, an unpainted strip above it reads as the
      // header having slipped down the screen.
      //
      // `_searchBar` takes the top inset inside its own orange ground, and the
      // content below takes the bottom one for the gesture bar.
      body: Column(
        children: [
          _searchBar(),
          if (_searched) _resultsBar(),
          Expanded(
            child: SafeArea(top: false, child: _content()),
          ),
        ],
      ),
    );
  }

  Widget _content() {
    if (_loading) {
      return const Center(
        child: CircularProgressIndicator(color: _kOrange, strokeWidth: 2),
      );
    }
    if (_error.isNotEmpty) return _errorView();
    if (_suggestions.isNotEmpty) return _suggestionList();
    if (_searched) {
      return _results.isEmpty ? _noResults() : _grid();
    }
    return _discovery();
  }

  // ---- Search bar -------------------------------------------------------

  /// The header: back, the field, and the button that runs the search.
  ///
  /// ---- Why the whole strip is brand orange ----
  ///
  /// It was near-black (`_kInk`), which is a perfectly good search header and
  /// belongs to no shop in particular. Orange is Kandi's, and this is the one
  /// screen in the app that is nothing BUT a header for most of its life — the
  /// discovery list below it is quiet grey and white by design, so the colour
  /// has to come from somewhere or the screen belongs to nobody.
  ///
  /// The field itself stays white and fully rounded. A search box is a place
  /// to type and it has to read as one against any ground.
  ///
  /// ---- The dark button on the end ----
  ///
  /// Deliberately ink rather than orange. Orange on orange is a button that
  /// disappears into its own header, and this is the only control on the strip
  /// that DOES something rather than going somewhere — it earns the contrast.
  Widget _searchBar() {
    return Container(
      color: _kOrange,
      child: SafeArea(
        bottom: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(4, 8, 12, 12),
          child: Row(
            children: [
              GestureDetector(
                onTap: () async {
                  await widget.onBackTap?.call();
                  if (mounted) Navigator.of(context).maybePop();
                },
                child: const SizedBox(
                  width: 40,
                  height: 44,
                  child: Icon(Icons.arrow_back_ios_new,
                      size: 19, color: Colors.white),
                ),
              ),
              Expanded(
                child: Container(
                  height: 44,
                  padding: const EdgeInsets.only(left: 12, right: 4),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(999),
                  ),
                  child: Row(
                    children: [
                      // The camera. It marks this as the field that searches
                      // the catalogue rather than the page — the same glyph the
                      // marketplace apps put here — and it is drawn in muted
                      // grey rather than as a live control, because this build
                      // has no image search behind it and a coloured icon that
                      // does nothing is a promise the app cannot keep.
                      const Icon(Icons.photo_camera_outlined,
                          size: 19, color: _kMuted),
                      const SizedBox(width: 9),
                      Container(width: 1, height: 18, color: _kLine),
                      const SizedBox(width: 9),
                      Expanded(
                        child: TextField(
                          controller: _controller,
                          focusNode: _focus,
                          onChanged: _onTyped,
                          onSubmitted: (_) => _search(),
                          textInputAction: TextInputAction.search,
                          style: _type(size: 14),
                          cursorColor: _kOrange,
                          decoration: InputDecoration(
                            hintText: 'Search shoes, dresses, bags…',
                            hintStyle: _type(size: 14, color: _kMuted),
                            border: InputBorder.none,
                            isDense: true,
                            contentPadding: EdgeInsets.zero,
                          ),
                        ),
                      ),
                      if (_controller.text.isNotEmpty)
                        GestureDetector(
                          onTap: _clear,
                          child: const Padding(
                            padding: EdgeInsets.symmetric(horizontal: 6),
                            child:
                                Icon(Icons.close, size: 18, color: _kMuted),
                          ),
                        ),
                      GestureDetector(
                        onTap: () => _search(),
                        child: Container(
                          width: 44,
                          height: 36,
                          decoration: BoxDecoration(
                            color: _kInk,
                            borderRadius: BorderRadius.circular(999),
                          ),
                          child: const Icon(Icons.search,
                              size: 20, color: Colors.white),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  // ---- Results bar ------------------------------------------------------

  Widget _resultsBar() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
      decoration: const BoxDecoration(
        border: Border(bottom: BorderSide(color: _kLine)),
      ),
      child: Row(
        children: [
          Expanded(
            child: Text(
              _loading
                  ? 'Searching…'
                  : '$_total ${_total == 1 ? 'result' : 'results'}',
              style: _type(size: 12.5, color: _kMuted),
            ),
          ),
          _pill(
            Icons.swap_vert,
            _sortLabels[_sort] ?? 'Sort',
            onTap: _openSort,
          ),
          const SizedBox(width: 8),
          _pill(
            Icons.tune,
            'Filter',
            active: _hasFilters,
            onTap: _openFilters,
          ),
        ],
      ),
    );
  }

  Widget _pill(IconData icon, String label,
      {bool active = false, VoidCallback? onTap}) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        decoration: BoxDecoration(
          color: active ? _kOrange : Colors.white,
          border: Border.all(color: active ? _kOrange : _kLine),
          borderRadius: BorderRadius.circular(8),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 14, color: active ? Colors.white : _kBody),
            const SizedBox(width: 5),
            Text(
              label,
              style: _type(
                size: 11.5,
                weight: FontWeight.w600,
                color: active ? Colors.white : _kInk,
              ),
            ),
          ],
        ),
      ),
    );
  }

  // ---- Sort and filter sheets ------------------------------------------

  void _openSort() {
    HapticFeedback.selectionClick();
    showModalBottomSheet<void>(
      context: context,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (sheetContext) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            _sheetGrip(),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Row(
                children: [
                  Text('Sort by',
                      style: _type(size: 16, weight: FontWeight.w700)),
                ],
              ),
            ),
            const SizedBox(height: 8),
            ..._sortLabels.entries.map((entry) {
              final active = _sort == entry.key;
              return ListTile(
                dense: true,
                onTap: () {
                  Navigator.of(sheetContext).pop();
                  if (active) return;
                  setState(() => _sort = entry.key);
                  _search();
                },
                leading: Icon(
                  active
                      ? Icons.radio_button_checked
                      : Icons.radio_button_off,
                  size: 20,
                  color: active ? _kOrange : _kFaint,
                ),
                title: Text(
                  entry.value,
                  style: _type(
                    size: 14,
                    weight: active ? FontWeight.w600 : FontWeight.w400,
                  ),
                ),
              );
            }),
            const SizedBox(height: 12),
          ],
        ),
      ),
    );
  }

  void _openFilters() {
    HapticFeedback.selectionClick();

    // The sheet edits a COPY and applies on the button.
    //
    // Filtering live from inside the sheet would fire a request per tap while
    // the shopper is still deciding, and each one costs a WooCommerce round
    // trip. It also makes Reset ambiguous — reset to what, the state before the
    // sheet opened or the shop's default?
    var sale = _saleOnly;
    var stock = _inStockOnly;
    var category = _category;

    showModalBottomSheet<void>(
      context: context,
      backgroundColor: Colors.white,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (sheetContext) => StatefulBuilder(
        builder: (_, setSheet) => SafeArea(
          child: Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                _sheetGrip(),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  child: Row(
                    children: [
                      Text('Filter',
                          style: _type(size: 16, weight: FontWeight.w700)),
                      const Spacer(),
                      GestureDetector(
                        onTap: () => setSheet(() {
                          sale = false;
                          stock = false;
                          category = null;
                        }),
                        child: Text('Reset',
                            style: _type(
                                size: 13,
                                weight: FontWeight.w600,
                                color: _kOrange)),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 8),
                SwitchListTile(
                  dense: true,
                  value: sale,
                  activeColor: _kOrange,
                  onChanged: (v) => setSheet(() => sale = v),
                  title: Text('On sale only', style: _type(size: 14)),
                ),
                SwitchListTile(
                  dense: true,
                  value: stock,
                  activeColor: _kOrange,
                  onChanged: (v) => setSheet(() => stock = v),
                  title: Text('In stock only', style: _type(size: 14)),
                ),
                if (_departments.isNotEmpty) ...[
                  const Divider(height: 20, color: _kLine),
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    child: Align(
                      alignment: Alignment.centerLeft,
                      child: Text('Department',
                          style: _type(
                              size: 12,
                              weight: FontWeight.w600,
                              color: _kMuted)),
                    ),
                  ),
                  const SizedBox(height: 8),
                  ConstrainedBox(
                    constraints: const BoxConstraints(maxHeight: 220),
                    child: SingleChildScrollView(
                      child: Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 16),
                        child: Wrap(
                          spacing: 8,
                          runSpacing: 8,
                          children: [
                            _chip('All', category == null,
                                () => setSheet(() => category = null)),
                            ..._departments.map((d) => _chip(
                                  '${d.name} (${d.count})',
                                  category == d.slug,
                                  () => setSheet(() => category = d.slug),
                                )),
                          ],
                        ),
                      ),
                    ),
                  ),
                ],
                const SizedBox(height: 16),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  child: GestureDetector(
                    onTap: () {
                      Navigator.of(sheetContext).pop();
                      setState(() {
                        _saleOnly = sale;
                        _inStockOnly = stock;
                        _category = category;
                      });
                      _search();
                    },
                    child: Container(
                      height: 48,
                      decoration: BoxDecoration(
                        gradient: const LinearGradient(
                            colors: [_kOrange, _kOrangeDark]),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Center(
                        child: Text('Show results',
                            style: _type(
                                size: 15,
                                weight: FontWeight.w700,
                                color: Colors.white)),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _sheetGrip() => Container(
        width: 36,
        height: 4,
        margin: const EdgeInsets.symmetric(vertical: 12),
        decoration: BoxDecoration(
          color: _kLine,
          borderRadius: BorderRadius.circular(2),
        ),
      );

  Widget _chip(String label, bool active, VoidCallback onTap) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
        decoration: BoxDecoration(
          color: active ? _kOrange.withOpacity(0.1) : _kSurface,
          border: Border.all(color: active ? _kOrange : _kLine),
          borderRadius: BorderRadius.circular(20),
        ),
        child: Text(
          label,
          style: _type(
            size: 12.5,
            weight: active ? FontWeight.w600 : FontWeight.w400,
            color: active ? _kOrangeDark : _kBody,
          ),
        ),
      ),
    );
  }

  // ---- Discovery (nothing searched yet) ---------------------------------

  /// What the screen shows before anything has been searched.
  ///
  /// ---- Two blocks, and the second one changed shape ----
  ///
  /// The recent terms stay a row of chips, because that is what a list of
  /// short strings wants to be. The departments were a full-width list — name,
  /// count, chevron, hairline, repeat — which is a settings screen, and it is
  /// the wrong shape for a decision made from pictures. A shopper on this
  /// screen has not decided what they want; a wall of category NAMES asks them
  /// to already know.
  ///
  /// They are a two-column grid of cards now, each with a photograph of
  /// something the department actually contains — see `_Department.image` for
  /// where that picture comes from and why it costs no extra request. Twice as
  /// many fit on a screen, and each one advertises rather than lists.
  Widget _discovery() {
    if (_recent.isEmpty && _departments.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.search, size: 48, color: _kFaint),
              const SizedBox(height: 12),
              Text('What are you looking for?',
                  style: _type(size: 15, weight: FontWeight.w600)),
            ],
          ),
        ),
      );
    }

    return ListView(
      padding: const EdgeInsets.only(top: 14, bottom: 24),
      keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
      children: [
        if (_recent.isNotEmpty) ...[
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 10, 10),
            child: Row(
              children: [
                Text('Search history',
                    style: _type(size: 15, weight: FontWeight.w700)),
                const Spacer(),
                // The bin, not the word "Clear". It is the one destructive
                // control on the screen and an icon keeps it from reading as a
                // suggestion beside the terms it deletes.
                GestureDetector(
                  onTap: _clearRecent,
                  child: const SizedBox(
                    width: 40,
                    height: 32,
                    child: Icon(Icons.delete_outline,
                        size: 20, color: _kMuted),
                  ),
                ),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Wrap(
              spacing: 8,
              runSpacing: 8,
              children: _recent
                  .map((term) => GestureDetector(
                        onTap: () {
                          _controller.text = term;
                          _search();
                        },
                        // Forgetting ONE term. The little × on each chip is
                        // gone — it made every chip two targets four pixels
                        // apart, and the one people hit by accident was the
                        // one that deleted the search they meant to run.
                        // A long press is the standard gesture for "manage
                        // this item" and it cannot be hit by mistake.
                        onLongPress: () {
                          HapticFeedback.mediumImpact();
                          _forgetSearch(term);
                        },
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 14, vertical: 9),
                          decoration: BoxDecoration(
                            color: _kHairline,
                            borderRadius: BorderRadius.circular(6),
                          ),
                          child: Text(term,
                              style: _type(size: 13, color: _kInk)),
                        ),
                      ))
                  .toList(),
            ),
          ),
          const SizedBox(height: 22),
        ],
        if (_departments.isNotEmpty) ...[
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 10),
            child: Text('Discover more',
                style: _type(size: 15, weight: FontWeight.w700)),
          ),
          GridView.builder(
            // Inside a ListView, so it must not scroll or measure itself
            // against an unbounded height.
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            padding: const EdgeInsets.symmetric(horizontal: 16),
            itemCount: _departments.length,
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 2,
              mainAxisSpacing: 10,
              crossAxisSpacing: 10,
              // 2.55 puts the card at roughly 66px tall on a 390px screen,
              // which is what a 60px photograph plus its hairline wants.
              childAspectRatio: 2.55,
            ),
            itemBuilder: (_, i) => _departmentCard(_departments[i]),
          ),
        ],
      ],
    );
  }

  /// One department, as a card with something from inside it on the front.
  Widget _departmentCard(_Department d) {
    return GestureDetector(
      onTap: () {
        HapticFeedback.selectionClick();
        setState(() => _category = d.slug);
        _search();
      },
      child: ClipRRect(
        borderRadius: BorderRadius.circular(8),
        child: Container(
          color: _kSurface,
          child: Row(
            children: [
              SizedBox(
                width: 62,
                height: double.infinity,
                child: d.image != null
                    ? CachedNetworkImage(
                        imageUrl: d.image!,
                        httpHeaders: _kImageHeaders,
                        fit: BoxFit.cover,
                        // Drawn at 62px. Decoding a 640px tile shot at full
                        // size for every department on the screen is how a
                        // list of twelve categories stutters on a mid-range
                        // Android.
                        memCacheWidth: 200,
                        placeholder: (_, __) =>
                            const ColoredBox(color: _kHairline),
                        errorWidget: (_, __, ___) =>
                            _departmentInitial(d),
                      )
                    : _departmentInitial(d),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      d.name,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: _type(
                          size: 13, weight: FontWeight.w600, height: 1.25),
                    ),
                    if (d.count > 0) ...[
                      const SizedBox(height: 2),
                      Text(
                        '${d.count} ${d.count == 1 ? 'item' : 'items'}',
                        style: _type(size: 11.5, color: _kMuted),
                      ),
                    ],
                  ],
                ),
              ),
              const SizedBox(width: 8),
            ],
          ),
        ),
      ),
    );
  }

  /// The stand-in for a department the first page of the catalogue had no
  /// photograph for. A letter rather than a broken-image glyph: it is quiet,
  /// it is different per card, and it does not read as something that failed.
  Widget _departmentInitial(_Department d) => ColoredBox(
        color: _kHairline,
        child: Center(
          child: Text(
            d.name.isEmpty ? '?' : d.name.substring(0, 1).toUpperCase(),
            style: _type(size: 20, weight: FontWeight.w700, color: _kFaint),
          ),
        ),
      );

  // ---- Suggestions ------------------------------------------------------

  Widget _suggestionList() {
    return ListView(
      keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
      children: [
        GestureDetector(
          onTap: () => _search(),
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
            decoration: const BoxDecoration(
              border: Border(bottom: BorderSide(color: _kLine)),
            ),
            child: Row(
              children: [
                const Icon(Icons.search, size: 18, color: _kOrange),
                const SizedBox(width: 12),
                Expanded(
                  child: Text('Search for "${_controller.text}"',
                      style: _type(size: 14, color: _kBody)),
                ),
              ],
            ),
          ),
        ),
        ..._suggestions.map((product) => GestureDetector(
              onTap: () => _openProduct(product.id),
              child: Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                decoration: const BoxDecoration(
                  border: Border(bottom: BorderSide(color: _kHairline)),
                ),
                child: Row(
                  children: [
                    ClipRRect(
                      borderRadius: BorderRadius.circular(8),
                      child: Container(
                        width: 46,
                        height: 46,
                        color: _kHairline,
                        child: product.image.startsWith('http')
                            ? CachedNetworkImage(
                                imageUrl: product.image,
                                httpHeaders: _kImageHeaders,
                                fit: BoxFit.cover)
                            : const Icon(Icons.image_outlined,
                                size: 18, color: _kFaint),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(product.name,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: _type(size: 13, weight: FontWeight.w500)),
                          const SizedBox(height: 2),
                          Text(product.priceLabel,
                              style: _type(
                                  size: 13,
                                  weight: FontWeight.w700,
                                  color: _kOrange)),
                        ],
                      ),
                    ),
                    const Icon(Icons.north_west, size: 15, color: _kFaint),
                  ],
                ),
              ),
            )),
      ],
    );
  }

  // ---- Results grid -----------------------------------------------------

  Widget _grid() {
    return GridView.builder(
      controller: _scroll,
      padding: const EdgeInsets.fromLTRB(12, 12, 12, 24),
      keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 2,
        crossAxisSpacing: 10,
        mainAxisSpacing: 20,
        childAspectRatio: 0.62,
      ),
      // One extra cell for the loading row when another page is on the way.
      itemCount: _results.length + (_loadingMore ? 1 : 0),
      itemBuilder: (_, index) {
        if (index >= _results.length) {
          return const Center(
            child: SizedBox(
              width: 20,
              height: 20,
              child:
                  CircularProgressIndicator(strokeWidth: 2, color: _kOrange),
            ),
          );
        }
        return _tile(_results[index]);
      },
    );
  }

  /// The product tile, matching the website's: square photograph with an 8px
  /// radius, no border, no shadow, two lines of name, orange price.
  Widget _tile(_Product product) {
    return GestureDetector(
      onTap: () => _openProduct(product.id),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Stack(
            children: [
              ClipRRect(
                borderRadius: BorderRadius.circular(8),
                child: AspectRatio(
                  aspectRatio: 1,
                  child: Container(
                    color: _kHairline,
                    child: product.image.startsWith('http')
                        ? CachedNetworkImage(
                            imageUrl: product.image,
                            httpHeaders: _kImageHeaders,
                            fit: BoxFit.cover,
                            errorWidget: (_, __, ___) => const Icon(
                                Icons.image_outlined,
                                color: _kFaint),
                          )
                        : const Icon(Icons.image_outlined, color: _kFaint),
                  ),
                ),
              ),
              if (product.discountPercent > 0)
                Positioned(
                  top: 6,
                  right: 6,
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 6, vertical: 3),
                    decoration: BoxDecoration(
                      color: _kSale,
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: Text('−${product.discountPercent}%',
                        style: _type(
                            size: 11,
                            weight: FontWeight.w700,
                            color: Colors.white)),
                  ),
                ),
              if (!product.inStock)
                Positioned.fill(
                  child: DecoratedBox(
                    decoration:
                        BoxDecoration(color: Colors.white.withOpacity(0.6)),
                    child: Center(
                      child: Text('Sold out',
                          style: _type(
                              size: 12,
                              weight: FontWeight.w700,
                              color: _kBody)),
                    ),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 8),
          SizedBox(
            height: 36,
            child: Text(
              product.name,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: _type(size: 13, height: 1.35),
            ),
          ),
          const SizedBox(height: 2),
          Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(product.priceLabel,
                  style: _type(
                      size: 15, weight: FontWeight.w700, color: _kOrange)),
              if (product.wasPriceLabel != null) ...[
                const SizedBox(width: 6),
                Expanded(
                  child: Text(
                    product.wasPriceLabel!,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: _type(size: 11, color: _kFaint).copyWith(
                      decoration: TextDecoration.lineThrough,
                    ),
                  ),
                ),
              ],
            ],
          ),
        ],
      ),
    );
  }

  /// Opens a product.
  ///
  /// Through the static on `ProductDetailPage`, which is the only symbol that
  /// file exports — see the note at the head of `cart_widget.dart` on why a
  /// top-level helper here would compile and then fail to resolve.
  void _openProduct(int id) {
    if (id <= 0) return;
    HapticFeedback.selectionClick();
    // `'$id'`, not `id`. The signature is `open(BuildContext, String idOrSlug)`
    // — it takes either, because a share link carries a slug and a tile carries
    // a numeric id. Passing the int compiles nowhere.
    ProductDetailPage.open(context, '$id');
  }

  // ---- Empty and error states ------------------------------------------

  Widget _noResults() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.search_off, size: 48, color: _kFaint),
            const SizedBox(height: 12),
            Text('Nothing matched',
                style: _type(size: 16, weight: FontWeight.w700)),
            const SizedBox(height: 6),
            Text(
              _hasFilters
                  ? 'Try clearing your filters, or a shorter search.'
                  : 'Try a shorter search, or a different spelling.',
              textAlign: TextAlign.center,
              style: _type(size: 13, color: _kMuted),
            ),
            if (_hasFilters) ...[
              const SizedBox(height: 16),
              GestureDetector(
                onTap: () {
                  setState(() {
                    _saleOnly = false;
                    _inStockOnly = false;
                    _category = null;
                    _sort = 'newest';
                  });
                  _search();
                },
                child: Container(
                  padding: const EdgeInsets.symmetric(
                      horizontal: 20, vertical: 10),
                  decoration: BoxDecoration(
                    border: Border.all(color: _kOrange),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text('Clear filters',
                      style: _type(
                          size: 13,
                          weight: FontWeight.w600,
                          color: _kOrange)),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _errorView() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.cloud_off, size: 44, color: _kFaint),
            const SizedBox(height: 12),
            Text(_error,
                textAlign: TextAlign.center,
                style: _type(size: 13.5, color: _kBody)),
            const SizedBox(height: 16),
            GestureDetector(
              onTap: () => _search(),
              child: Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 22, vertical: 11),
                decoration: BoxDecoration(
                  gradient:
                      const LinearGradient(colors: [_kOrange, _kOrangeDark]),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Text('Try again',
                    style: _type(
                        size: 14,
                        weight: FontWeight.w600,
                        color: Colors.white)),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
