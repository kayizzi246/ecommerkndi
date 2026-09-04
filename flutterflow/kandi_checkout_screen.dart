// Automatic FlutterFlow imports
import '/flutter_flow/flutter_flow_theme.dart';
import '/flutter_flow/flutter_flow_util.dart';
import '/custom_code/widgets/index.dart'; // Imports other custom widgets
import '/flutter_flow/custom_functions.dart'; // Imports custom functions
import 'package:flutter/material.dart';
// Begin custom widget code
// DO NOT REMOVE OR MODIFY THE CODE ABOVE!

// Imports go BELOW the header — FlutterFlow rewrites it on save and drops
// anything added there. Do not add the `/backend/` imports it offers.
import 'dart:convert';

import 'package:flutter/services.dart';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import 'package:url_launcher/url_launcher.dart';

// ============================================================
//  KANDI — CHECKOUT PAGE
//
//  Where the order is placed. Self-contained like every page
//  here; the architecture is at the head of
//  kandi_home_screen.dart.
//
//  ---- Payment happens on the website, on purpose ----
//
//  This screen collects the delivery details, saves them, and
//  hands the shopper to the shop's own checkout in a browser.
//  It does NOT take a card number or a mobile-money PIN.
//
//  That is a deliberate limit rather than an unfinished one.
//  The website's checkout is where Pesapal is wired, where the
//  IPN lands, where the delivery quote is calculated from the
//  address and where the order actually gets written to
//  WooCommerce. Rebuilding that flow in the app would mean a
//  second implementation of the one thing in this business that
//  must never be subtly wrong, and the two would drift.
//
//  What the app is good for is everything up to that point:
//  browsing, choosing, and having the details ready. So the
//  basket travels to the site as a link and the shopper pays in
//  a page that is already correct.
//
//  ---- Details are saved, not just sent ----
//
//  A shopper who abandons at payment and comes back should not
//  retype their name and their village. The four fields persist
//  under `kandi-checkout-v1` and refill on the next visit.
// ============================================================

class _KColors {
  const _KColors._();
  static const Color canvas = Color(0xFFF5F5F5);
  static const Color panel = Color(0xFFFFFFFF);
  static const Color ink = Color(0xFF111827);
  static const Color body = Color(0xFF4B5563);
  static const Color muted = Color(0xFF6B7280);
  static const Color line = Color(0xFFE5E7EB);
  static const Color hairline = Color(0xFFF3F4F6);
  static const Color primary = Color(0xFFFF6A00);
  static const Color save = Color(0xFF15803D);
  static const Color warn = Color(0xFFB45309);
  static const Color warnSoft = Color(0xFFFDF3E6);

  /// ---- The money colour ----
  ///
  /// Every price on the page is printed in it. A price set in the same ink as
  /// the product name is a price a scanning eye has to hunt for, and on a grid
  /// of forty tiles that hunt is the whole difference between browsing and
  /// giving up.
  ///
  /// #D62200 rather than a brighter red: white on it is 5.1:1, so the same
  /// value works as a ground under white button text AND as text on white at
  /// the 11px a card's price line runs at. The brighter reds do one or the
  /// other, never both.
  static const Color flame = Color(0xFFD62200);
}

class _KSpace {
  const _KSpace._();
  static const double sm = 8;
  static const double md = 12;
  static const double lg = 16;
  static const double xl = 24;
}

const double _rPanel = 12;
const double _rPhoto = 8;

/// The `Accept` header every photograph in this app is fetched with. See the
/// note in kandi_search_screen.dart — Dart's HTTP client sends none of its own,
/// so without this the storefront's optimiser has to guess and sends JPEG.
const Map<String, String> _kImageHeaders = <String, String>{
  'Accept': 'image/webp,image/*;q=0.8',
};
const double _rChip = 8;

