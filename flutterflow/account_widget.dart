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


// `ValueListenable` is not one of the names material re-exports — the `show`
// list in widgets.dart stops at `Listenable` and `ValueNotifier`. The cart's
// live badge below is typed with it, so it has to be imported by name or the
// build fails with "Type 'ValueListenable' not found". The same import, for
// the same reason, is at the head of cart_widget.dart and wishlist_widget.dart.
import 'package:flutter/foundation.dart' show ValueListenable;
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:url_launcher/url_launcher.dart';

// ============================================================
//  KANDI — ACCOUNT
//
//  Sibling of home_sections_widget.dart, cart_widget.dart,
//  wishlist_widget.dart, checkout_widget.dart and
//  auth_widget.dart. Same brand, same type, same API, same
//  conventions.
//
//  NO PARAMETERS
//  -----------------------------------------------------------
//  `width` and `height` and nothing else — the same rule the
//  cart is built on. Every other screen in this app that took
//  its state as a parameter has had to have it taken back out,
//  and the reason is always the same: a parameter is a COPY of
//  something the app already knows, and a copy goes stale the
//  moment the original changes.
//
//  This screen used to be a GOLDLINE page with fifteen of them
//  — `userName`, `isLoggedIn`, `onLogout`, `onOrders`,
//  `onTrackOrder`, and so on. Every one of those was a way for
//  the FlutterFlow project to tell this screen something it can
//  find out for itself, and get it wrong:
//
//    • `userName` and `isLoggedIn` were passed in from page
//      state. Sign in on the auth screen and come back, and this
//      page still greeted you as Guest — because the page state
//      that fed the parameter had not been told. The session is
//      the only thing that knows, and it is one call away:
//      `KandiAuthPage.customerName()`.
//
//    • The Actions each needed declaring in the widget, wiring
//      in the action editor, and pointing at a page that had to
//      exist. Unwired, they were rows that did nothing when
//      tapped. Every destination this screen can reach is a
//      custom widget in this same project, so it pushes them
//      itself and there is nothing to wire and nothing to
//      forget.
//
//  So: no parameters, no Actions, no page names as strings. What
//  the screen shows comes from the session, the basket, the
//  saved list and the shop's own API; what it does when you tap
//  something is in this file.
//
//  WHAT IT IS CONNECTED TO, AND HOW
//  -----------------------------------------------------------
//  Through statics on the sibling widget classes, which is the
//  only thing that crosses a FlutterFlow file boundary — the
//  full argument is at the head of cart_widget.dart. Nothing
//  here names a type that cannot cross.
//
//    KandiAuthPage.ensureSignedIn()   who is signed in
//    KandiAuthPage.customerName()     the greeting
//    KandiAuthPage.customerEmail()    the details sheet
//    KandiAuthPage.token()            the orders request
//    KandiAuthPage.signOut()          sign out
//    KandiAuthPage.open(context)      sign in / create account
//    ShoppingCartPage.open(context)   the basket
//    ShoppingCartPage.countListenable the live basket badge
//    WishlistPage.open(context)       saved items
//    WishlistPage.countListenable     the saved count
//    SearchPage.open(context)         search
//    CategoryNavigationMenu.openFiltered(context)   the shop
//    DeliveryAddressPage.open(context)              the address
//    DeliveryAddressPage.savedRecord()              where to
//
//  ORDER HISTORY IS REAL
//  -----------------------------------------------------------
//      GET {_kApiBaseUrl}/api/app/account/orders
//          Authorization: Bearer <token>
//
//  A route added alongside this screen, because the website's
//  `/api/account/orders` reads an httpOnly cookie the app has no
//  way to hold. The alternative was to send a signed-in shopper
//  to a browser that would ask them to sign in again to look at
//  the orders they placed on this phone.
//
//  WHAT IS DELIBERATELY A WEB LINK
//  -----------------------------------------------------------
//  Track order, Help, Shipping & returns, About and Contact open
//  kandiug.com in the browser. These are pages of prose that
//  change when the shop changes its mind, and a native copy of
//  a returns policy is a returns policy that will one day
//  disagree with the real one. They are marked with the
//  open-in-new glyph so the tap is honest about where it goes.
//
//  Deleting an account is NOT one of these dressed up as a
//  button. There is no endpoint for it and inventing a row that
//  quietly does nothing is worse than not offering it: it opens
//  a request to the shop, and says so.
//
//  SETUP  (FlutterFlow)
//  -----------------------------------------------------------
//  • Custom Widget name:  AccountPage   (must match the class)
//  • Parameters:  width, height — both double?, both optional.
//    Nothing else. If the old GOLDLINE parameters are still on
//    the widget in FlutterFlow, DELETE them; a parameter left
//    declared on a widget that no longer reads it is a control
//    somebody will wire and then wonder about.
//  • Dependencies (Settings ▸ Pubspec) — all already present
//    for the sibling screens:
//        http: ^1.2.0
//        google_fonts: ^6.1.0
//        shared_preferences: ^2.2.2
//        url_launcher: ^6.2.5
// ============================================================

