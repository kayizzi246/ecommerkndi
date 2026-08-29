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
import '/custom_code/widgets/kandi_support_screen.dart';
import '/custom_code/widgets/kandi_product_screen.dart';
import '/custom_code/widgets/kandi_orders_screen.dart';
import '/custom_code/widgets/kandi_addresses_screen.dart';
import '/custom_code/widgets/kandi_seller_screen.dart';

import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

// ============================================================
//  KANDI — ACCOUNT, AND THE WISHLIST
//
//  The account hub and the saved-items screen, plus the store
//  behind the wishlist that the rest of the app needs.
//
//  THE HUB IS A LIST OF DESTINATIONS, NOT A DASHBOARD
//  -----------------------------------------------------------
//  No statistics, no "member since", no points. A shopper opens
//  this screen to get somewhere — their orders, their saved
//  items, help — and every tile that is not a destination is a
//  tile between them and the one they wanted.
//
//  SIGNED OUT IS A STATE, NOT A WALL
//  -----------------------------------------------------------
//  Half of what is here works without an account: the wishlist
//  is on the handset, help is public, and the app's own settings
//  are nobody's business but the phone's. So signing in is a
//  card at the top rather than a gate over the whole screen —
//  a shopper who wants the returns policy should not have to
//  make an account to read it.
// ============================================================

/// Saved items, on the handset.
///
/// ---- Why it is local and not on the server ----
///
/// The website's wishlist is a WordPress user meta field and needs an account.
/// This one does not, deliberately: a shopper browsing without signing in is
/// the commonest case in the app, and a heart that says "sign in first" is a
/// heart nobody taps twice.
///
/// The cost is that it does not follow them to another device, which is the
/// right trade for a shortlist. If it ever needs to sync, the merge belongs on
/// the server — two devices with two local lists is exactly the conflict a
/// client cannot resolve on its own.
class KandiWishlist {
  KandiWishlist._();

  /// The website's key, so a list written by the old app is still read.
  static const String storageKey = 'kandi-wishlist-v1';

  /// Bumped on every change, so a heart anywhere in the app can rebuild.
  static final ValueNotifier<int> revision = ValueNotifier<int>(0);

  static List<KandiProduct> _items = <KandiProduct>[];
  static Set<int> _ids = <int>{};
  static bool _loaded = false;

  static List<KandiProduct> get items => List.unmodifiable(_items);
  static int get count => _items.length;

  static bool contains(int productId) => _ids.contains(productId);

  static Future<void> load({bool force = false}) async {
    if (_loaded && !force) return;

    try {
      final prefs = await SharedPreferences.getInstance();
      final raw = prefs.getString(storageKey);
      if (raw != null && raw.isNotEmpty) {
        final decoded = jsonDecode(raw);
        if (decoded is List) {
          _items = decoded
              .map(KandiProduct.fromJson)
              .whereType<KandiProduct>()
              .toList();
        }
      }
    } catch (_) {
      // Unreadable storage is an empty list, not a crash on launch.
      _items = <KandiProduct>[];
    }

    _loaded = true;
    _reindex();
  }

  /// Adds or removes, and answers whether it is now saved.
  ///
  /// One method rather than `add` and `remove`, because every call site is a
  /// heart being tapped and none of them knows or cares which way it is going.
  static Future<bool> toggle(KandiProduct product) async {
    await load();

    final saved = _ids.contains(product.id);
    if (saved) {
      _items = _items.where((p) => p.id != product.id).toList();
    } else {
      // Newest first. A shortlist is read from the top and the thing just
      // saved is the thing most likely to be wanted.
      _items = [product, ..._items];
    }

    _reindex();
    await _save();
    return !saved;
  }

  static Future<void> clear() async {
    _items = <KandiProduct>[];
    _reindex();
    await _save();
  }

  /// Keeps the id set and the notifier in step with the list.
  ///
  /// The set exists so `contains` is O(1): it is called once per tile in a
  /// scrolling grid, and a linear scan of a fifty-item wishlist per tile per
  /// frame is exactly the sort of thing that makes a list stutter for no
  /// visible reason.
  static void _reindex() {
    _ids = _items.map((p) => p.id).toSet();
    revision.value = revision.value + 1;
  }

