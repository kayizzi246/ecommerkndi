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
//  KANDI — SELLER PRODUCTS
//
//  A trader's stock: what is live, what is waiting for
//  approval, and what has run out.
//
//  Self-contained like every page here; the architecture is at
//  the head of kandi_home_screen.dart.
//
//  ---- Read here, edit on the website ----
//
//  This lists and it does not edit. Changing a price, swapping
//  a photograph or adding a variation needs a real form, a
//  media picker and a variations table; a cramped version of
//  that on a phone is how a seller publishes at the wrong
//  price, and a wrong price on a marketplace is a loss the
//  trader eats.
//
//  What the list IS for is the question a trader opens their
//  phone to ask: has anything run out. That is a read, it is
//  urgent, and it is answered here — out of stock first,
//  because it is the only row that needs acting on today.
// ============================================================

class _KColors {
  const _KColors._();
  static const Color canvas = Color(0xFFF5F5F5);
  static const Color panel = Color(0xFFFFFFFF);
  static const Color ink = Color(0xFF111827);
  static const Color body = Color(0xFF4B5563);
  static const Color muted = Color(0xFF6B7280);
  static const Color faint = Color(0xFF9CA3AF);
  static const Color line = Color(0xFFE5E7EB);
  static const Color hairline = Color(0xFFF3F4F6);
  static const Color primary = Color(0xFFFF6A00);
  static const Color primarySoft = Color(0xFFFFF3E8);
  static const Color save = Color(0xFF15803D);
  static const Color saveSoft = Color(0xFFECFDF3);
  static const Color warn = Color(0xFFB45309);
  static const Color warnSoft = Color(0xFFFDF3E6);
  static const Color info = Color(0xFF1A56C4);
  static const Color infoSoft = Color(0xFFEAF1FD);

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
  static const Color flameSoft = Color(0xFFFFF1ED);
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
const String _sellerAuthKey = 'kandi-seller-auth-v1';

String _money(num amount) {
  final whole = amount.round().toString();
  final out = StringBuffer();
  for (int i = 0; i < whole.length; i++) {
    if (i > 0 && (whole.length - i) % 3 == 0) out.write(',');
    out.write(whole[i]);
  }
  return 'UGX $out';
}

class _KProduct {
  const _KProduct({
    required this.id,
    required this.name,
    required this.sku,
    required this.status,
    required this.price,
    required this.stockStatus,
    required this.stockQuantity,
    required this.image,
    required this.unitsSold,
  });

  final int id;
  final String name;
  final String sku;

  /// `publish`, `pending` or `draft`.
  final String status;
  final num price;

  /// `instock`, `outofstock` or `onbackorder`.
  final String stockStatus;
  final int? stockQuantity;
  final String image;
  final int unitsSold;

  bool get isOut => stockStatus == 'outofstock';
  bool get isPending => status == 'pending';

  /// How urgently this row wants attention. Lower sorts first.
  ///
  /// Out of stock leads because it is the only state costing the trader money
  /// right now — a live listing nobody can buy. Pending follows: it is waiting
  /// on Kandi rather than on them, but they should know. Everything else is
  /// working and can sit below.
  int get urgency {
    if (isOut) return 0;
    if (isPending) return 1;
    return 2;
  }

  static _KProduct? from(dynamic json) {
    if (json is! Map) return null;
    final id = json['id'];
    if (id is! int) return null;
    return _KProduct(
      id: id,
      name: (json['name'] ?? '').toString(),
      sku: (json['sku'] ?? '').toString(),
      status: (json['status'] ?? 'publish').toString(),
      price: json['price'] is num ? json['price'] as num : 0,
      stockStatus: (json['stock_status'] ?? 'instock').toString(),
      stockQuantity:
          json['stock_quantity'] is int ? json['stock_quantity'] as int : null,
      image: (json['image'] ?? '').toString(),
      unitsSold: json['units_sold'] is int ? json['units_sold'] as int : 0,
    );
  }