// ============================================================
// CONFIG — keep identical to the other widgets
// ============================================================

/// The live storefront origin. No trailing slash.
const String _kApiBaseUrl = 'https://kandiug.com';

// ============================================================
// BRAND — matched to app/globals.css
// ============================================================

const Color _kPrimary = Color(0xFFFF6A00);

/// Darkened orange that clears 4.6:1 with white text on it.
const Color _kPrimaryInk = Color(0xFFB34A00);
const Color _kPrimarySoft = Color(0xFFFFF1E6);

const Color _kSale = Color(0xFFE53935);
const Color _kSaleBg = Color(0xFFFEF2F2);

const Color _kInk = Color(0xFF171717);
const Color _kBody = Color(0xFF475569);
const Color _kMuted = Color(0xFF64748B);
const Color _kFaint = Color(0xFF94A3B8);
const Color _kLine = Color(0xFFE5E7EB);
const Color _kHairline = Color(0xFFF3F4F6);
const Color _kSurface = Color(0xFFFAFAFA);
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
// PRESS
// ============================================================

class _Press extends StatefulWidget {
  final Widget child;
  final VoidCallback? onTap;
  final double scale;
  const _Press({required this.child, this.onTap, this.scale = 0.985});

  @override
  State<_Press> createState() => _PressState();
}