  static Future<void> _save() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(
        storageKey,
        jsonEncode(_items
            .map((p) => {
                  'id': p.id,
                  'name': p.name,
                  'image': p.image,
                  'price': p.price,
                  'priceLabel': p.priceLabel,
                  'wasPriceLabel': p.wasPriceLabel,
                  'savingLabel': p.savingLabel,
                  'discountPercent': p.discountPercent,
                  'slug': p.slug,
                  'inStock': p.inStock,
                  'hasOptions': p.hasOptions,
                })
            .toList()),
      );
    } catch (_) {}
  }
}

/// The heart, wherever it appears.
class KandiWishlistButton extends StatelessWidget {
  const KandiWishlistButton({
    super.key,
    required this.product,
    this.size = 20,
  });

  final KandiProduct product;
  final double size;

  @override
  Widget build(BuildContext context) {
    return ValueListenableBuilder<int>(
      valueListenable: KandiWishlist.revision,
      builder: (context, _, __) {
        final saved = KandiWishlist.contains(product.id);
        return IconButton(
          onPressed: () async {
            final nowSaved = await KandiWishlist.toggle(product);
            if (!context.mounted) return;
            kandiToast(
              context,
              nowSaved ? 'Saved to your list' : 'Removed from your list',
            );
          },
          icon: Icon(
            saved ? Icons.favorite_rounded : Icons.favorite_border_rounded,
            size: size,
            color: saved ? KandiColors.sale : KandiColors.muted,
          ),
        );
      },
    );
  }
}

// ============================================================
//  THE HUB
// ============================================================

/// The account hub — the fourth tab, and the way in to everything that is
/// not shopping.
///
/// Each row names the screen it opens, which is why this file imports six of
/// its siblings. Those six were seven callbacks before, declared by hand in
/// the builder: seven chances to leave a row that highlights on tap and then
/// sits there.
class KandiAccountScreen extends StatefulWidget {
  const KandiAccountScreen({super.key, this.width, this.height});

  final double? width;
  final double? height;

  @override
  State<KandiAccountScreen> createState() => _KandiAccountScreenState();
}