/// The brand gradient: Kandi orange running into the deep red.
///
/// It carries the chrome — app bars, the home band, the primary buttons — so
/// that every screen is recognisably one shop. Horizontal rather than vertical
/// because an app bar is a wide, short box: a vertical ramp across 56px reads
/// as a flat muddy colour, where a horizontal one across the whole width
/// actually travels.
const LinearGradient _brandGradient = LinearGradient(
  begin: Alignment.centerLeft,
  end: Alignment.centerRight,
  colors: [Color(0xFFFF6A00), Color(0xFFD62200)],
);

/// Fully rounded. The primary calls to action are pills, which is what tells
/// them apart from the square panels they sit on.
const double _rPill = 999;
const String _apiBase = 'https://kandiug.com';

// The keys every page in this app agrees on.
const String _basketKey = 'kandi-cart-v1';
const String _checkoutKey = 'kandi-checkout-v1';

String _money(num amount) {
  final whole = amount.round().toString();
  final out = StringBuffer();
  for (int i = 0; i < whole.length; i++) {
    if (i > 0 && (whole.length - i) % 3 == 0) out.write(',');
    out.write(whole[i]);
  }
  return 'UGX $out';
}

class _KLine {
  const _KLine({
    required this.productId,
    required this.name,
    required this.price,
    required this.quantity,
    this.image = '',
    this.variantLabel,
  });

  final int productId;
  final String name;
  final num price;
  final int quantity;

  /// The photograph, as the basket stored it.
  ///
  /// Every page that writes a line writes an image with it, so this costs no
  /// request. It was being thrown away here, and a checkout summary set purely
  /// in text is the one screen in the app where a shopper cannot see what they
  /// are about to pay for — which is exactly the moment they want to check.
  final String image;
  final String? variantLabel;

  num get lineTotal => price * quantity;

  static _KLine? from(dynamic json) {
    if (json is! Map) return null;
    final id = json['productId'];
    final quantity = json['quantity'];
    if (id is! int || quantity is! int || quantity < 1) return null;
    return _KLine(
      productId: id,
      name: (json['name'] ?? '').toString(),
      price: json['price'] is num ? json['price'] as num : 0,
      quantity: quantity,
      image: (json['image'] ?? '').toString(),
      variantLabel: json['variantLabel']?.toString(),
    );
  }
}

class KandiCheckoutScreen extends StatefulWidget {
  const KandiCheckoutScreen({super.key, this.width, this.height});

  final double? width;
  final double? height;

  @override
  State<KandiCheckoutScreen> createState() => _KandiCheckoutScreenState();
}

class _KandiCheckoutScreenState extends State<KandiCheckoutScreen> {
  final TextEditingController _name = TextEditingController();
  final TextEditingController _phone = TextEditingController();
  final TextEditingController _town = TextEditingController();
  final TextEditingController _address = TextEditingController();

  List<_KLine> _lines = const [];
  bool _loading = true;
  bool _sending = false;
  num _freeDeliveryFrom = 0;
  int _returnsDays = 0;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _name.dispose();
    _phone.dispose();
    _town.dispose();
    _address.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    final lines = <_KLine>[];
    try {
      final prefs = await SharedPreferences.getInstance();

      final raw = prefs.getString(_basketKey);
      if (raw != null) {
        final decoded = jsonDecode(raw);
        if (decoded is List) {
          for (final entry in decoded) {
            final line = _KLine.from(entry);
            if (line != null) lines.add(line);
          }
        }
      }

      // Refill the details from last time, so an abandoned checkout does not
      // cost the shopper their name and their village a second time.
      final saved = prefs.getString(_checkoutKey);
      if (saved != null) {
        final decoded = jsonDecode(saved);
        if (decoded is Map) {
          _name.text = (decoded['name'] ?? '').toString();
          _phone.text = (decoded['phone'] ?? '').toString();
          _town.text = (decoded['town'] ?? '').toString();
          _address.text = (decoded['address'] ?? '').toString();
        }
      }
    } catch (_) {
      // Both are recoverable: an unreadable basket shows the empty state, and
      // unreadable details just mean typing them again.
    }

    if (!mounted) return;
    setState(() {
      _lines = lines;
      _loading = false;
    });