  static List<_KProduct> listFrom(dynamic json) {
    final list = json is Map && json['products'] is List
        ? json['products'] as List
        : (json is List ? json : const []);
    return list.map(_KProduct.from).whereType<_KProduct>().toList();
  }
}

class KandiSellerProductsScreen extends StatefulWidget {
  const KandiSellerProductsScreen({super.key, this.width, this.height});

  final double? width;
  final double? height;

  @override
  State<KandiSellerProductsScreen> createState() =>
      _KandiSellerProductsScreenState();
}

class _KandiSellerProductsScreenState
    extends State<KandiSellerProductsScreen> {
  static const List<({String key, String label})> _filters = [
    (key: 'all', label: 'All'),
    (key: 'outofstock', label: 'Out of stock'),
    (key: 'pending', label: 'Pending'),
  ];

  bool _loading = true;
  bool _signedOut = false;
  bool _failed = false;
  String _filter = 'all';
  List<_KProduct> _products = const [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    if (mounted) setState(() => _loading = true);

    String? token;
    try {
      final prefs = await SharedPreferences.getInstance();
      token = prefs.getString(_sellerAuthKey);
    } catch (_) {
      token = null;
    }

    if (token == null || token.isEmpty) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _signedOut = true;
      });
      return;
    }

    dynamic data;
    int status = 0;
    try {
      final response = await http.get(
        Uri.parse('$_apiBase/api/app/seller/products'),
        headers: {'Authorization': 'Bearer $token'},
      ).timeout(const Duration(seconds: 20));
      status = response.statusCode;
      data = jsonDecode(response.body);
    } catch (_) {
      status = 0;
    }

    if (!mounted) return;

    if (status == 401 || status == 403) {
      try {
        final prefs = await SharedPreferences.getInstance();
        await prefs.remove(_sellerAuthKey);
      } catch (_) {}
      if (!mounted) return;
      setState(() {
        _loading = false;
        _signedOut = true;
      });
      return;
    }

    if (status != 200) {
      setState(() {
        _loading = false;
        _failed = true;
      });
      return;
    }

    final products = _KProduct.listFrom(data);
    // Sorted here rather than asked for in the request: the endpoint returns
    // the trader's whole catalogue in one go and has no ordering parameter, and
    // sorting a list already in hand is free. Urgency first, then by what sells.
    products.sort((a, b) {
      final byUrgency = a.urgency.compareTo(b.urgency);
      if (byUrgency != 0) return byUrgency;
      return b.unitsSold.compareTo(a.unitsSold);
    });

    setState(() {
      _loading = false;
      _failed = false;
      _products = products;
    });
  }

  List<_KProduct> get _visible {
    if (_filter == 'outofstock') {
      return _products.where((product) => product.isOut).toList();
    }
    if (_filter == 'pending') {
      return _products.where((product) => product.isPending).toList();
    }
    return _products;
  }

  Future<void> _openWeb(String path) async {
    try {
      final opened = await launchUrl(Uri.parse('$_apiBase$path'),
          mode: LaunchMode.externalApplication);
      if (opened || !mounted) return;
    } catch (_) {
      if (!mounted) return;
    }
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('Could not open the browser.'),
        behavior: SnackBarBehavior.floating,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final outCount = _products.where((product) => product.isOut).length;

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
          title: const Text('My products',
              style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w700,
                  color: Colors.white)),
          actions: [
            IconButton(
              onPressed: () => _openWeb('/seller/products/new'),
              tooltip: 'Add a product',
              icon: const Icon(Icons.add_rounded, color: Colors.white),
            ),
          ],
        ),
        body: _buildBody(outCount),
      ),
    );
  }

  Widget _buildBody(int outCount) {
    if (_loading) {
      return const Center(
          child: CircularProgressIndicator(color: _KColors.primary));
    }

    if (_signedOut) {
      return _message(
        icon: Icons.lock_outline_rounded,
        title: 'Your seller session ended',
        message: 'Sign in again from the Seller Centre to see your stock.',
        actionLabel: 'Back',
        onAction: () => Navigator.of(context).maybePop(),
      );
    }

    if (_failed) {
      return _message(
        icon: Icons.wifi_off_rounded,
        title: 'Could not load your products',
        message: 'Check your connection and try again.',
        actionLabel: 'Try again',
        onAction: _load,
      );
    }

    if (_products.isEmpty) {
      return _message(
        icon: Icons.inventory_2_outlined,
        title: 'Nothing listed yet',
        message:
            'Add your first product on the website — it needs photographs and a price, which is a job for a bigger screen.',
        actionLabel: 'Add a product',
        onAction: () => _openWeb('/seller/products/new'),
      );
    }

    final visible = _visible;

    return Column(
      children: [
        // The one thing worth interrupting a trader for. Drawn only when it is
        // real, and it is a shortcut as well as a warning.
        if (outCount > 0 && _filter != 'outofstock')
          GestureDetector(
            onTap: () => setState(() => _filter = 'outofstock'),
            child: Container(
              width: double.infinity,
              margin: const EdgeInsets.fromLTRB(
                  _KSpace.md, _KSpace.md, _KSpace.md, 0),
              padding: const EdgeInsets.all(_KSpace.md),
              decoration: BoxDecoration(
                color: _KColors.warnSoft,
                borderRadius: BorderRadius.circular(_rChip),
              ),
              child: Row(
                children: [
                  const Icon(Icons.error_outline_rounded,
                      size: 18, color: _KColors.warn),
                  const SizedBox(width: _KSpace.sm),
                  Expanded(
                    child: Text(
                      '$outCount ${outCount == 1 ? 'product is' : 'products are'} out of stock',
                      style: const TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w700,
                          color: _KColors.warn),
                    ),
                  ),
                  const Icon(Icons.chevron_right_rounded,
                      size: 19, color: _KColors.warn),
                ],
              ),
            ),
          ),
        SizedBox(
          height: 52,
          child: ListView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(
                horizontal: _KSpace.md, vertical: _KSpace.sm),
            children: [
              for (final option in _filters)
                Padding(
                  padding: const EdgeInsets.only(right: _KSpace.sm),
                  child: GestureDetector(
                    onTap: () => setState(() => _filter = option.key),
                    child: Container(
                      alignment: Alignment.center,
                      padding:
                          const EdgeInsets.symmetric(horizontal: _KSpace.lg),
                      decoration: BoxDecoration(
                        color: _filter == option.key
                            ? _KColors.flameSoft
                            : _KColors.panel,
                        // A pill, like every other filter in the app.
                        borderRadius: BorderRadius.circular(_rPill),
                        border: Border.all(
                            color: _filter == option.key
                                ? _KColors.flame
                                : _KColors.line,
                            width: _filter == option.key ? 1.5 : 1),
                      ),
                      child: Text(option.label,
                          style: TextStyle(
                              fontSize: 13,
                              fontWeight: _filter == option.key
                                  ? FontWeight.w700
                                  : FontWeight.w500,
                              color: _KColors.ink)),
                    ),
                  ),
                ),
            ],
          ),
        ),
        Expanded(
          child: visible.isEmpty
              ? _message(
                  icon: Icons.check_circle_outline_rounded,
                  title: 'Nothing here',
                  message: _filter == 'outofstock'
                      ? 'Everything you list is in stock.'
                      : 'Nothing is waiting for approval.',
                  actionLabel: 'Show all',
                  onAction: () => setState(() => _filter = 'all'),
                )
              : RefreshIndicator(
                  color: _KColors.primary,
                  onRefresh: _load,
                  child: ListView.separated(
                    padding: const EdgeInsets.fromLTRB(
                        _KSpace.md, 0, _KSpace.md, _KSpace.xl),
                    itemCount: visible.length,
                    separatorBuilder: (_, __) =>
                        const SizedBox(height: _KSpace.md),
                    itemBuilder: (context, index) => _row(visible[index]),
                  ),
                ),
        ),
      ],
    );
  }

  Widget _row(_KProduct product) {
    return Container(
      padding: const EdgeInsets.all(_KSpace.md),
      decoration: BoxDecoration(
        color: _KColors.panel,
        borderRadius: BorderRadius.circular(_rPanel),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(_rPhoto),
            child: SizedBox(
              width: 72,
              height: 72,
              child: product.image.isEmpty
                  ? const ColoredBox(
                      color: _KColors.hairline,
                      child: Icon(Icons.image_not_supported_outlined,
                          size: 20, color: _KColors.faint))
                  : CachedNetworkImage(
                      imageUrl: product.image,
                      fit: BoxFit.contain,
                      placeholder: (_, __) =>
                          const ColoredBox(color: _KColors.hairline),
                      errorWidget: (_, __, ___) =>
                          const ColoredBox(color: _KColors.hairline),
                    ),
            ),
          ),
          const SizedBox(width: _KSpace.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(product.name,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                        fontSize: 13.5, height: 1.35, color: _KColors.ink)),
                const SizedBox(height: 5),
                Row(
                  children: [
                    Text(_money(product.price),
                        style: const TextStyle(
                            fontSize: 14.5,
                            fontWeight: FontWeight.w800,
                            color: _KColors.ink)),
                    if (product.unitsSold > 0) ...[
                      const SizedBox(width: _KSpace.sm),
                      Text('${product.unitsSold} sold',
                          style: const TextStyle(
                              fontSize: 11.5, color: _KColors.muted)),
                    ],
                  ],
                ),
                const SizedBox(height: 6),
                Wrap(
                  spacing: 6,
                  runSpacing: 4,
                  children: [
                    if (product.isOut)
                      _chip('Out of stock', _KColors.warn, _KColors.warnSoft)
                    else if (product.stockQuantity != null)
                      _chip('${product.stockQuantity} in stock', _KColors.save,
                          _KColors.saveSoft)
                    else
                      _chip('In stock', _KColors.save, _KColors.saveSoft),
                    if (product.isPending)
                      _chip('Awaiting approval', _KColors.info,
                          _KColors.infoSoft),
                    if (product.sku.isNotEmpty)
                      _chip(product.sku, _KColors.muted, _KColors.hairline),
                  ],
                ),
              ],
            ),
          ),
          // Editing opens the website. See the note at the head of this file
          // for why a price form does not belong on a phone.
          IconButton(
            onPressed: () => _openWeb('/seller/products'),
            tooltip: 'Edit on the website',
            visualDensity: VisualDensity.compact,
            icon: const Icon(Icons.open_in_new_rounded,
                size: 18, color: _KColors.muted),
          ),
        ],
      ),
    );
  }

  Widget _chip(String label, Color tone, Color toneSoft) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
      decoration: BoxDecoration(
        color: toneSoft,
        borderRadius: BorderRadius.circular(5),
      ),
      child: Text(label,
          style: TextStyle(
              fontSize: 10.5, fontWeight: FontWeight.w700, color: tone)),
    );
  }

  Widget _message({
    required IconData icon,
    required String title,
    required String message,
    required String actionLabel,
    required VoidCallback onAction,
  }) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(_KSpace.xl),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 72,
              height: 72,
              decoration: const BoxDecoration(
                  color: _KColors.primarySoft, shape: BoxShape.circle),
              child: Icon(icon, size: 32, color: _KColors.primary),
            ),
            const SizedBox(height: _KSpace.lg),
            Text(title,
                textAlign: TextAlign.center,
                style: const TextStyle(
                    fontSize: 17,
                    fontWeight: FontWeight.w800,
                    color: _KColors.ink)),
            const SizedBox(height: _KSpace.sm),
            Text(message,
                textAlign: TextAlign.center,
                style: const TextStyle(
                    fontSize: 13.5, height: 1.5, color: _KColors.body)),
            const SizedBox(height: _KSpace.lg),
            SizedBox(
              width: 220,
              height: 46,
              child: FilledButton(
                onPressed: onAction,
                style: FilledButton.styleFrom(
                  backgroundColor: _KColors.flame,
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(_rPill)),
                ),
                child: Text(actionLabel,
                    style: const TextStyle(
                        fontSize: 14.5, fontWeight: FontWeight.w700)),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