class _KandiAccountScreenState extends State<KandiAccountScreen> {
  @override
  void initState() {
    super.initState();
    KandiAuth.load().then((_) {
      if (mounted) setState(() {});
    });
    KandiWishlist.load();
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      width: widget.width,
      height: widget.height,
      color: KandiColors.page,
      child: Scaffold(
        backgroundColor: KandiColors.page,
        appBar: kandiAppBar(context, 'Account', showBack: false),
        body: ValueListenableBuilder<bool>(
          valueListenable: KandiAuth.signedIn,
          builder: (context, signedIn, _) {
            return ListView(
              padding: const EdgeInsets.all(KandiSpace.gutter),
              children: [
                signedIn ? _profile() : _signInCard(),
                const SizedBox(height: KandiSpace.md),
                _group('Your shopping', [
                  _row(
                    Icons.receipt_long_outlined,
                    'Orders',
                    'Track and reorder',
                    () => KandiNav.open(
                      context,
                      const KandiOrdersScreen(),
                    ),
                  ),
                  _wishlistRow(),
                  _row(
                    Icons.location_on_outlined,
                    'Delivery addresses',
                    'Where your orders go',
                    () => KandiNav.open(
                      context,
                      const KandiAddressesScreen(),
                    ),
                  ),
                ]),
                const SizedBox(height: KandiSpace.md),
                _group('Kandi', [
                  _row(
                    Icons.help_outline_rounded,
                    'Help and support',
                    'Delivery, returns, payments',
                    () => KandiNav.open(
                      context,
                      const KandiSupportScreen(),
                    ),
                  ),
                  // A row rather than a tab. Sellers are a small minority of
                  // the people who install a shopping app, so this belongs in
                  // settings — the same call the website makes by putting
                  // "Sell on Kandi" at the end of a nav row.
                  _row(
                    Icons.storefront_outlined,
                    'Sell on Kandi',
                    'Open a store',
                    () => KandiNav.open(
                      context,
                      const KandiSellerScreen(),
                    ),
                  ),
                ]),
                if (signedIn) ...[
                  const SizedBox(height: KandiSpace.md),
                  _signOut(),
                ],
                const SizedBox(height: KandiSpace.xxl),
              ],
            );
          },
        ),
      ),
    );
  }

  Widget _profile() {
    return KandiCard(
      child: Row(
        children: [
          Container(
            width: 52,
            height: 52,
            decoration: const BoxDecoration(
              color: KandiColors.primarySoft,
              shape: BoxShape.circle,
            ),
            alignment: Alignment.center,
            child: Text(
              KandiAuth.displayName.characters.take(1).toString().toUpperCase(),
              style: KandiType.heading(color: KandiColors.primaryInk),
            ),
          ),
          const SizedBox(width: KandiSpace.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Hello, ${KandiAuth.displayName}',
                    style: KandiType.heading()),
                Text(
                  (KandiAuth.customer?['email'] ?? '').toString(),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: KandiType.caption(),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _signInCard() {
    return KandiCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Sign in to Kandi', style: KandiType.heading()),
          const SizedBox(height: KandiSpace.xs),
          Text(
            'Track your orders and check out faster.',
            style: KandiType.bodyText(),
          ),
          const SizedBox(height: KandiSpace.lg),
          KandiButton(
            label: 'Sign in or join',
            onPressed: () => KandiNav.open(context, const KandiAuthScreen()),
          ),
        ],
      ),
    );
  }

  Widget _group(String title, List<Widget> rows) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.only(
            left: KandiSpace.xs,
            bottom: KandiSpace.sm,
          ),
          child: Text(title, style: KandiType.caption()),
        ),
        KandiCard(
          padding: EdgeInsets.zero,
          child: Column(
            children: [
              for (var i = 0; i < rows.length; i++) ...[
                rows[i],
                if (i < rows.length - 1)
                  const Padding(
                    padding: EdgeInsets.only(left: 60),
                    child: Divider(height: 1, color: KandiColors.hairline),
                  ),
              ],
            ],
          ),
        ),
      ],
    );
  }

  Widget _row(
    IconData icon,
    String title,
    String subtitle,
    VoidCallback? onTap, {
    Widget? trailing,
  }) {
    return InkWell(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(
          horizontal: KandiSpace.lg,
          vertical: KandiSpace.md,
        ),
        child: Row(
          children: [
            Icon(icon, size: 20, color: KandiColors.body),
            const SizedBox(width: KandiSpace.lg),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title, style: KandiType.title()),
                  Text(subtitle, style: KandiType.caption()),
                ],
              ),
            ),
            if (trailing != null) trailing,
            const SizedBox(width: KandiSpace.sm),
            const Icon(Icons.chevron_right_rounded,
                size: 20, color: KandiColors.faint),
          ],
        ),
      ),
    );
  }

  /// The wishlist row, carrying its own live count.
  ///
  /// Listening rather than reading once: saving something from a product page
  /// and coming back here should show the new number, and a count read in
  /// `initState` would not.
  Widget _wishlistRow() {
    return ValueListenableBuilder<int>(
      valueListenable: KandiWishlist.revision,
      builder: (context, _, __) {
        final count = KandiWishlist.count;
        return _row(
          Icons.favorite_border_rounded,
          'Saved items',
          count == 0 ? 'Nothing saved yet' : '$count saved',
          () => KandiNav.open(context, const KandiWishlistScreen()),
          trailing: count == 0
              ? null
              : Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: KandiSpace.sm,
                    vertical: 2,
                  ),
                  decoration: BoxDecoration(
                    color: KandiColors.primarySoft,
                    borderRadius: KandiRadius.pill,
                  ),
                  child: Text(
                    '$count',
                    style: KandiType.micro(color: KandiColors.primaryInk),
                  ),
                ),
        );
      },
    );
  }

  Widget _signOut() {
    return KandiCard(
      padding: EdgeInsets.zero,
      child: InkWell(
        onTap: () async {
          final confirmed = await showDialog<bool>(
            context: context,
            builder: (dialogContext) => AlertDialog(
              backgroundColor: KandiColors.surface,
              shape: const RoundedRectangleBorder(borderRadius: KandiRadius.md),
              title: Text('Sign out?', style: KandiType.heading()),
              content: Text(
                // Says what survives. A shopper who thinks signing out empties
                // their basket will not sign out, and the ones who do it
                // anyway deserve not to be surprised.
                'Your cart and saved items stay on this phone.',
                style: KandiType.bodyText(),
              ),
              actions: [
                TextButton(
                  onPressed: () => Navigator.of(dialogContext).pop(false),
                  child: Text('Cancel',
                      style: KandiType.label(color: KandiColors.muted)),
                ),
                TextButton(
                  onPressed: () => Navigator.of(dialogContext).pop(true),
                  child: Text(
                    'Sign out',
                    style: KandiType.label(color: KandiColors.sale)
                        .copyWith(fontWeight: FontWeight.w700),
                  ),
                ),
              ],
            ),
          );

          if (confirmed != true) return;
          await KandiAuth.signOut();
          if (!mounted) return;
          kandiToast(context, 'Signed out');
        },
        borderRadius: KandiRadius.md,
        child: Padding(
          padding: const EdgeInsets.symmetric(
            horizontal: KandiSpace.lg,
            vertical: KandiSpace.md,
          ),
          child: Row(
            children: [
              const Icon(Icons.logout_rounded,
                  size: 20, color: KandiColors.sale),
              const SizedBox(width: KandiSpace.lg),
              Text('Sign out',
                  style: KandiType.title(color: KandiColors.sale)),
            ],
          ),
        ),
      ),
    );
  }
}