    _loadTerms();
  }

  /// The delivery threshold and returns window, for the summary.
  ///
  /// Read from the home feed rather than hard-coded, so this screen cannot
  /// promise a threshold the checkout does not apply.
  Future<void> _loadTerms() async {
    try {
      final response = await http
          .get(Uri.parse('$_apiBase/api/app/home'))
          .timeout(const Duration(seconds: 12));
      if (response.statusCode != 200) return;
      final data = jsonDecode(response.body);
      if (data is! Map) return;
      final commerce = data['commerce'];
      if (commerce is! Map) return;
      if (!mounted) return;
      setState(() {
        _freeDeliveryFrom = commerce['freeDeliveryFrom'] is num
            ? commerce['freeDeliveryFrom'] as num
            : 0;
        _returnsDays =
            commerce['returnsDays'] is int ? commerce['returnsDays'] as int : 0;
      });
    } catch (_) {
      // The summary simply omits the line. Not worth an error a shopper at
      // checkout cannot act on.
    }
  }

  num get _subtotal =>
      _lines.fold<num>(0, (total, line) => total + line.lineTotal);

  int get _count => _lines.fold<int>(0, (total, line) => total + line.quantity);

  /// Which required fields are still empty.
  ///
  /// Named rather than just disabling the button: a greyed button with no
  /// explanation is the most common way a shopper abandons a checkout.
  List<String> get _missing => [
        if (_name.text.trim().isEmpty) 'your name',
        if (_phone.text.trim().length < 9) 'a phone number',
        if (_town.text.trim().isEmpty) 'your town',
      ];

  Future<void> _persistDetails() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(
        _checkoutKey,
        jsonEncode({
          'name': _name.text.trim(),
          'phone': _phone.text.trim(),
          'town': _town.text.trim(),
          'address': _address.text.trim(),
        }),
      );
    } catch (_) {
      // Costs only the refill next time.
    }
  }

  Future<void> _placeOrder() async {
    if (_missing.isNotEmpty || _sending) return;
    setState(() => _sending = true);
    await _persistDetails();

    // The basket travels as a query string the website's checkout can read, so
    // the shopper does not rebuild it in the browser. Ids and quantities only —
    // prices are the server's to decide, and sending them from a phone would be
    // a figure the shop had to either trust or ignore.
    final basket = _lines
        .map((line) => '${line.productId}:${line.quantity}')
        .join(',');

    final uri = Uri.parse('$_apiBase/checkout').replace(queryParameters: {
      'app': '1',
      'items': basket,
      'name': _name.text.trim(),
      'phone': _phone.text.trim(),
      'town': _town.text.trim(),
      if (_address.text.trim().isNotEmpty) 'address': _address.text.trim(),
    });

    bool opened = false;
    try {
      opened = await launchUrl(uri, mode: LaunchMode.externalApplication);
    } catch (_) {
      opened = false;
    }

    if (!mounted) return;
    setState(() => _sending = false);

    if (!opened) {
      // Honest about what happened rather than pretending the order is placed.
      // A shopper who thinks they have paid and has not is the worst outcome
      // this screen can produce.
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Could not open checkout. Try again, or call the shop.'),
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: widget.width,
      height: widget.height,
      child: Scaffold(
        backgroundColor: _KColors.canvas,
        appBar: AppBar(
          backgroundColor: Colors.transparent,
          surfaceTintColor: Colors.transparent,
          elevation: 0,
          scrolledUnderElevation: 0,
          // The gradient goes behind the bar rather than in `backgroundColor`,
          // which only takes a flat colour. `flexibleSpace` fills the whole
          // bar including the status-bar strip above it, so the ramp starts at
          // the top of the screen and not under the clock.
          // SizedBox.expand is load-bearing. A childless DecoratedBox has
          // no size, and AppBar puts flexibleSpace in a Stack under loose
          // constraints — so the gradient painted nothing at all and every
          // sub-page had a white title on a white bar.
          flexibleSpace: const DecoratedBox(
            decoration: BoxDecoration(gradient: _brandGradient),
            child: SizedBox.expand(),
          ),
          systemOverlayStyle: SystemUiOverlayStyle.light,
          iconTheme: const IconThemeData(color: Colors.white),
          title: const Text('Checkout',
              style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w700,
                  color: Colors.white)),
        ),
        body: _buildBody(),
        bottomNavigationBar: _lines.isEmpty ? null : _buildBar(),
      ),
    );
  }

  Widget _buildBody() {
    if (_loading) {
      return const Center(
          child: CircularProgressIndicator(color: _KColors.primary));
    }

    if (_lines.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(_KSpace.xl),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.shopping_bag_outlined,
                  size: 44, color: _KColors.muted),
              const SizedBox(height: _KSpace.md),
              const Text('Your basket is empty',
                  style: TextStyle(
                      fontSize: 17,
                      fontWeight: FontWeight.w800,
                      color: _KColors.ink)),
              const SizedBox(height: _KSpace.sm),
              const Text('Add something before checking out.',
                  style: TextStyle(fontSize: 13.5, color: _KColors.body)),
              const SizedBox(height: _KSpace.lg),
              FilledButton(
                onPressed: () => Navigator.of(context).maybePop(),
                style: FilledButton.styleFrom(backgroundColor: _KColors.flame),
                child: const Text('Back to basket'),
              ),
            ],
          ),
        ),
      );
    }

    return ListView(
      padding: const EdgeInsets.all(_KSpace.md),
      children: [
        _panel(
          title: 'Delivery details',
          child: Column(
            children: [
              _Field(
                controller: _name,
                label: 'Full name',
                hint: 'The name on the delivery',
                icon: Icons.person_outline_rounded,
                onChanged: (_) => setState(() {}),
              ),
              const SizedBox(height: _KSpace.md),
              _Field(
                controller: _phone,
                label: 'Phone number',
                hint: '07XX XXX XXX',
                icon: Icons.phone_outlined,
                keyboardType: TextInputType.phone,
                onChanged: (_) => setState(() {}),
              ),
              const SizedBox(height: _KSpace.md),
              _Field(
                controller: _town,
                label: 'Town or city',
                hint: 'Kampala, Jinja, Mbarara…',
                icon: Icons.location_city_rounded,
                onChanged: (_) => setState(() {}),
              ),
              const SizedBox(height: _KSpace.md),
              _Field(
                controller: _address,
                label: 'Address or landmark (optional)',
                hint: 'What the courier should look for',
                icon: Icons.place_outlined,
                onChanged: (_) => setState(() {}),
              ),
            ],
          ),
        ),
        const SizedBox(height: _KSpace.md),
        _panel(
          title: 'Your order',
          child: Column(
            children: [
              for (final line in _lines)
                Padding(
                  padding: const EdgeInsets.only(bottom: _KSpace.sm),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // The photograph, with the quantity riding its corner.
                      // A separate "2×" column was costing a line of width on
                      // every row to say something the badge says in the space
                      // the picture was already taking.
                      Stack(
                        children: [
                          ClipRRect(
                            borderRadius: BorderRadius.circular(_rPhoto),
                            child: Container(
                              width: 44,
                              height: 44,
                              color: _KColors.hairline,
                              child: line.image.isEmpty
                                  ? const Icon(
                                      Icons.image_not_supported_outlined,
                                      size: 16,
                                      color: _KColors.muted)
                                  : CachedNetworkImage(
                                      imageUrl: line.image,
                                      httpHeaders: _kImageHeaders,
                                      // Contain, never cover: a supplier
                                      // photograph cropped to 44px loses the
                                      // product and keeps its background.
                                      fit: BoxFit.contain,
                                      placeholder: (_, __) => const ColoredBox(
                                          color: _KColors.hairline),
                                      errorWidget: (_, __, ___) =>
                                          const ColoredBox(
                                              color: _KColors.hairline),
                                    ),
                            ),
                          ),
                          if (line.quantity > 1)
                            Positioned(
                              right: 0,
                              top: 0,
                              child: Container(
                                padding: const EdgeInsets.symmetric(
                                    horizontal: 5, vertical: 1),
                                decoration: BoxDecoration(
                                  color: _KColors.ink,
                                  borderRadius: BorderRadius.circular(_rPill),
                                ),
                                child: Text('${line.quantity}',
                                    style: const TextStyle(
                                        fontSize: 10,
                                        fontWeight: FontWeight.w800,
                                        color: Colors.white)),
                              ),
                            ),
                        ],
                      ),
                      const SizedBox(width: _KSpace.md),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(line.name,
                                maxLines: 2,
                                overflow: TextOverflow.ellipsis,
                                style: const TextStyle(
                                    fontSize: 13,
                                    height: 1.35,
                                    color: _KColors.ink)),
                            if (line.variantLabel != null &&
                                line.variantLabel!.isNotEmpty)
                              Text(line.variantLabel!,
                                  style: const TextStyle(
                                      fontSize: 11.5, color: _KColors.muted)),
                          ],
                        ),
                      ),
                      const SizedBox(width: _KSpace.sm),
                      Text(_money(line.lineTotal),
                          style: const TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w700,
                              color: _KColors.ink)),
                    ],
                  ),
                ),
              const Divider(color: _KColors.line, height: _KSpace.lg),
              Row(
                children: [
                  Text('Subtotal · $_count ${_count == 1 ? 'item' : 'items'}',
                      style: const TextStyle(
                          fontSize: 13.5, color: _KColors.muted)),
                  const Spacer(),
                  Text(_money(_subtotal),
                      style: const TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w800,
                          color: _KColors.ink)),
                ],
              ),
              const SizedBox(height: 4),
              Row(
                children: [
                  const Text('Delivery',
                      style: TextStyle(fontSize: 13.5, color: _KColors.muted)),
                  const Spacer(),
                  Text(
                    _freeDeliveryFrom > 0 && _subtotal >= _freeDeliveryFrom
                        ? 'Free'
                        : 'Calculated at payment',
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight:
                          _subtotal >= _freeDeliveryFrom && _freeDeliveryFrom > 0
                              ? FontWeight.w700
                              : FontWeight.w400,
                      color:
                          _subtotal >= _freeDeliveryFrom && _freeDeliveryFrom > 0
                              ? _KColors.save
                              : _KColors.muted,
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
        const SizedBox(height: _KSpace.md),
        // Said before the shopper taps, not after. Being handed to a browser is
        // surprising if it is not announced, and a surprise at payment is where
        // orders are lost.
        Container(
          padding: const EdgeInsets.all(_KSpace.md),
          decoration: BoxDecoration(
            color: _KColors.warnSoft,
            borderRadius: BorderRadius.circular(_rPanel),
          ),
          child: const Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(Icons.open_in_new_rounded, size: 18, color: _KColors.warn),
              SizedBox(width: _KSpace.sm),
              Expanded(
                child: Text(
                  'Payment opens on kandiug.com, where cash on delivery, MTN MoMo, Airtel Money and cards are all accepted. Your basket and details go with you.',
                  style: TextStyle(
                      fontSize: 12.5, height: 1.45, color: _KColors.warn),
                ),
              ),
            ],
          ),
        ),
        if (_returnsDays > 0) ...[
          const SizedBox(height: _KSpace.md),
          Row(
            children: [
              const Icon(Icons.verified_outlined, size: 16, color: _KColors.save),
              const SizedBox(width: 6),
              Text('$_returnsDays-day returns on everything',
                  style: const TextStyle(fontSize: 12.5, color: _KColors.body)),
            ],
          ),
        ],
        const SizedBox(height: _KSpace.xl),
      ],
    );
  }

  Widget _panel({required String title, required Widget child}) {
    return Container(
      padding: const EdgeInsets.all(_KSpace.lg),
      decoration: BoxDecoration(
        color: _KColors.panel,
        borderRadius: BorderRadius.circular(_rPanel),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // The same heading the shelves on Home carry: a short bar of the
          // brand gradient, then the title. It costs three pixels of width and
          // it is what makes a panel on this page read as part of the same shop
          // as the screen the shopper arrived from.
          Row(
            children: [
              Container(
                width: 3,
                height: 15,
                decoration: BoxDecoration(
                  gradient: _brandGradient,
                  borderRadius: BorderRadius.circular(_rPill),
                ),
              ),
              const SizedBox(width: _KSpace.sm),
              Text(title,
                  style: const TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w800,
                      color: _KColors.ink)),
            ],
          ),
          const SizedBox(height: _KSpace.md),
          child,
        ],
      ),
    );
  }

  Widget _buildBar() {
    final missing = _missing;
    return Container(
      padding: EdgeInsets.fromLTRB(
        _KSpace.lg,
        _KSpace.md,
        _KSpace.lg,
        // Clears the home indicator on a gesture-navigation phone.
        _KSpace.md + MediaQuery.of(context).padding.bottom,
      ),
      decoration: const BoxDecoration(
        color: _KColors.panel,
        border: Border(top: BorderSide(color: _KColors.line)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (missing.isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(bottom: _KSpace.sm),
              child: Text('Add ${missing.join(', ')} to continue',
                  style: const TextStyle(fontSize: 12, color: _KColors.muted)),
            ),
          _GradientButton(
            label: _sending
                ? 'Opening…'
                : 'Continue to payment · ${_money(_subtotal)}',
            enabled: missing.isEmpty && !_sending,
            onTap: _placeOrder,
          ),
        ],
      ),
    );
  }
}

