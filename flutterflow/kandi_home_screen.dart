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

// ============================================================
//  KANDI — HOME
//
//  The shop's front door, rebuilt on `kandi_design.dart`.
//
//  WHAT CHANGED, AND WHY IT IS SHORTER
//  -----------------------------------------------------------
//  The screen this replaces was 3,127 lines. This is a fraction
//  of that, and almost none of the difference is functionality —
//  it is the palette, the type scale, the money formatter, the
//  product model, the tile, the rail, the skeletons and the HTTP
//  layer, all of which that file carried privately and all of
//  which now live in the design system.
//
//  That is the point of the rebuild rather than a side effect.
//  A screen should be a description of what is on it; everything
//  else is shared machinery, and machinery copied twelve times
//  is machinery that disagrees with itself twelve ways.
//
//  HOW IT LOADS
//  -----------------------------------------------------------
//  Three things, in order of how much they matter:
//
//    1. It paints from cache on the FIRST frame. `KandiCache.peek`
//       is synchronous, so a shopper returning to this tab sees
//       the shop immediately rather than a spinner — the fetch
//       still runs, and corrects the screen a moment later if
//       anything moved.
//
//    2. One request. The old screen made its own call and every
//       rail below re-derived what it needed; `/api/app/home`
//       already composes the whole feed server-side, which is
//       why it exists.
//
//    3. Nothing off-screen is built. Every rail is a
//       `ListView.builder` with an `itemExtent`, and the page
//       itself is a `CustomScrollView` of slivers — so a rail
//       eight sections down costs nothing until it is scrolled
//       to.
// ============================================================

/// The cache key for the whole feed.
///
/// A constant rather than a string typed at each call site: `KandiCache`
/// matches on exact equality, and a key with a typo in it is a cache that
/// silently never hits.
const String _kHomeKey = 'home:v1';

/// One department, as the strip at the top of the screen draws it.
class _Department {
  const _Department({
    required this.id,
    required this.name,
    required this.slug,
    this.image,
  });

  final int id;
  final String name;
  final String slug;
  final String? image;

  static _Department? fromJson(dynamic raw) {
    if (raw is! Map) return null;
    final name = (raw['name'] ?? '').toString().trim();
    if (name.isEmpty) return null;
    return _Department(
      id: raw['id'] is int ? raw['id'] as int : 0,
      name: name,
      slug: (raw['slug'] ?? '').toString(),
      image: (raw['image']?.toString().trim().isEmpty ?? true)
          ? null
          : raw['image'].toString(),
    );
  }
}

/// One merchandising rail — "Trending now", "New in", a department.
class _Rail {
  const _Rail({
    required this.id,
    required this.title,
    required this.products,
    this.subtitle,
    this.href,
  });

  final String id;
  final String title;
  final String? subtitle;
  final String? href;
  final List<KandiProduct> products;

  static _Rail? fromJson(dynamic raw) {
    if (raw is! Map) return null;
    final products = KandiProduct.listFrom(raw['products']);
    // A rail with nothing in it is a heading and a hole. The server already
    // filters, so this is the second line of defence rather than the first.
    if (products.isEmpty) return null;
    return _Rail(
      id: (raw['id'] ?? '').toString(),
      title: (raw['title'] ?? '').toString(),
      subtitle: (raw['subtitle']?.toString().trim().isEmpty ?? true)
          ? null
          : raw['subtitle'].toString(),
      href: (raw['href']?.toString().trim().isEmpty ?? true)
          ? null
          : raw['href'].toString(),
      products: products,
    );
  }
}

/// Everything the home screen draws, in one object.
class _Feed {
  const _Feed({
    required this.departments,
    required this.rails,
    required this.pickedForYou,
    this.freeDeliveryFrom = 0,
    this.returnsDays = 0,
  });

  final List<_Department> departments;
  final List<_Rail> rails;
  final List<KandiProduct> pickedForYou;
  final num freeDeliveryFrom;
  final int returnsDays;

  bool get isEmpty =>
      departments.isEmpty && rails.isEmpty && pickedForYou.isEmpty;