class _PressState extends State<_Press> {
  bool _down = false;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      // Silent for a dead control. A row that buzzes and does nothing has told
      // the finger it worked — the same rule as the sign-in button.
      onTapDown: (_) {
        if (widget.onTap != null) HapticFeedback.selectionClick();
        setState(() => _down = true);
      },
      onTapUp: (_) => setState(() => _down = false),
      onTapCancel: () => setState(() => _down = false),
      onTap: widget.onTap,
      child: AnimatedScale(
        scale: _down ? widget.scale : 1.0,
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

/// The class name is `AccountPage`, and it must stay that.
///
/// FlutterFlow generates the call site from the Custom Widget's NAME, and
/// `custom_code/widgets/index.dart` exports this file with
/// `show AccountPage` — so the class is the only symbol a sibling screen can
/// see. Renaming it here without renaming the Custom Widget breaks the build
/// in every file that pushes this one.
class AccountPage extends StatefulWidget {
  const AccountPage({super.key, this.width, this.height});

  final double? width;
  final double? height;

  /// Opens the account screen and resolves when it closes.
  ///
  /// The static every other screen reaches this one through — the same
  /// arrangement as `ShoppingCartPage.open` and `WishlistPage.open`, and the
  /// reason no sibling needs an `onProfileTap` Action wired to get here.
  static Future<void> open(BuildContext context) {
    return Navigator.of(context).push(
      MaterialPageRoute<void>(builder: (_) => const AccountPage()),
    );
  }

  @override
  State<AccountPage> createState() => _AccountPageState();
}

class _AccountPageState extends State<AccountPage> {
  static const double _pad = 16.0;
  static const double _radius = 12.0;

  /// Null until the first check has finished, so the header can hold its
  /// shape rather than flashing "Guest" at a shopper who is signed in. A cold
  /// start reads the token off disk, and a synchronous answer before that has
  /// happened is wrong for everybody with an account.
  bool? _signedIn;

  String? _name;
  String? _email;

  /// The saved delivery record, for the subtitle on that row. A shopper who
  /// has set one should see WHERE, not a row that says "set your address"
  /// under an address they set last week.
  String? _where;

  @override
  void initState() {
    super.initState();
    _load();
    _refreshSeller();
  }

  /// Whether a seller is signed in on this device.
  ///
  /// Only ever used to word the Selling row — the seller session is otherwise
  /// entirely separate from the shopper one, and this screen deliberately knows
  /// nothing else about it.
  bool _isSeller = false;

  Future<void> _refreshSeller() async {
    final signedIn = await KandiSellerCentre.isSignedIn();
    if (!mounted || signedIn == _isSeller) return;
    setState(() => _isSeller = signedIn);
  }

  Future<void> _load() async {
    // `ensureSignedIn`, not `isSignedIn`. This is a cold start as far as the
    // session is concerned: the token is on disk, and the synchronous check
    // answers "signed out" before anything has read it. It also asks the shop
    // once per launch whether the token is still anybody, which is how a name
    // changed on the website reaches this screen at all.
    final signedIn = await KandiAuthPage.ensureSignedIn();
    final record = await DeliveryAddressPage.savedRecord();

    if (!mounted) return;
    setState(() {
      _signedIn = signedIn;
      _name = KandiAuthPage.customerName();
      _email = KandiAuthPage.customerEmail();
      _where = _describe(record);
    });
  }

  /// The saved address in one line: the place name if the picker recorded one,
  /// otherwise the street, otherwise the town.
  String? _describe(Map<String, dynamic>? record) {
    if (record == null) return null;
    for (final key in const ['place', 'address', 'city']) {
      final value = (record[key] ?? '').toString().trim();
      if (value.isNotEmpty) return value;
    }
    return null;
  }

  String get _base => _kApiBaseUrl.replaceAll(RegExp(r'/+$'), '');

  // ==========================================================
  // GOING PLACES
  // ==========================================================

  /// Opens a page of the storefront in the browser.
  ///
  /// External rather than in-app, and that is the deliberate half: these are
  /// pages the shopper may want to keep open, print or share — a returns
  /// policy, a tracking page — and the system browser is where those things
  /// work. The app is still running behind it.
  Future<void> _openWeb(String path) async {
    HapticFeedback.lightImpact();
    final uri = Uri.parse('$_base$path');
    try {
      final launched =
          await launchUrl(uri, mode: LaunchMode.externalApplication);
      // Some Android builds refuse `externalApplication` when no browser is
      // set as default. The platform default is the fallback rather than the
      // first choice, because it can be an in-app view with no address bar.
      if (!launched) await launchUrl(uri);
    } catch (e) {
      debugPrint('Kandi account link failed: $e');
      if (mounted) _toast('Could not open that page.');
    }
  }

  /// Sends the shopper to sign in, then re-reads the session when they return.
  ///
  /// The re-read is the whole point and it is why this awaits rather than
  /// fires and forgets: `KandiAuthPage` pops on success, and this screen has
  /// to greet the person who just signed in without being reopened.
  Future<void> _signIn() async {
    await KandiAuthPage.open(context);
    if (!mounted) return;
    await _load();
  }

  void _toast(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message, style: _text(size: 13.5, color: _kWhite)),
        backgroundColor: _kInk,
        behavior: SnackBarBehavior.floating,
        duration: const Duration(seconds: 3),
      ),
    );
  }

  // ==========================================================
  // BUILD
  // ==========================================================

  @override
  Widget build(BuildContext context) {
    // `Material` + `DefaultTextStyle`, or every `Text` on the screen inherits
    // Flutter's debug fallback and wears a double yellow underline. The full
    // argument is at `_screen` in product_detail_widget.dart.
    return Material(
      color: _kPage,
      child: DefaultTextStyle(
        style: _text(size: 14, color: _kInk)
            .copyWith(decoration: TextDecoration.none),
        child: SizedBox(
          width: widget.width ?? double.infinity,
          height: widget.height ?? double.infinity,
          child: SafeArea(
            bottom: false,
            child: Column(
              children: [
                _topBar(),
                Expanded(
                  child: RefreshIndicator(
                    color: _kPrimary,
                    onRefresh: _load,
                    child: ListView(
                      physics: const AlwaysScrollableScrollPhysics(
                        parent: BouncingScrollPhysics(),
                      ),
                      padding: const EdgeInsets.fromLTRB(_pad, 4, _pad, 28),
                      children: [
                        _header(),
                        const SizedBox(height: 18),
                        _shortcuts(),
                        const SizedBox(height: 18),
                        _section('Your orders', [
                          _row(
                            icon: Icons.receipt_long_outlined,
                            title: 'Order history',
                            subtitle: 'Everything you have bought',
                            onTap: _showOrders,
                          ),
                          _row(
                            icon: Icons.local_shipping_outlined,
                            title: 'Track an order',
                            subtitle: 'Where your parcel is',
                            external: true,
                            onTap: () => _openWeb('/track-order'),
                          ),
                          _row(
                            icon: Icons.assignment_return_outlined,
                            title: 'Returns',
                            subtitle: '14-day free returns',
                            external: true,
                            isLast: true,
                            onTap: () => _openWeb('/returns'),
                          ),
                        ]),
                        const SizedBox(height: 18),
                        _section('Settings', [
                          _row(
                            icon: Icons.location_on_outlined,
                            title: 'Delivery address',
                            subtitle: _where ?? 'Set where we deliver to',
                            onTap: () async {
                              await DeliveryAddressPage.open(context);
                              if (mounted) await _load();
                            },
                          ),
                          _row(
                            icon: Icons.notifications_none_rounded,
                            title: 'Notifications',
                            subtitle: 'What we may tell you about',
                            onTap: _showNotifications,
                          ),
                          _row(
                            icon: Icons.language_rounded,
                            title: 'Country and currency',
                            subtitle: 'Uganda',
                            // Not a link, and not pretending to be one. The
                            // shop ships within Uganda and prices in
                            // shillings; a picker with one entry in it is a
                            // control that wastes a tap to tell you what you
                            // already knew.
                            trailing: _chip('🇺🇬  UGX'),
                            isLast: true,
                          ),
                        ]),
                        const SizedBox(height: 18),

                        // ---- Selling, in Settings rather than the tab bar ----
                        //
                        // Sellers are a small minority of the people who
                        // install a shopping app, and a permanent tab for them
                        // would spend a fifth of the bottom bar on a screen
                        // most shoppers will never open. This is the same call
                        // the website makes by putting "Sell on Kandi" at the
                        // end of a nav row rather than in the masthead.
                        //
                        // The row LABELS ITSELF from the seller session, so it
                        // says what tapping it will actually do: somebody
                        // already signed in goes to their dashboard, somebody
                        // who is not gets the sign-in form. One row, two
                        // honest destinations, rather than a "Sell" entry that
                        // silently means different things.
                        _section('Selling', [
                          _row(
                            icon: Icons.storefront_rounded,
                            title: _isSeller
                                ? 'Seller Centre'
                                : 'Sell on Kandi',
                            subtitle: _isSeller
                                ? 'Orders, payouts and listings'
                                : 'Sign in to your store',
                            onTap: () async {
                              await KandiSellerCentre.open(context);
                              // Re-read on the way back: signing in or out in
                              // there changes what this row should say, and a
                              // row still reading "Sign in to your store"
                              // after a successful sign-in reads as a failure.
                              if (mounted) await _refreshSeller();
                            },
                            isLast: true,
                          ),
                        ]),
                        const SizedBox(height: 18),
                        _section('Help', [
                          _row(
                            icon: Icons.help_outline_rounded,
                            title: 'Help centre',
                            subtitle: 'Answers, and how to reach us',
                            external: true,
                            onTap: () => _openWeb('/help'),
                          ),
                          _row(
                            icon: Icons.inventory_2_outlined,
                            title: 'Delivery and returns',
                            subtitle: 'What it costs and how long it takes',
                            external: true,
                            onTap: () => _openWeb('/shipping'),
                          ),
                          _row(
                            icon: Icons.storefront_outlined,
                            title: 'About Kandi',
                            subtitle: 'Who you are buying from',
                            external: true,
                            isLast: true,
                            onTap: () => _openWeb('/about'),
                          ),
                        ]),
                        if (_signedIn == true) ...[
                          const SizedBox(height: 18),
                          _section(null, [
                            _row(
                              icon: Icons.logout_rounded,
                              title: 'Sign out',
                              subtitle: 'On this device',
                              onTap: _confirmSignOut,
                            ),
                            _row(
                              icon: Icons.delete_outline_rounded,
                              title: 'Close my account',
                              subtitle: 'Ask us to delete your details',
                              tint: _kSale,
                              tintBg: _kSaleBg,
                              isLast: true,
                              onTap: _confirmClose,
                            ),
                          ]),
                        ],
                        const SizedBox(height: 26),
                        _footer(),
                      ],
                    ),
                  ),
                ),
                _bottomNav(),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _topBar() => Padding(
        padding: const EdgeInsets.fromLTRB(8, 6, _pad, 2),
        child: Row(
          children: [
            _Press(
              scale: 0.94,
              onTap: () {
                HapticFeedback.lightImpact();
                Navigator.of(context).maybePop();
              },
              child: const SizedBox(
                width: 44,
                height: 44,
                child: Icon(Icons.arrow_back_rounded, size: 22, color: _kInk),
              ),
            ),
            Text('Account', style: _heading(size: 18)),
            const Spacer(),
            _Press(
              scale: 0.94,
              onTap: () => SearchPage.open(context),
              child: const SizedBox(
                width: 44,
                height: 44,
                child: Icon(Icons.search_rounded, size: 22, color: _kInk),
              ),
            ),
          ],
        ),
      );

  // ==========================================================
  // HEADER
  // ==========================================================

  /// Who you are, or an invitation to say so.
  ///
  /// Two states and no third: signed in, or not. There is no "loading" card,
  /// because `_signedIn == null` lasts for one disk read and a card that
  /// appears for 40ms and is replaced by a different card reads as a glitch.
  /// Until the answer arrives the name row simply holds its height.
  Widget _header() {
    final signedIn = _signedIn == true;
    final name = (_name ?? '').trim();
    final greeting = signedIn && name.isNotEmpty ? name : 'Hello there';

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: _kSurface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: _kLine),
      ),
      child: Row(
        children: [
          Container(
            width: 52,
            height: 52,
            decoration: BoxDecoration(
              color: signedIn ? _kPrimarySoft : _kHairline,
              shape: BoxShape.circle,
            ),
            alignment: Alignment.center,
            child: signedIn && name.isNotEmpty
                ? Text(
                    name.substring(0, 1).toUpperCase(),
                    style: _heading(size: 21, color: _kPrimaryInk),
                  )
                : const Icon(Icons.person_outline_rounded,
                    size: 24, color: _kMuted),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  greeting,
                  style: _heading(size: 19),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 3),
                Text(
                  signedIn
                      ? (_email ?? 'Signed in')
                      // Says what the account is FOR. "Sign in" alone tells a
                      // shopper only that something is in their way.
                      : 'Sign in to track orders and check out faster',
                  style: _text(size: 12.5, color: _kMuted),
                  maxLines: 2,
                ),
                const SizedBox(height: 12),
                _Press(
                  scale: 0.97,
                  onTap: signedIn ? _showDetails : _signIn,
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 14, vertical: 9),
                    decoration: BoxDecoration(
                      color: signedIn ? _kWhite : _kPrimary,
                      borderRadius: BorderRadius.circular(9),
                      border:
                          Border.all(color: signedIn ? _kLine : _kPrimary),
                    ),
                    child: Text(
                      signedIn ? 'Your details' : 'Sign in or create account',
                      style: _text(
                        size: 13,
                        color: signedIn ? _kInk : _kWhite,
                        weight: FontWeight.w700,
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  /// The basket and the saved list, as two counters that are always true.
  ///
  /// Both read the live `ValueListenable` the owning screen publishes rather
  /// than a number fetched when this page opened. Add something to the basket
  /// from the product page, come back, and the figure here has already moved —
  /// a count that can be stale is the one thing on an account page nobody
  /// forgives, because it is checked against a memory of what was put in it.
  Widget _shortcuts() => Row(
        children: [
          Expanded(
            child: _counter(
              icon: Icons.shopping_bag_outlined,
              label: 'Basket',
              listenable: ShoppingCartPage.countListenable,
              onTap: () => ShoppingCartPage.open(context),
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: _counter(
              icon: Icons.favorite_border_rounded,
              label: 'Saved',
              listenable: WishlistPage.countListenable,
              onTap: () => WishlistPage.open(context),
            ),
          ),
        ],
      );

  Widget _counter({
    required IconData icon,
    required String label,
    required ValueListenable<int> listenable,
    required VoidCallback onTap,
  }) =>
      _Press(
        scale: 0.97,
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 13),
          decoration: BoxDecoration(
            color: _kWhite,
            borderRadius: BorderRadius.circular(_radius),
            border: Border.all(color: _kLine),
          ),
          child: Row(
            children: [
              Icon(icon, size: 19, color: _kInk),
              const SizedBox(width: 10),
              Expanded(
                child: Text(label,
                    style: _text(size: 13.5, color: _kInk, weight: FontWeight.w600)),
              ),
              ValueListenableBuilder<int>(
                valueListenable: listenable,
                builder: (_, count, __) => Text(
                  '$count',
                  style: _heading(
                    size: 16,
                    color: count > 0 ? _kPrimaryInk : _kFaint,
                  ),
                ),
              ),
            ],
          ),
        ),
      );

  // ==========================================================
  // ROWS
  // ==========================================================

  Widget _section(String? title, List<Widget> rows) => Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (title != null) ...[
            Padding(
              padding: const EdgeInsets.only(left: 2, bottom: 8),
              child: Text(title.toUpperCase(), style: _label(size: 10.5)),
            ),
          ],
          Container(
            decoration: BoxDecoration(
              color: _kWhite,
              borderRadius: BorderRadius.circular(_radius),
              border: Border.all(color: _kLine),
            ),
            clipBehavior: Clip.antiAlias,
            child: Column(children: rows),
          ),
        ],
      );

  Widget _row({
    required IconData icon,
    required String title,
    String? subtitle,
    VoidCallback? onTap,
    Widget? trailing,
    bool isLast = false,
    bool external = false,
    Color? tint,
    Color? tintBg,
  }) =>
      _Press(
        onTap: onTap == null
            ? null
            : () {
                HapticFeedback.lightImpact();
                onTap();
              },
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 13),
          decoration: BoxDecoration(
            border: isLast
                ? null
                : const Border(bottom: BorderSide(color: _kHairline)),
          ),
          child: Row(
            children: [
              Container(
                width: 38,
                height: 38,
                decoration: BoxDecoration(
                  color: tintBg ?? _kHairline,
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Icon(icon, size: 19, color: tint ?? _kInk),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: _text(
                        size: 14,
                        color: tint ?? _kInk,
                        weight: FontWeight.w600,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    if (subtitle != null) ...[
                      const SizedBox(height: 2),
                      Text(
                        subtitle,
                        style: _text(size: 12, color: _kMuted),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ],
                ),
              ),
              if (trailing != null) ...[trailing, const SizedBox(width: 6)],
              // The glyph is the honest half of a row that leaves the app: an
              // arrow says "further in", this says "out to the browser", and a
              // shopper who knows which is which does not lose their place.
              if (onTap != null)
                Icon(
                  external
                      ? Icons.open_in_new_rounded
                      : Icons.chevron_right_rounded,
                  size: external ? 16 : 20,
                  color: _kFaint,
                ),
            ],
          ),
        ),
      );

  Widget _chip(String text) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
        decoration: BoxDecoration(
          color: _kHairline,
          borderRadius: BorderRadius.circular(7),
        ),
        child: Text(text,
            style: _text(size: 12, color: _kBody, weight: FontWeight.w600)),
      );

  Widget _footer() => Column(
        children: [
          Text('KandiUg', style: _heading(size: 15, color: _kPrimary)),
          const SizedBox(height: 4),
          Text(
            'Pay on delivery · 14-day free returns',
            style: _text(size: 12, color: _kMuted),
          ),
          const SizedBox(height: 10),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              _footLink('Privacy', '/privacy'),
              _dot(),
              _footLink('Terms', '/terms'),
              _dot(),
              _footLink('Contact', '/contact'),
            ],
          ),
        ],
      );

  Widget _dot() => Padding(
        padding: const EdgeInsets.symmetric(horizontal: 8),
        child: Text('·', style: _text(size: 12, color: _kFaint)),
      );

  Widget _footLink(String label, String path) => _Press(
        scale: 0.95,
        onTap: () => _openWeb(path),
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 4),
          child: Text(label,
              style: _text(size: 12, color: _kBody, weight: FontWeight.w600)),
        ),
      );

  // ==========================================================
  // THE DETAILS SHEET
  // ==========================================================

  void _showDetails() {
    HapticFeedback.mediumImpact();
    showModalBottomSheet<void>(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (sheet) => _sheet(
        sheet,
        title: 'Your details',
        subtitle: 'The same account as kandiug.com.',
        body: Column(
          children: [
            Container(
              decoration: BoxDecoration(
                color: _kWhite,
                borderRadius: BorderRadius.circular(_radius),
                border: Border.all(color: _kLine),
              ),
              child: Column(
                children: [
                  _detail(Icons.person_outline_rounded, 'Name',
                      (_name ?? '').trim().isEmpty ? '—' : _name!.trim()),
                  _detail(Icons.mail_outline_rounded, 'Email',
                      (_email ?? '').trim().isEmpty ? '—' : _email!.trim(),
                      isLast: true),
                ],
              ),
            ),
            const SizedBox(height: 12),
            // Editing happens on the website, and this says so rather than
            // opening a form that would need endpoints this app does not have.
            // A row that admits where the work happens costs one tap; a form
            // that silently fails to save costs the shopper's trust in the
            // details it showed them.
            _sheetButton(
              label: 'Edit on kandiug.com',
              filled: false,
              onTap: () {
                Navigator.of(sheet).pop();
                _openWeb('/account/settings');
              },
            ),
          ],
        ),
      ),
    );
  }

  Widget _detail(IconData icon, String label, String value,
          {bool isLast = false}) =>
      Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 13),
        decoration: BoxDecoration(
          border: isLast
              ? null
              : const Border(bottom: BorderSide(color: _kHairline)),
        ),
        child: Row(
          children: [
            Icon(icon, size: 17, color: _kMuted),
            const SizedBox(width: 11),
            Text(label, style: _text(size: 12.5, color: _kMuted)),
            const Spacer(),
            Flexible(
              child: Text(
                value,
                style: _text(size: 12.5, color: _kInk, weight: FontWeight.w700),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                textAlign: TextAlign.right,
              ),
            ),
          ],
        ),
      );

  // ==========================================================
  // ORDER HISTORY
  // ==========================================================

  /// The sheet fetches its own orders and owns its own loading state.
  ///
  /// Not fetched when this screen opens: most visits here are for the address
  /// or the saved list, and a request on every open would spend a shopper's
  /// data on a list they did not ask to see. It is one request, made when the
  /// row is tapped.
  /// Opens the orders SCREEN, not the old sheet.
  ///
  /// A sheet is the right shape for a setting and the wrong one for a record
  /// you come back to: it caps at the height of a modal, cannot hold a detail
  /// view without stacking a second sheet on itself, and had nowhere to put the
  /// one thing a shopper wants from an order they already placed — to place it
  /// again. See the head of orders_widget.dart.
  void _showOrders() {
    if (_signedIn != true) {
      _signIn();
      return;
    }

    HapticFeedback.mediumImpact();
    KandiOrdersPage.open(context);
  }

  // ==========================================================
  // NOTIFICATIONS
  // ==========================================================

  /// Four switches, saved to the device.
  ///
  /// Honest about what they are: the app has no push registration, so these
  /// record a PREFERENCE rather than switching a live subscription. The note at
  /// the foot of the sheet says exactly that — a toggle that claims to stop
  /// messages it cannot stop is the one setting a shopper will remember having
  /// been lied to about.
  ///
  /// They were briefly wired to OneSignal tags. That went with the push file,
  /// and the wording went back with it rather than being left overstating what
  /// the switches do — which is the failure this comment has always been about.
  /// The values are still saved, so whatever replaces push inherits the
  /// shopper's existing choices instead of resetting everyone to the defaults.
  Future<void> _showNotifications() async {
    HapticFeedback.mediumImpact();

    final prefs = await SharedPreferences.getInstance();
    var orders = prefs.getBool('kandi_notif_orders') ?? true;
    var deals = prefs.getBool('kandi_notif_deals') ?? true;
    var priceDrops = prefs.getBool('kandi_notif_price_drops') ?? true;
    var arrivals = prefs.getBool('kandi_notif_new_arrivals') ?? false;

    if (!mounted) return;
    await showModalBottomSheet<void>(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (sheet) => StatefulBuilder(
        builder: (sheet, setSheetState) => _sheet(
          sheet,
          title: 'Notifications',
          subtitle: 'Choose what is worth interrupting you for.',
          body: Column(
            children: [
              Container(
                decoration: BoxDecoration(
                  color: _kWhite,
                  borderRadius: BorderRadius.circular(_radius),
                  border: Border.all(color: _kLine),
                ),
                child: Column(
                  children: [
                    _toggle(
                      icon: Icons.local_shipping_outlined,
                      title: 'Order updates',
                      subtitle: 'Confirmations and delivery',
                      value: orders,
                      onChanged: (v) {
                        setSheetState(() => orders = v);
                        prefs.setBool('kandi_notif_orders', v);
                      },
                    ),
                    _toggle(
                      icon: Icons.local_offer_outlined,
                      title: 'Deals',
                      subtitle: 'Super Deals and flash sales',
                      value: deals,
                      onChanged: (v) {
                        setSheetState(() => deals = v);
                        prefs.setBool('kandi_notif_deals', v);
                      },
                    ),
                    _toggle(
                      icon: Icons.trending_down_rounded,
                      title: 'Price drops',
                      subtitle: 'When something saved goes on sale',
                      value: priceDrops,
                      onChanged: (v) {
                        setSheetState(() => priceDrops = v);
                        prefs.setBool('kandi_notif_price_drops', v);
                      },
                    ),
                    _toggle(
                      icon: Icons.auto_awesome_outlined,
                      title: 'New arrivals',
                      subtitle: 'Fresh stock each week',
                      value: arrivals,
                      isLast: true,
                      onChanged: (v) {
                        setSheetState(() => arrivals = v);
                        prefs.setBool('kandi_notif_new_arrivals', v);
                      },
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 10),
              Text(
                'Saved on this phone. Push messages are not switched on yet — '
                'when they are, these are the settings they will follow.',
                style: _text(size: 11.5, color: _kMuted),
              ),
              const SizedBox(height: 12),
              _sheetButton(
                label: 'Done',
                filled: true,
                onTap: () => Navigator.of(sheet).pop(),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _toggle({
    required IconData icon,
    required String title,
    required String subtitle,
    required bool value,
    required ValueChanged<bool> onChanged,
    bool isLast = false,
  }) =>
      Container(
        padding: const EdgeInsets.fromLTRB(14, 4, 8, 4),
        decoration: BoxDecoration(
          border: isLast
              ? null
              : const Border(bottom: BorderSide(color: _kHairline)),
        ),
        child: Row(
          children: [
            Icon(icon, size: 18, color: _kMuted),
            const SizedBox(width: 11),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title,
                      style: _text(
                          size: 13.5, color: _kInk, weight: FontWeight.w600)),
                  Text(subtitle, style: _text(size: 11.5, color: _kMuted)),
                ],
              ),
            ),
            // Scaled and coloured to match the filter switches in
            // category_navigation_menu.dart — one switch in the app, not two.
            Transform.scale(
              scale: 0.85,
              child: Switch(
                value: value,
                onChanged: (v) {
                  HapticFeedback.selectionClick();
                  onChanged(v);
                },
                activeThumbColor: _kWhite,
                activeTrackColor: _kPrimary,
              ),
            ),
          ],
        ),
      );

  // ==========================================================
  // SIGN OUT / CLOSE
  // ==========================================================

  void _confirmSignOut() {
    HapticFeedback.mediumImpact();
    showModalBottomSheet<void>(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (sheet) => _sheet(
        sheet,
        title: 'Sign out?',
        subtitle:
            'Your basket and saved items stay on this phone. You can sign '
            'back in any time.',
        body: Column(
          children: [
            _sheetButton(
              label: 'Sign out',
              filled: true,
              onTap: () async {
                Navigator.of(sheet).pop();
                await KandiAuthPage.signOut();
                if (!mounted) return;
                await _load();
                if (mounted) _toast('Signed out.');
              },
            ),
            const SizedBox(height: 8),
            _sheetButton(
              label: 'Stay signed in',
              filled: false,
              onTap: () => Navigator.of(sheet).pop(),
            ),
          ],
        ),
      ),
    );
  }

  /// Closing an account is a request, not a button, and the sheet says so.
  ///
  /// There is no endpoint that deletes a WooCommerce customer from here, and
  /// there should not be one that a tap on a phone can reach without a second
  /// factor. What this does instead is open the contact page with the request
  /// already named, which is the true state of affairs: a person at the shop
  /// closes the account.
  void _confirmClose() {
    HapticFeedback.heavyImpact();
    showModalBottomSheet<void>(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (sheet) => _sheet(
        sheet,
        title: 'Close your account',
        subtitle:
            'We will delete your details and order history. This cannot be '
            'undone, so it is done by a person rather than a button — send us '
            'the request and we will confirm by email.',
        body: Column(
          children: [
            _sheetButton(
              label: 'Send the request',
              filled: true,
              fill: _kSale,
              onTap: () {
                Navigator.of(sheet).pop();
                _openWeb('/contact?subject=Close%20my%20account');
              },
            ),
            const SizedBox(height: 8),
            _sheetButton(
              label: 'Keep my account',
              filled: false,
              onTap: () => Navigator.of(sheet).pop(),
            ),
          ],
        ),
      ),
    );
  }

  // ==========================================================
  // SHEET FURNITURE
  // ==========================================================

  Widget _sheet(
    BuildContext sheet, {
    required String title,
    String? subtitle,
    required Widget body,
  }) =>
      Container(
        decoration: const BoxDecoration(
          color: _kPage,
          borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
        ),
        padding: EdgeInsets.fromLTRB(
            _pad, 10, _pad, MediaQuery.of(sheet).padding.bottom + 18),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
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
            Text(title, style: _heading(size: 19)),
            if (subtitle != null) ...[
              const SizedBox(height: 5),
              Text(subtitle, style: _text(size: 13, color: _kMuted)),
            ],
            const SizedBox(height: 16),
            body,
          ],
        ),
      );

  Widget _sheetButton({
    required String label,
    required bool filled,
    required VoidCallback onTap,
    Color fill = _kPrimary,
  }) =>
      _Press(
        scale: 0.98,
        onTap: onTap,
        child: Container(
          height: 48,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: filled ? fill : _kWhite,
            borderRadius: BorderRadius.circular(10),
            border: Border.all(color: filled ? fill : _kLine),
          ),
          child: Text(
            label,
            style: _text(
              size: 14.5,
              color: filled ? _kWhite : _kInk,
              weight: FontWeight.w700,
            ),
          ),
        ),
      );

  // ==========================================================
  // BOTTOM NAV
  // ==========================================================

  /// The same five tabs as every other screen, and every one of them goes
  /// somewhere from inside this file — no Actions, nothing to wire.
  ///
  /// Home is the exception and it is a pop rather than a push:
  /// `HomeSectionsWidget` publishes no `open` static, and pushing a second
  /// copy of the home screen on top of the stack a shopper walked up would
  /// leave them with two of them and a back button that goes the wrong way.
  /// `popUntil(isFirst)` returns to whatever the project's first route is,
  /// which in a FlutterFlow app is the shell holding the home page.
  Widget _bottomNav() => Container(
        decoration: const BoxDecoration(
          color: _kWhite,
          border: Border(top: BorderSide(color: _kLine)),
        ),
        child: SafeArea(
          top: false,
          child: SizedBox(
            height: 58,
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceAround,
              children: [
                _navItem(Icons.home_outlined, Icons.home_rounded, 'Home', false,
                    () => Navigator.of(context).popUntil((r) => r.isFirst)),
                _navItem(
                    Icons.grid_view_outlined,
                    Icons.grid_view_rounded,
                    'Shop',
                    false,
                    () => CategoryNavigationMenu.openFiltered(context)),
                _navItem(Icons.favorite_border_rounded, Icons.favorite_rounded,
                    'Saved', false, () => WishlistPage.open(context)),
                _navItem(Icons.shopping_bag_outlined,
                    Icons.shopping_bag_rounded, 'Cart', false,
                    () => ShoppingCartPage.open(context)),
                _navItem(Icons.person_outline_rounded, Icons.person_rounded,
                    'Account', true, () {}),
              ],
            ),
          ),
        ),
      );

  Widget _navItem(IconData icon, IconData activeIcon, String label,
          bool selected, VoidCallback onTap) =>
      GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: () {
          HapticFeedback.lightImpact();
          onTap();
        },
        child: SizedBox(
          width: 62,
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              label == 'Cart'
                  ? ValueListenableBuilder<int>(
                      valueListenable: ShoppingCartPage.countListenable,
                      builder: (_, count, __) => _iconWithBadge(
                          selected ? activeIcon : icon, selected, count),
                    )
                  : _iconWithBadge(selected ? activeIcon : icon, selected, 0),
              const SizedBox(height: 3),
              Text(
                label,
                style: _label(
                  size: 10,
                  color: selected ? _kPrimaryInk : _kMuted,
                  weight: selected ? FontWeight.w700 : FontWeight.w500,
                ),
              ),
            ],
          ),
        ),
      );

  Widget _iconWithBadge(IconData icon, bool selected, int count) => SizedBox(
        width: 30,
        height: 22,
        child: Stack(
          alignment: Alignment.center,
          clipBehavior: Clip.none,
          children: [
            Icon(icon, size: 21, color: selected ? _kPrimaryInk : _kMuted),
            if (count > 0)
              Positioned(
                right: 0,
                top: -2,
                child: Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 4, vertical: 1),
                  constraints:
                      const BoxConstraints(minWidth: 15, minHeight: 15),
                  decoration: BoxDecoration(
                    color: _kPrimary,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    count > 99 ? '99+' : '$count',
                    textAlign: TextAlign.center,
                    style: _label(
                        size: 9, color: _kWhite, weight: FontWeight.w800),
                  ),
                ),
              ),
          ],
        ),
      );
}