class _Field extends StatelessWidget {
  const _Field({
    required this.controller,
    required this.label,
    required this.hint,
    required this.icon,
    required this.onChanged,
    this.keyboardType,
  });

  final TextEditingController controller;
  final String label;
  final String hint;
  final IconData icon;
  final ValueChanged<String> onChanged;
  final TextInputType? keyboardType;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label,
            style: const TextStyle(
                fontSize: 12.5,
                fontWeight: FontWeight.w600,
                color: _KColors.body)),
        const SizedBox(height: 5),
        TextField(
          controller: controller,
          onChanged: onChanged,
          keyboardType: keyboardType,
          style: const TextStyle(fontSize: 14.5, color: _KColors.ink),
          decoration: InputDecoration(
            isDense: true,
            filled: true,
            fillColor: _KColors.hairline,
            hintText: hint,
            hintStyle: const TextStyle(fontSize: 14, color: _KColors.muted),
            prefixIcon: Icon(icon, size: 19, color: _KColors.muted),
            contentPadding: const EdgeInsets.symmetric(
                horizontal: _KSpace.md, vertical: _KSpace.md),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(_rChip),
              borderSide: BorderSide.none,
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(_rChip),
              borderSide: const BorderSide(color: _KColors.flame, width: 1.4),
            ),
          ),
        ),
      ],
    );
  }
}

/// The primary call to action: a gradient pill, full width.
///
/// Duplicated from the basket rather than shared. Every page here carries its
/// own copy of everything it draws; a shared widget would be the one import
/// that reintroduces the paste-order problem the architecture exists to avoid.
class _GradientButton extends StatelessWidget {
  const _GradientButton({
    required this.label,
    required this.enabled,
    required this.onTap,
  });

  final String label;
  final bool enabled;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      height: 50,
      decoration: BoxDecoration(
        gradient: enabled ? _brandGradient : null,
        color: enabled ? null : _KColors.line,
        borderRadius: BorderRadius.circular(_rPill),
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: enabled ? onTap : null,
          borderRadius: BorderRadius.circular(_rPill),
          child: Center(
            child: Text(
              label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                  fontSize: 15.5,
                  fontWeight: FontWeight.w800,
                  color: enabled ? Colors.white : _KColors.muted),
            ),
          ),
        ),
      ),
    );
  }
}