  static _Feed fromJson(dynamic raw) {
    if (raw is! Map) {
      return const _Feed(departments: [], rails: [], pickedForYou: []);
    }

    final commerce = raw['commerce'];

    return _Feed(
      departments: (raw['departments'] is List)
          ? (raw['departments'] as List)
              .map(_Department.fromJson)
              .whereType<_Department>()
              .toList()
          : const [],
      rails: (raw['rails'] is List)
          ? (raw['rails'] as List)
              .map(_Rail.fromJson)
              .whereType<_Rail>()
              .toList()
          : const [],
      pickedForYou: KandiProduct.listFrom(raw['pickedForYou']),
      freeDeliveryFrom: commerce is Map && commerce['freeDeliveryFrom'] is num
          ? commerce['freeDeliveryFrom'] as num
          : 0,
      returnsDays: commerce is Map && commerce['returnsDays'] is int
          ? commerce['returnsDays'] as int
          : 0,
    );
  }
}

class KandiHomeScreen extends StatefulWidget {
  const KandiHomeScreen({
    super.key,
    this.width,
    this.height,
    this.onOpenProduct,
    this.onOpenCategory,
    this.onOpenSearch,
    this.onOpenCart,
    this.onAddToCart,
  });

  final double? width;
  final double? height;

  /// Navigation is handed in rather than performed here.
  ///
  /// FlutterFlow owns the route table — a custom widget that calls
  /// `Navigator.pushNamed` is guessing at names the designer can rename in the
  /// builder at any time. Passing callbacks keeps this screen a description of
  /// what is on it and leaves where-things-go to the place that knows.
  final void Function(int productId)? onOpenProduct;
  final void Function(String slug)? onOpenCategory;
  final VoidCallback? onOpenSearch;
  final VoidCallback? onOpenCart;
  final void Function(KandiProduct product)? onAddToCart;

  @override
  State<KandiHomeScreen> createState() => _KandiHomeScreenState();
}

class _KandiHomeScreenState extends State<KandiHomeScreen> {
  /// Seeded from the cache SYNCHRONOUSLY, in the initialiser.
  ///
  /// This one line is most of why the screen feels instant on a second visit:
  /// `build` runs with a feed already in hand, so the first frame is the shop
  /// rather than a skeleton. `_load` still runs and still corrects it.
  _Feed? _feed = KandiCache.peek<_Feed>(_kHomeKey);

  bool _failed = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    if (_failed && mounted) setState(() => _failed = false);