// ============================================================
//  THE WISHLIST SCREEN
// ============================================================

/// Everything the shopper has hearted.
class KandiWishlistScreen extends StatefulWidget {
  const KandiWishlistScreen({super.key, this.width, this.height});

  final double? width;
  final double? height;

  @override
  State<KandiWishlistScreen> createState() => _KandiWishlistScreenState();
}

class _KandiWishlistScreenState extends State<KandiWishlistScreen> {
  bool _ready = false;

  /// The tile's quick-add button — the same rule as the home and search
  /// grids: a product with a size to choose opens rather than being added.
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

  @override
  void initState() {
    super.initState();
    KandiWishlist.load().then((_) {
      if (mounted) setState(() => _ready = true);
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
        appBar: kandiAppBar(
          context,
          'Saved items',
          actions: [
            ValueListenableBuilder<int>(
              valueListenable: KandiWishlist.revision,
              builder: (context, _, __) {
                if (KandiWishlist.count == 0) return const SizedBox.shrink();
                return TextButton(
                  onPressed: () async {
                    await KandiWishlist.clear();
                    if (!mounted) return;
                    kandiToast(context, 'List cleared');
                  },
                  child: Text('Clear',
                      style: KandiType.label(color: KandiColors.primaryInk)),
                );
              },
            ),
          ],
        ),
        body: ValueListenableBuilder<int>(
          valueListenable: KandiWishlist.revision,
          builder: (context, _, __) {
            if (!_ready) return const SizedBox.shrink();
            if (KandiWishlist.count == 0) {
              return KandiEmpty(
                icon: Icons.favorite_border_rounded,
                title: 'Nothing saved yet',
                message:
                    'Tap the heart on anything you want to come back to.',
                actionLabel: 'Start shopping',
                onAction: () => KandiNav.goTab(context, KandiNav.homeTab),
              );
            }
            return _grid();
          },
        ),
      ),
    );
  }

  Widget _grid() {
    final items = KandiWishlist.items;
    final gutter = KandiSpace.gutter;
    final gap = KandiSpace.sm;
    final tileWidth =
        (MediaQuery.of(context).size.width - gutter * 2 - gap) / 2;

    return GridView.builder(
      padding: EdgeInsets.all(gutter),
      itemCount: items.length,
      gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 2,
        mainAxisSpacing: gap,
        crossAxisSpacing: gap,
        mainAxisExtent: tileWidth + 96,
      ),
      itemBuilder: (context, index) {
        final product = items[index];
        return Stack(
          children: [
            KandiProductTile(
              product: product,
              width: tileWidth,
              onTap: () => KandiNav.open(
                context,
                const KandiProductScreen(),
                args: product.id,
              ),
              onAdd: _quickAdd,
            ),
            // The heart sits top-right here rather than on the photograph's
            // left, because on this screen it is a REMOVE control and the
            // discount badge keeps its corner.
            Positioned(
              top: 0,
              right: 0,
              child: Material(
                color: const Color(0xCCFFFFFF),
                shape: const CircleBorder(),
                child: KandiWishlistButton(product: product, size: 18),
              ),
            ),
          ],
        );
      },
    );
  }
}