    try {
      final feed = await KandiCache.read<_Feed>(
        _kHomeKey,
        // Ten minutes. A home feed is merchandising, not stock: the prices in
        // it are checked again on the product page and again at checkout, so a
        // slightly old rail costs nothing and a fresh fetch on every tab
        // switch costs a shopper on mobile data real money.
        ttl: const Duration(minutes: 10),
        fetch: () async {
          final result = await KandiApi.get('/api/app/home');
          if (result.status != 200) {
            throw StateError('home ${result.status}');
          }
          return _Feed.fromJson(result.data);
        },
        // Fired only when a STALE feed was shown and a newer one has landed
        // behind it. Guarded on `mounted` because the shopper may well have
        // left the tab while it was in flight.
        onRefresh: (fresh) {
          if (mounted) setState(() => _feed = fresh);
        },
      );

      if (!mounted) return;
      setState(() => _feed = feed);
    } catch (_) {
      if (!mounted) return;
      // A failure with something already on screen is not worth showing. The
      // shopper has a working shop in front of them and an error banner over
      // it would be the app complaining about a problem they do not have.
      setState(() => _failed = _feed == null);
    }
  }

  Future<void> _refresh() async {
    KandiCache.invalidate(_kHomeKey);
    await _load();
  }

  @override
  Widget build(BuildContext context) {
    final feed = _feed;

    return Container(
      width: widget.width,
      height: widget.height,
      color: KandiColors.page,
      child: Scaffold(
        backgroundColor: KandiColors.page,
        body: SafeArea(
          bottom: false,
          child: RefreshIndicator(
            color: KandiColors.primary,
            onRefresh: _refresh,
            child: _body(feed),
          ),
        ),
      ),
    );
  }

  Widget _body(_Feed? feed) {
    if (feed == null && _failed) return _offline();
    if (feed == null) return _skeleton();
    if (feed.isEmpty) {
      return ListView(
        children: [
          SizedBox(height: MediaQuery.of(context).size.height * 0.2),
          KandiEmpty(
            icon: Icons.storefront_outlined,
            title: 'Nothing to show yet',
            message: 'The shop has no products live at the moment. '
                'Pull down to check again.',
            actionLabel: 'Reload',
            onAction: _refresh,
          ),
        ],
      );
    }

    // Slivers rather than a Column in a ScrollView. A rail eight sections down
    // is not built until it is close to the viewport, which is the difference
    // between a home screen that opens in a frame and one that assembles ten
    // rails first.
    return CustomScrollView(
      slivers: [
        SliverToBoxAdapter(child: _searchBar()),
        if (feed.freeDeliveryFrom > 0)
          SliverToBoxAdapter(child: _promise(feed)),
        if (feed.departments.isNotEmpty)
          SliverToBoxAdapter(child: _departmentStrip(feed.departments)),

        for (final rail in feed.rails)
          SliverToBoxAdapter(child: _rail(rail)),

        if (feed.pickedForYou.isNotEmpty) ...[
          SliverToBoxAdapter(
            child: KandiSectionHeader(
              title: 'Picked for you',
              subtitle: 'Fresh from the shop',
            ),
          ),
          _pickedGrid(feed.pickedForYou),
        ],

        const SliverToBoxAdapter(child: SizedBox(height: KandiSpace.xxl)),
      ],
    );
  }

  // ---- The search field ----
  //
  // Not a real input. Tapping it opens the search screen, which owns the
  // keyboard, the suggestions and the history. A live field here would mean
  // two search implementations, and the second one always drifts.
  Widget _searchBar() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(
        KandiSpace.gutter,
        KandiSpace.md,
        KandiSpace.gutter,
        KandiSpace.sm,
      ),
      child: Row(
        children: [
          Expanded(
            child: GestureDetector(
              onTap: widget.onOpenSearch,
              child: Container(
                height: 44,
                padding: const EdgeInsets.symmetric(horizontal: KandiSpace.md),
                decoration: BoxDecoration(
                  color: KandiColors.surface,
                  borderRadius: KandiRadius.md,
                  boxShadow: KandiShadow.card,
                ),
                child: Row(
                  children: [
                    const Icon(Icons.search_rounded,
                        size: 20, color: KandiColors.muted),
                    const SizedBox(width: KandiSpace.sm),
                    Text(
                      'Search for shoes, fashion, home…',
                      style: KandiType.label(color: KandiColors.muted),
                    ),
                  ],
                ),
              ),
            ),
          ),
          if (widget.onOpenCart != null) ...[
            const SizedBox(width: KandiSpace.sm),
            _iconButton(Icons.shopping_bag_outlined, widget.onOpenCart!),
          ],
        ],
      ),
    );
  }

  Widget _iconButton(IconData icon, VoidCallback onTap) {
    return Material(
      color: KandiColors.surface,
      borderRadius: KandiRadius.md,
      child: InkWell(
        onTap: onTap,
        borderRadius: KandiRadius.md,
        child: SizedBox(
          width: 44,
          height: 44,
          child: Icon(icon, size: 21, color: KandiColors.ink),
        ),
      ),
    );
  }

  // ---- The promise strip ----
  //
  // Three facts the shop actually keeps, drawn from settings rather than
  // typed here. Slogans were the first thing cut from the old screen: "BIG
  // DEALS / Everyday" is not a claim a shopper can act on, and "free delivery
  // over UGX 150,000" is.
  Widget _promise(_Feed feed) {
    final items = <(IconData, String)>[
      (
        Icons.local_shipping_outlined,
        'Free delivery over ${kandiPrice(feed.freeDeliveryFrom)}',
      ),
      (Icons.payments_outlined, 'Pay on delivery'),
      if (feed.returnsDays > 0)
        (Icons.assignment_return_outlined, '${feed.returnsDays}-day returns'),
    ];

    return Container(
      margin: const EdgeInsets.symmetric(
        horizontal: KandiSpace.gutter,
        vertical: KandiSpace.xs,
      ),
      padding: const EdgeInsets.symmetric(
        horizontal: KandiSpace.md,
        vertical: KandiSpace.sm,
      ),
      decoration: BoxDecoration(
        color: KandiColors.primarySoft,
        borderRadius: KandiRadius.md,
      ),
      child: Row(
        children: [
          for (final item in items) ...[
            Icon(item.$1, size: 14, color: KandiColors.primaryInk),
            const SizedBox(width: 4),
            // Flexible, not Expanded: these are three short phrases of very
            // different lengths, and equal thirds would leave the shortest
            // swimming while the longest still clipped.
            Flexible(
              child: Text(
                item.$2,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: KandiType.micro(color: KandiColors.primaryInk),
              ),
            ),
            if (item != items.last) const SizedBox(width: KandiSpace.md),
          ],
        ],
      ),
    );
  }

  // ---- Departments ----
  //
  // Circles, because a circle is a target the eye finds without reading. A row
  // of identical text pills has to be read left to right, which on a phone is
  // a dozen words standing between the shopper and the products.
  Widget _departmentStrip(List<_Department> departments) {
    const double diameter = 60;

    return SizedBox(
      height: 106,
      child: ListView.builder(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.fromLTRB(
          KandiSpace.gutter,
          KandiSpace.md,
          KandiSpace.gutter,
          KandiSpace.sm,
        ),
        itemCount: departments.length,
        itemExtent: 76,
        itemBuilder: (context, index) {
          final department = departments[index];
          return GestureDetector(
            onTap: () => widget.onOpenCategory?.call(department.slug),
            behavior: HitTestBehavior.opaque,
            child: Column(
              children: [
                if (department.image != null)
                  KandiImage(
                    url: department.image!,
                    width: diameter,
                    height: diameter,
                    radius: KandiRadius.pill,
                  )
                else
                  // Most categories have no image in WooCommerce, so this is
                  // the normal case rather than an edge. Initials on the brand
                  // tint read as a designed mark; a broken-image icon reads as
                  // a bug.
                  Container(
                    width: diameter,
                    height: diameter,
                    decoration: const BoxDecoration(
                      color: KandiColors.primarySoft,
                      shape: BoxShape.circle,
                    ),
                    alignment: Alignment.center,
                    child: Text(
                      _initials(department.name),
                      style: KandiType.title(color: KandiColors.primaryInk)
                          .copyWith(fontWeight: FontWeight.w700),
                    ),
                  ),
                const SizedBox(height: KandiSpace.xs),
                Text(
                  department.name,
                  maxLines: 2,
                  textAlign: TextAlign.center,
                  overflow: TextOverflow.ellipsis,
                  style: KandiType.micro(
                    color: KandiColors.body,
                    weight: FontWeight.w500,
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }

  /// One or two letters for a department with no picture.
  ///
  /// Two words give two letters — "Home & Living" is HL, the ampersand skipped
  /// because it is not a word. Three letters in a 60px circle stops being a
  /// mark and becomes small text.
  static String _initials(String name) {
    final words = name
        .split(RegExp(r'[\s&/]+'))
        .where((w) => w.isNotEmpty && RegExp(r'^[a-zA-Z]').hasMatch(w))
        .toList();
    if (words.isEmpty) return name.characters.take(1).toString().toUpperCase();
    if (words.length == 1) return words.first[0].toUpperCase();
    return (words[0][0] + words[1][0]).toUpperCase();
  }

  Widget _rail(_Rail rail) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        KandiSectionHeader(
          title: rail.title,
          subtitle: rail.subtitle,
          actionLabel: 'See all',
          onAction: rail.href == null
              ? null
              : () => widget.onOpenCategory?.call(_slugOf(rail.href!)),
        ),
        KandiProductRail(
          products: rail.products,
          onTap: (product) => widget.onOpenProduct?.call(product.id),
          onAdd: widget.onAddToCart,
        ),
      ],
    );
  }

  /// The last path segment of a rail's href.
  ///
  /// The feed sends web paths — `/category/men` — because it also serves the
  /// website. The app's navigation wants the slug, and pulling it here keeps
  /// that translation in one place rather than at every call site.
  static String _slugOf(String href) {
    final parts = href.split('/').where((p) => p.isNotEmpty).toList();
    return parts.isEmpty ? '' : parts.last;
  }

  Widget _pickedGrid(List<KandiProduct> products) {
    // Two columns, computed once here rather than per tile. The tile needs its
    // own width for the image decode, and measuring it inside every cell would
    // be a layout pass per cell per frame.
    final gutter = KandiSpace.gutter;
    final gap = KandiSpace.sm;
    final tileWidth =
        (MediaQuery.of(context).size.width - gutter * 2 - gap) / 2;

    return SliverPadding(
      padding: EdgeInsets.symmetric(horizontal: gutter),
      sliver: SliverGrid(
        gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
          crossAxisCount: 2,
          mainAxisSpacing: gap,
          crossAxisSpacing: gap,
          // Photograph (square, so `tileWidth`) plus the text block. Stated
          // rather than left to `childAspectRatio` guesswork, because a grid
          // whose cells are a hair too short clips the price off the last line.
          mainAxisExtent: tileWidth + 96,
        ),
        delegate: SliverChildBuilderDelegate(
          (context, index) {
            final product = products[index];
            return KandiProductTile(
              product: product,
              width: tileWidth,
              onTap: () => widget.onOpenProduct?.call(product.id),
              onAdd: widget.onAddToCart,
            );
          },
          childCount: products.length,
        ),
      ),
    );
  }

  // ---- The cold-start state ----
  //
  // The shape of the real screen, not a spinner. The layout does not jump when
  // the feed lands because the boxes were already the right size — and with
  // the cache in front of every read this is only ever seen once.
  Widget _skeleton() {
    return ListView(
      padding: const EdgeInsets.only(top: KandiSpace.md),
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: KandiSpace.gutter),
          child: Row(
            children: const [
              Expanded(child: KandiSkeleton(width: double.infinity, height: 44)),
              SizedBox(width: KandiSpace.sm),
              KandiSkeleton(width: 44, height: 44),
            ],
          ),
        ),
        const SizedBox(height: KandiSpace.lg),
        SizedBox(
          height: 88,
          child: ListView.builder(
            scrollDirection: Axis.horizontal,
            padding:
                const EdgeInsets.symmetric(horizontal: KandiSpace.gutter),
            itemCount: 5,
            itemBuilder: (context, _) => const Padding(
              padding: EdgeInsets.only(right: KandiSpace.lg),
              child: KandiSkeleton(
                width: 60,
                height: 60,
                radius: KandiRadius.pill,
              ),
            ),
          ),
        ),
        const SizedBox(height: KandiSpace.lg),
        const Padding(
          padding: EdgeInsets.symmetric(horizontal: KandiSpace.gutter),
          child: KandiSkeleton(width: 140, height: 18),
        ),
        const SizedBox(height: KandiSpace.md),
        const KandiRailSkeleton(),
        const SizedBox(height: KandiSpace.xl),
        const Padding(
          padding: EdgeInsets.symmetric(horizontal: KandiSpace.gutter),
          child: KandiSkeleton(width: 120, height: 18),
        ),
        const SizedBox(height: KandiSpace.md),
        const KandiRailSkeleton(),
      ],
    );
  }

  // ---- Nothing on screen and nothing in the cache ----
  //
  // The one case that earns a full-screen error: there is genuinely nothing to
  // show. It says what to do rather than what went wrong, because "Failed to
  // fetch" is a fact about our software and "check your connection" is an
  // instruction a shopper can follow.
  Widget _offline() {
    return ListView(
      children: [
        SizedBox(height: MediaQuery.of(context).size.height * 0.18),
        KandiEmpty(
          icon: Icons.wifi_off_rounded,
          title: 'Could not reach Kandi',
          message: 'Check your connection and try again.',
          actionLabel: 'Try again',
          onAction: _refresh,
        ),
      ],
    );
  }
}
