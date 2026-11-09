// Automatic FlutterFlow imports
import '/flutter_flow/flutter_flow_theme.dart';
import '/flutter_flow/flutter_flow_util.dart';
import '/custom_code/widgets/index.dart'; // Imports other custom widgets
import '/flutter_flow/custom_functions.dart'; // Imports custom functions
import 'package:flutter/material.dart';
// Begin custom widget code
// DO NOT REMOVE OR MODIFY THE CODE ABOVE!


// ============================================================
//  KANDI — ADDRESS PICKER
//  The shopper's saved delivery addresses (Supabase
//  `addresses`), and a form to add one. The area is searched
//  with the website's place search, so delivery is priced from
//  the real spot. Choosing one saves its id under
//  `kandi-address-id` and returns to checkout.
// ============================================================

import 'dart:async';
import 'dart:convert';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
// Supabase comes through FlutterFlow's own file (Settings > Integrations > Supabase must be on).
import '/backend/supabase/supabase.dart';
// Google sign-in comes through FlutterFlow's auth (Settings > Authentication > Supabase, Google on).
import '/auth/supabase_auth/auth_util.dart';

// Other Kandi screens are reached through '/custom_code/widgets/index.dart' above.

class KandiAddressPickerScreen extends StatefulWidget {
  const KandiAddressPickerScreen({super.key, this.width, this.height});
  final double? width;
  final double? height;

  @override
  State<KandiAddressPickerScreen> createState() => _KandiAddressPickerScreenState();
}

class _KandiAddressPickerScreenState extends State<KandiAddressPickerScreen> {
  List<Map<String, dynamic>> _addresses = [];
  String? _selected;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    // Let the first frame build: the sign-in sheet cannot open from initState.
    await Future<void>.delayed(Duration.zero);
    if (!mounted) return;
    if (!_KAuth.signedIn) {
      final ok = await _KAuth.ensure(context, reason: 'Sign in to save addresses');
      if (!ok) {
        if (mounted) Navigator.of(context).pop();
        return;
      }
    }
    final prefs = await SharedPreferences.getInstance();
    List<Map<String, dynamic>> rows = [];
    try {
      final data = await _KWoo.get('/addresses');
      rows = ((data is Map ? data['addresses'] : null) as List? ?? const [])
          .map((row) => Map<String, dynamic>.from(row as Map))
          .toList();
    } catch (e) {
      if (mounted) _kToast(context, _KWoo.message(e));
    }
    if (!mounted) return;
    setState(() {
      _addresses = rows;
      _selected = prefs.getString(_KKeys.address);
      _loading = false;
    });
  }

  Future<void> _choose(Map<String, dynamic> address) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_KKeys.address, address['id'] as String);
    if (mounted) Navigator.of(context).pop(true);
  }

  Future<void> _edit([Map<String, dynamic>? address]) async {
    final saved = await showModalBottomSheet<Map<String, dynamic>>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _AddressForm(existing: address),
    );
    if (saved != null) {
      await _load();
      if (address == null) await _choose(saved);
    }
  }

  Future<void> _delete(Map<String, dynamic> address) async {
    try {
      await _KWoo.delete('/addresses/${address['id']}');
    } catch (e) {
      if (mounted) _kToast(context, _KWoo.message(e));
    }
    await _load();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: _KColors.ground,
      appBar: AppBar(
        backgroundColor: _KColors.white,
        foregroundColor: _KColors.ink,
        elevation: 0,
        title: const Text('Delivery address', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 20)),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: _KColors.ink))
          : ListView(
              padding: const EdgeInsets.all(12),
              children: [
                for (final address in _addresses)
                  Container(
                    margin: const EdgeInsets.only(bottom: 10),
                    decoration: BoxDecoration(
                      color: _KColors.white,
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(
                        color: address['id'] == _selected ? _KColors.ink : Colors.transparent,
                        width: 2,
                      ),
                    ),
                    child: InkWell(
                      borderRadius: BorderRadius.circular(16),
                      onTap: () => _choose(address),
                      child: Padding(
                        padding: const EdgeInsets.fromLTRB(14, 12, 4, 12),
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Icon(
                              address['id'] == _selected ? Icons.radio_button_checked : Icons.radio_button_off,
                              color: _KColors.ink,
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Row(
                                    children: [
                                      Text('${address['label']}',
                                          style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w900)),
                                      if (address['lat'] != null) ...[
                                        const SizedBox(width: 6),
                                        const Icon(Icons.location_on_rounded, size: 16, color: _KColors.green),
                                      ],
                                    ],
                                  ),
                                  const SizedBox(height: 2),
                                  Text('${address['recipient']} · ${address['phone']}',
                                      style: const TextStyle(fontSize: 13, color: _KColors.body)),
                                  Text(
                                    [address['street'], address['area'], address['city']]
                                        .where((part) => part != null && '$part'.isNotEmpty)
                                        .join(', '),
                                    style: const TextStyle(fontSize: 13, color: _KColors.muted),
                                  ),
                                ],
                              ),
                            ),
                            PopupMenuButton<String>(
                              onSelected: (value) => value == 'edit' ? _edit(address) : _delete(address),
                              itemBuilder: (_) => const [
                                PopupMenuItem(value: 'edit', child: Text('Edit')),
                                PopupMenuItem(value: 'delete', child: Text('Delete')),
                              ],
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                const SizedBox(height: 6),
                _KButton(label: 'Add a new address', icon: Icons.add_location_alt_outlined, outline: true, onPressed: () => _edit()),
              ],
            ),
    );
  }
}

class _AddressForm extends StatefulWidget {
  const _AddressForm({this.existing});
  final Map<String, dynamic>? existing;
  @override
  State<_AddressForm> createState() => _AddressFormState();
}

class _AddressFormState extends State<_AddressForm> {
  late final _label = TextEditingController(text: '${widget.existing?['label'] ?? 'Home'}');
  late final _recipient = TextEditingController(text: '${widget.existing?['recipient'] ?? ''}');
  late final _phone = TextEditingController(
      text: '${widget.existing?['phone'] ?? (_KAuth.user?.phone ?? '').replaceFirst(RegExp(r'^\+?256'), '0')}');
  late final _area = TextEditingController(text: '${widget.existing?['area'] ?? ''}');
  late final _street = TextEditingController(text: '${widget.existing?['street'] ?? ''}');
  late final _landmark = TextEditingController(text: '${widget.existing?['landmark'] ?? ''}');
  late String _city = '${widget.existing?['city'] ?? 'Kampala'}';
  late double? _lat = (widget.existing?['lat'] as num?)?.toDouble();
  late double? _lng = (widget.existing?['lng'] as num?)?.toDouble();

  List<Map<String, dynamic>> _places = [];
  Timer? _debounce;
  bool _saving = false;
  String? _error;

  @override
  void dispose() {
    _debounce?.cancel();
    super.dispose();
  }

  void _searchPlaces(String text) {
    _lat = null;
    _lng = null;
    _debounce?.cancel();
    if (text.trim().length < 3) {
      setState(() => _places = []);
      return;
    }
    _debounce = Timer(const Duration(milliseconds: 350), () async {
      try {
        final response = await http
            .get(Uri.parse('$_kSiteUrl/api/delivery/suggest').replace(queryParameters: {'q': text.trim()}))
            .timeout(const Duration(seconds: 10));
        final data = jsonDecode(response.body);
        if (!mounted) return;
        setState(() => _places = ((data['places'] as List?) ?? const []).cast<Map<String, dynamic>>());
      } catch (_) {}
    });
  }

  /// Picks a suggestion. When it came without coordinates, the website's
  /// delivery quote looks them up (one lookup, at the moment of choosing).
  Future<void> _pick(Map<String, dynamic> place) async {
    final label = '${place['label'] ?? ''}';
    setState(() {
      _area.text = label.split(',').first.trim();
      _places = [];
      final parts = label.split(',');
      if (parts.length > 1) _city = parts[1].trim();
    });
    final point = place['point'];
    if (point is Map && point['lat'] is num) {
      _lat = (point['lat'] as num).toDouble();
      _lng = (point['lng'] as num).toDouble();
      return;
    }
    try {
      final response = await http.post(
        Uri.parse('$_kSiteUrl/api/delivery/quote'),
        headers: const {'Content-Type': 'application/json'},
        body: jsonEncode({'subtotal': 0, 'address': label}),
      );
      final data = jsonDecode(response.body);
      if (data['point'] is Map) {
        _lat = (data['point']['lat'] as num?)?.toDouble();
        _lng = (data['point']['lng'] as num?)?.toDouble();
      }
    } catch (_) {}
  }

  Future<void> _save() async {
    final phone = _KAuth.ugPhone(_phone.text);
    if (_recipient.text.trim().isEmpty || _street.text.trim().isEmpty || _area.text.trim().isEmpty) {
      setState(() => _error = 'Fill in the name, area and street.');
      return;
    }
    if (phone == null) {
      setState(() => _error = 'Enter a Ugandan mobile number the rider can call.');
      return;
    }
    setState(() {
      _saving = true;
      _error = null;
    });
    final row = <String, dynamic>{
      if (widget.existing != null) 'id': widget.existing!['id'],
      'label': _label.text.trim().isEmpty ? 'Home' : _label.text.trim(),
      'recipient': _recipient.text.trim(),
      'phone': phone,
      'area': _area.text.trim(),
      'street': _street.text.trim(),
      'landmark': _landmark.text.trim(),
      'city': _city.isEmpty ? 'Kampala' : _city,
      'lat': _lat,
      'lng': _lng,
    };
    try {
      final data = await _KWoo.post('/addresses', row);
      final saved = Map<String, dynamic>.from((data as Map)['address'] as Map);
      if (mounted) Navigator.of(context).pop(saved);
    } catch (e) {
      if (mounted) {
        setState(() {
          _saving = false;
          _error = _KWoo.message(e);
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
      child: Container(
        constraints: BoxConstraints(maxHeight: MediaQuery.of(context).size.height * 0.92),
        decoration: const BoxDecoration(
          color: _KColors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
        ),
        child: SafeArea(
          top: false,
          child: ListView(
            shrinkWrap: true,
            padding: const EdgeInsets.fromLTRB(20, 20, 20, 20),
            children: [
              Text(widget.existing == null ? 'New address' : 'Edit address',
                  style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w900)),
              const SizedBox(height: 16),
              _KField(controller: _recipient, label: 'Name of the person receiving'),
              const SizedBox(height: 12),
              _KField(controller: _phone, label: 'Their phone', hint: '0772 123 456', keyboard: TextInputType.phone),
              const SizedBox(height: 12),
              _KField(controller: _area, label: 'Area', hint: 'Start typing: Ntinda, Kira, Mukono…', onChanged: _searchPlaces),
              if (_places.isNotEmpty)
                Container(
                  margin: const EdgeInsets.only(top: 6),
                  decoration: BoxDecoration(border: Border.all(color: _KColors.line), borderRadius: BorderRadius.circular(14)),
                  child: Column(
                    children: [
                      for (final place in _places)
                        ListTile(
                          dense: true,
                          leading: const Icon(Icons.place_outlined),
                          title: Text('${place['label']}'),
                          onTap: () => _pick(place),
                        ),
                    ],
                  ),
                ),
              const SizedBox(height: 12),
              _KField(controller: _street, label: 'Street, building or house', hint: 'Plot 12, Kira Road'),
              const SizedBox(height: 12),
              _KField(controller: _landmark, label: 'Landmark (optional)', hint: 'Opposite the Shell station'),
              const SizedBox(height: 12),
              _KField(controller: _label, label: 'Save as', hint: 'Home, Work…'),
              if (_error != null) ...[
                const SizedBox(height: 12),
                Text(_error!, style: const TextStyle(color: _KColors.sale, fontWeight: FontWeight.w700)),
              ],
              const SizedBox(height: 18),
              _KButton(label: 'Save address', busy: _saving, onPressed: _save),
            ],
          ),
        ),
      ),
    );
  }
}

// ============================================================
//  Shared building blocks, private to this file
//  (the same in every Kandi screen; change one, change all)
// ============================================================

/// The website: delivery quotes, place search and Pesapal.
const String _kSiteUrl = 'https://kandiug.com';

/// Support line shown on Account.
const String _kSupportPhone = '0704892253';

// ------------------------------------------------------------
//  Colours and type
// ------------------------------------------------------------

class _KColors {
  static const ink = Color(0xFF111111);
  static const body = Color(0xFF3A3A3A);
  static const muted = Color(0xFF767676);
  static const line = Color(0xFFE8E8E6);
  static const ground = Color(0xFFF5F5F2);
  static const yellow = Color(0xFFFFCC00);
  static const yellowSoft = Color(0xFFFFF4C2);
  static const sale = Color(0xFFD32F2F);
  static const green = Color(0xFF15803D);
  static const greenSoft = Color(0xFFDFF6E6);
  static const white = Colors.white;
}

/// "UGX 12,000".
String _kMoney(num amount) {
  final whole = amount.round().abs().toString();
  final buffer = StringBuffer();
  for (var i = 0; i < whole.length; i++) {
    if (i > 0 && (whole.length - i) % 3 == 0) buffer.write(',');
    buffer.write(whole[i]);
  }
  return '${amount < 0 ? '−' : ''}UGX $buffer';
}

/// 1234 → "1.2K".
String _kCompact(int value) {
  if (value >= 1000000) return '${(value / 1000000).toStringAsFixed(1)}M';
  if (value >= 1000) return '${(value / 1000).toStringAsFixed(1)}K';
  return '$value';
}

/// Strips HTML from a WooCommerce description for plain display.
String _kPlain(String? html) {
  if (html == null) return '';
  return html
      .replaceAll(RegExp(r'<br\s*/?>', caseSensitive: false), '\n')
      .replaceAll(RegExp(r'</p>', caseSensitive: false), '\n\n')
      .replaceAll(RegExp(r'<li[^>]*>', caseSensitive: false), '• ')
      .replaceAll(RegExp(r'<[^>]+>'), '')
      .replaceAll('&amp;', '&')
      .replaceAll('&nbsp;', ' ')
      .replaceAll(RegExp(r'&#0?39;|&#8217;'), "'")
      .replaceAll(RegExp(r'\n{3,}'), '\n\n')
      .trim();
}

// ------------------------------------------------------------
//  Models
// ------------------------------------------------------------

class _KOption {
  _KOption(this.name, this.value, this.image);
  final String name;
  final String? value; // a colour hex, when the shop set one
  final String? image;
}

class _KAttribute {
  _KAttribute(this.name, this.options);
  final String name;
  final List<_KOption> options;
}

class _KVariation {
  _KVariation({
    required this.id,
    required this.price,
    required this.regularPrice,
    required this.attributes,
    required this.inStock,
    this.image,
  });
  final int id;
  final double price;
  final double regularPrice;
  final Map<String, String> attributes;
  final bool inStock;
  final String? image;
}

class _KProduct {
  _KProduct({
    required this.id,
    required this.name,
    required this.price,
    required this.regularPrice,
    required this.image,
    required this.gallery,
    required this.stockStatus,
    required this.stockQuantity,
    required this.totalSales,
    required this.rating,
    required this.ratingCount,
    required this.categoryIds,
    required this.attributes,
    required this.variations,
    required this.shortDescription,
    required this.description,
  });

  final int id;
  final String name;
  final double price;
  final double regularPrice;
  final String image;
  final List<String> gallery;
  final String stockStatus;
  final int? stockQuantity;
  final int totalSales;
  final double rating;
  final int ratingCount;
  final List<int> categoryIds;
  final List<_KAttribute> attributes;
  final List<_KVariation> variations;
  final String shortDescription;
  final String description;

  bool get soldOut => stockStatus == 'outofstock';
  bool get reduced => regularPrice > price && price > 0;
  int get discount => reduced ? (((regularPrice - price) / regularPrice) * 100).floor() : 0;
  List<String> get photos => [image, ...gallery].where((url) => url.isNotEmpty).toSet().toList();

  static double _num(dynamic value) => value is num ? value.toDouble() : double.tryParse('$value') ?? 0;

  factory _KProduct.fromRow(Map<String, dynamic> row) {
    final attributes = <_KAttribute>[];
    for (final raw in (row['attributes'] is List ? row['attributes'] as List : const [])) {
      if (raw is! Map) continue;
      final options = <_KOption>[];
      for (final option in (raw['options'] is List ? raw['options'] as List : const [])) {
        if (option is Map) {
          options.add(_KOption('${option['name'] ?? ''}', option['value']?.toString(), option['image']?.toString()));
        } else {
          options.add(_KOption('$option', null, null));
        }
      }
      if (options.isNotEmpty) attributes.add(_KAttribute('${raw['name'] ?? ''}', options));
    }

    final variations = <_KVariation>[];
    for (final raw in (row['variations'] is List ? row['variations'] as List : const [])) {
      if (raw is! Map) continue;
      final attrs = <String, String>{};
      final rawAttributes = raw['attributes'];
      if (rawAttributes is Map) rawAttributes.forEach((key, value) => attrs['$key'] = '$value');
      variations.add(_KVariation(
        id: (raw['id'] as num?)?.toInt() ?? 0,
        price: _num(raw['price']),
        regularPrice: _num(raw['regular_price']),
        attributes: attrs,
        inStock: raw['is_in_stock'] != false,
        image: raw['image']?.toString(),
      ));
    }

    return _KProduct(
      id: (row['id'] as num).toInt(),
      name: '${row['name'] ?? ''}',
      price: _num(row['price']),
      regularPrice: _num(row['regular_price']),
      image: '${row['image'] ?? ''}',
      gallery: (row['gallery'] is List ? row['gallery'] as List : const []).map((url) => '$url').toList(),
      stockStatus: '${row['stock_status'] ?? 'instock'}',
      stockQuantity: (row['stock_quantity'] as num?)?.toInt(),
      totalSales: (row['total_sales'] as num?)?.toInt() ?? 0,
      rating: _num(row['average_rating']),
      ratingCount: (row['rating_count'] as num?)?.toInt() ?? 0,
      categoryIds: (row['category_ids'] is List ? row['category_ids'] as List : const []).map((id) => id is num ? id.toInt() : int.tryParse('$id') ?? 0).toList(),
      attributes: attributes,
      variations: variations,
      shortDescription: '${row['short_description'] ?? ''}',
      description: '${row['description'] ?? ''}',
    );
  }
}

class _KCategory {
  _KCategory({required this.id, required this.name, required this.slug, required this.parent, required this.count, this.image});
  final int id;
  final String name;
  final String slug;
  final int parent;
  final int count;
  final String? image;

  factory _KCategory.fromRow(Map<String, dynamic> row) => _KCategory(
        id: (row['id'] as num).toInt(),
        name: '${row['name'] ?? ''}',
        slug: '${row['slug'] ?? ''}',
        parent: (row['parent'] as num?)?.toInt() ?? 0,
        count: (row['count'] as num?)?.toInt() ?? 0,
        image: row['image']?.toString(),
      );
}

// ------------------------------------------------------------
//  Supabase queries
// ------------------------------------------------------------

SupabaseClient get _kSupa => Supabase.instance.client;

/// The columns a product card needs; the product page asks for '*'.
const String _kCardColumns =
    'id,name,price,regular_price,image,stock_status,stock_quantity,total_sales,average_rating,rating_count,category_ids';

class _KApi {
  static List<_KCategory>? _categories;

  /// Every category with products in it (a category with none, or with only
  /// empty children, is left out so the app never shows an empty shelf).
  static Future<List<_KCategory>> categories({bool refresh = false}) async {
    if (_categories != null && !refresh) return _categories!;
    final rows = await _kSupa.from('categories').select().order('count', ascending: false);
    final all = (rows as List).map((row) => _KCategory.fromRow(row as Map<String, dynamic>)).toList();
    bool hasProducts(_KCategory category) =>
        category.count > 0 || all.any((child) => child.parent == category.id && hasProducts(child));
    _categories = all.where(hasProducts).toList();
    return _categories!;
  }

  static Future<List<_KCategory>> departments() async =>
      (await categories()).where((category) => category.parent == 0 && category.slug != 'uncategorized').toList();

  static Future<List<_KCategory>> childrenOf(int id) async =>
      (await categories()).where((category) => category.parent == id).toList();

  /// Products, newest first unless [order] says otherwise.
  static Future<List<_KProduct>> products({
    int? categoryId,
    bool onlyReduced = false,
    String order = 'date_created',
    bool ascending = false,
    String search = '',
    int offset = 0,
    int limit = 20,
    List<int> excludeIds = const [],
  }) async {
    var query = _kSupa.from('products').select(_kCardColumns).neq('stock_status', 'outofstock');
    if (categoryId != null) query = query.contains('category_ids', [categoryId]);
    if (onlyReduced) query = query.gt('discount_percent', 0);
    if (search.trim().isNotEmpty) query = query.ilike('name', '%${search.trim()}%');
    if (excludeIds.isNotEmpty) query = query.not('id', 'in', '(${excludeIds.join(',')})');
    final rows = await query.order(order, ascending: ascending).range(offset, offset + limit - 1);
    return (rows as List).map((row) => _KProduct.fromRow(row as Map<String, dynamic>)).toList();
  }

  static Future<_KProduct?> product(int id) async {
    final row = await _kSupa.from('products').select().eq('id', id).maybeSingle();
    return row == null ? null : _KProduct.fromRow(row);
  }
}

// ------------------------------------------------------------
//  Small hand-offs between screens, kept on the device
//  (so FlutterFlow's own Navigate To actions work too)
// ------------------------------------------------------------

class _KKeys {
  static const openProduct = 'kandi-open-product';
  static const shopCategory = 'kandi-shop-category';
  static const shopQuery = 'kandi-shop-query';
  static const shopSort = 'kandi-shop-sort';
  static const cart = 'kandi-cart-v2';
  static const address = 'kandi-address-id';
}

class _KNav {
  /// A product slides up as a tall bottom sheet over the current screen.
  static Future<void> openProduct(BuildContext context, int id) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setInt(_KKeys.openProduct, id);
    if (!context.mounted) return;
    await sheet(context, const KandiProductScreen(), height: 0.94);
  }

  /// The address picker, as a bottom sheet. True when an address was chosen.
  static Future<bool> openAddresses(BuildContext context) async =>
      await sheet<bool>(context, const KandiAddressPickerScreen(), height: 0.9) == true;

  /// Any screen as a rounded bottom sheet, [height] as a share of the screen.
  static Future<T?> sheet<T>(BuildContext context, Widget child, {double height = 0.9}) {
    return showModalBottomSheet<T>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      backgroundColor: Colors.transparent,
      builder: (_) => FractionallySizedBox(
        heightFactor: height,
        child: ClipRRect(
          borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
          child: child,
        ),
      ),
    );
  }

  /// Opens Shop already filtered to a category, a search or a sort.
  static Future<void> openShop(BuildContext context, {int? categoryId, String? query, String? sort}) async {
    final prefs = await SharedPreferences.getInstance();
    if (categoryId != null) await prefs.setInt(_KKeys.shopCategory, categoryId);
    if (query != null) await prefs.setString(_KKeys.shopQuery, query);
    if (sort != null) await prefs.setString(_KKeys.shopSort, sort);
    if (!context.mounted) return;
    await Navigator.of(context).push(MaterialPageRoute(builder: (_) => const KandiShopScreen()));
  }

  /// The bottom bar's tabs swap the screen rather than stacking it.
  static void tab(BuildContext context, int index) {
    const screens = <Widget>[
      KandiHomeScreen(),
      KandiShopScreen(),
      KandiRewardsScreen(),
      KandiCartScreen(),
      KandiAccountScreen(),
    ];
    Navigator.of(context).pushAndRemoveUntil(
      PageRouteBuilder(
        pageBuilder: (_, __, ___) => screens[index],
        transitionDuration: Duration.zero,
        reverseTransitionDuration: Duration.zero,
      ),
      (_) => false,
    );
  }
}

// ------------------------------------------------------------
//  The cart, kept on the device
// ------------------------------------------------------------

class _KCartLine {
  _KCartLine({
    required this.productId,
    required this.variationId,
    required this.name,
    required this.image,
    required this.price,
    required this.quantity,
    required this.options,
  });

  final int productId;
  final int variationId;
  final String name;
  final String image;
  final double price;
  int quantity;
  final Map<String, String> options;

  String get key => '$productId:$variationId:${options.entries.map((e) => '${e.key}=${e.value}').join('|')}';
  String get optionText => options.entries.map((e) => '${e.key}: ${e.value}').join(' · ');

  Map<String, dynamic> toJson() => {
        'product_id': productId,
        'variation_id': variationId,
        'name': name,
        'image': image,
        'price': price,
        'quantity': quantity,
        'options': options,
      };

  factory _KCartLine.fromJson(Map<String, dynamic> json) => _KCartLine(
        productId: (json['product_id'] as num).toInt(),
        variationId: (json['variation_id'] as num?)?.toInt() ?? 0,
        name: '${json['name'] ?? ''}',
        image: '${json['image'] ?? ''}',
        price: (json['price'] as num?)?.toDouble() ?? 0,
        quantity: (json['quantity'] as num?)?.toInt() ?? 1,
        options: (json['options'] is Map ? json['options'] as Map : const {}).map((k, v) => MapEntry('$k', '$v')),
      );
}

class _KCart extends ChangeNotifier {
  _KCart._();
  static final _KCart instance = _KCart._();

  final List<_KCartLine> lines = [];

  int get count => lines.fold(0, (sum, line) => sum + line.quantity);
  double get subtotal => lines.fold(0.0, (sum, line) => sum + line.price * line.quantity);

  /// Re-reads the basket from the device. Every screen keeps its own copy of
  /// this class, so the device is the one place the basket really lives, and
  /// each screen reads it fresh before showing or changing it.
  Future<void> load() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_KKeys.cart);
    if (raw != null) {
      try {
        lines
          ..clear()
          ..addAll((jsonDecode(raw) as List).map((e) => _KCartLine.fromJson(e as Map<String, dynamic>)));
      } catch (_) {}
    }
    notifyListeners();
  }

  Future<void> _save() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_KKeys.cart, jsonEncode(lines.map((line) => line.toJson()).toList()));
    notifyListeners();
  }

  Future<void> add(_KCartLine line) async {
    await load();
    final existing = lines.where((l) => l.key == line.key).toList();
    if (existing.isNotEmpty) {
      existing.first.quantity = (existing.first.quantity + line.quantity).clamp(1, 20).toInt();
    } else {
      lines.add(line);
    }
    await _save();
  }

  Future<void> setQuantity(_KCartLine line, int quantity) async {
    if (quantity <= 0) {
      lines.remove(line);
    } else {
      line.quantity = quantity.clamp(1, 20).toInt();
    }
    await _save();
  }

  Future<void> remove(_KCartLine line) async {
    lines.remove(line);
    await _save();
  }

  Future<void> clear() async {
    lines.clear();
    await _save();
  }
}

// ------------------------------------------------------------
//  Sign-in (Google, through Supabase) and the shop's own API
//  (WordPress / WooCommerce: account, addresses, orders, points)
// ------------------------------------------------------------

/// The Kandi Mobile API on WordPress (wordpress/kandi-mobile-api.php).
const String _kWooApi = 'https://shop.kandiug.com/wp-json/kandi/v1/mobile';

class _KAuth {
  static User? get user => _kSupa.auth.currentUser;
  static bool get signedIn => user != null;

  /// The shopper's Supabase access token, sent to WordPress with every call.
  static String get token => _kSupa.auth.currentSession?.accessToken ?? '';

  /// Shown in the app: the Google name, or the email.
  static String get name {
    final meta = user?.userMetadata ?? const {};
    final full = '${meta['full_name'] ?? meta['name'] ?? ''}'.trim();
    return full.isNotEmpty ? full : (user?.email ?? '');
  }

  static String get email => user?.email ?? '';
  static String get photo => '${user?.userMetadata?['avatar_url'] ?? user?.userMetadata?['picture'] ?? ''}';

  /// Signed in already, or signs in now through the sheet. True when signed in.
  static Future<bool> ensure(BuildContext context, {String reason = 'Sign in to continue'}) async {
    if (signedIn) return true;
    final ok = await showModalBottomSheet<bool>(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (_) => _KSignInSheet(reason: reason),
    );
    return ok == true && signedIn;
  }

  static Future<void> signOut() async {
    try {
      await authManager.signOut();
    } catch (_) {
      await _kSupa.auth.signOut();
    }
  }

  /// "0772 123 456" / "772123456" / "+256772123456" → "+256772123456", or null.
  static String? ugPhone(String raw) {
    var digits = raw.replaceAll(RegExp(r'\D'), '');
    if (digits.startsWith('256')) digits = digits.substring(3);
    if (digits.startsWith('0')) digits = digits.substring(1);
    return RegExp(r'^7\d{8}$').hasMatch(digits) ? '+256$digits' : null;
  }
}

/// One bottom sheet, one button: Continue with Google.
class _KSignInSheet extends StatefulWidget {
  const _KSignInSheet({super.key, this.reason = 'Sign in to continue'});
  final String reason;
  @override
  State<_KSignInSheet> createState() => _KSignInSheetState();
}

class _KSignInSheetState extends State<_KSignInSheet> {
  bool _busy = false;
  String? _error;

  Future<void> _google() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      // FlutterFlow's own Google sign-in for Supabase (Settings > Authentication).
      await authManager.signInWithGoogle(context);
      if (!mounted) return;
      if (_KAuth.signedIn) {
        Navigator.of(context).pop(true);
      } else {
        setState(() => _error = 'Sign-in was cancelled.');
      }
    } catch (e) {
      if (mounted) setState(() => _error = 'Could not sign in with Google. $e');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(20, 12, 20, 24),
      decoration: const BoxDecoration(
        color: _KColors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      child: SafeArea(
        top: false,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(
              child: Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(color: _KColors.line, borderRadius: BorderRadius.circular(2)),
              ),
            ),
            const SizedBox(height: 18),
            Text(widget.reason,
                style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w900, color: _KColors.ink, letterSpacing: -0.5)),
            const SizedBox(height: 6),
            const Text('Use your Google account. No password to remember.',
                style: TextStyle(fontSize: 14, color: _KColors.muted)),
            if (_error != null) ...[
              const SizedBox(height: 12),
              Text(_error!, style: const TextStyle(color: _KColors.sale, fontSize: 13, fontWeight: FontWeight.w600)),
            ],
            const SizedBox(height: 20),
            _KButton(label: 'Continue with Google', icon: Icons.g_mobiledata_rounded, dark: true, busy: _busy, onPressed: _google),
          ],
        ),
      ),
    );
  }
}

/// Calls to the Kandi Mobile API. Every call carries the shopper's sign-in.
/// Errors come back as an exception whose message can be shown as it is.
class _KWoo {
  static Map<String, String> get _headers => {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-Kandi-Token': _KAuth.token,
      };

  static dynamic _read(http.Response response) {
    dynamic data;
    try {
      data = jsonDecode(response.body);
    } catch (_) {
      data = null;
    }
    if (response.statusCode >= 200 && response.statusCode < 300) return data;
    final message = data is Map && data['message'] != null ? '${data['message']}' : 'Something went wrong (${response.statusCode}).';
    throw Exception(message);
  }

  static Future<dynamic> get(String path) async =>
      _read(await http.get(Uri.parse('$_kWooApi$path'), headers: _headers).timeout(const Duration(seconds: 30)));

  static Future<dynamic> post(String path, Map<String, dynamic> body) async => _read(await http
      .post(Uri.parse('$_kWooApi$path'), headers: _headers, body: jsonEncode(body))
      .timeout(const Duration(seconds: 45)));

  static Future<dynamic> delete(String path) async =>
      _read(await http.delete(Uri.parse('$_kWooApi$path'), headers: _headers).timeout(const Duration(seconds: 30)));

  /// "Exception: Choose a delivery address." → "Choose a delivery address."
  static String message(Object error) => '$error'.replaceFirst('Exception: ', '');
}

// ------------------------------------------------------------
//  Building blocks
// ------------------------------------------------------------

class _KButton extends StatelessWidget {
  const _KButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.busy = false,
    this.dark = false,
    this.outline = false,
    this.icon,
  });

  final String label;
  final VoidCallback? onPressed;
  final bool busy;
  final bool dark;
  final bool outline;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    final background = outline ? _KColors.white : (dark ? _KColors.ink : _KColors.yellow);
    final foreground = dark && !outline ? _KColors.white : _KColors.ink;
    return SizedBox(
      width: double.infinity,
      height: 52,
      child: ElevatedButton(
        onPressed: busy ? null : onPressed,
        style: ElevatedButton.styleFrom(
          elevation: 0,
          backgroundColor: background,
          foregroundColor: foreground,
          disabledBackgroundColor: background.withOpacity(0.6),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(999),
            side: outline ? const BorderSide(color: _KColors.ink, width: 1.5) : BorderSide.none,
          ),
        ),
        child: busy
            ? SizedBox(
                width: 22,
                height: 22,
                child: CircularProgressIndicator(strokeWidth: 2.5, color: foreground),
              )
            : Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  if (icon != null) ...[Icon(icon, size: 20), const SizedBox(width: 8)],
                  Text(label, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800)),
                ],
              ),
      ),
    );
  }
}

class _KField extends StatelessWidget {
  const _KField({
    super.key,
    required this.controller,
    required this.label,
    this.hint,
    this.keyboard,
    this.prefix,
    this.maxLines = 1,
    this.onChanged,
  });

  final TextEditingController controller;
  final String label;
  final String? hint;
  final TextInputType? keyboard;
  final String? prefix;
  final int maxLines;
  final ValueChanged<String>? onChanged;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: _KColors.ink)),
        const SizedBox(height: 6),
        TextField(
          controller: controller,
          keyboardType: keyboard,
          maxLines: maxLines,
          onChanged: onChanged,
          style: const TextStyle(fontSize: 16, color: _KColors.ink),
          decoration: InputDecoration(
            hintText: hint,
            prefixText: prefix,
            filled: true,
            fillColor: _KColors.ground,
            contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: BorderSide.none),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(14),
              borderSide: const BorderSide(color: _KColors.ink, width: 1.5),
            ),
          ),
        ),
      ],
    );
  }
}

/// A product photo on the shop's grey, with white backgrounds blended in.
class _KPhoto extends StatelessWidget {
  const _KPhoto(this.url, {super.key, this.fit = BoxFit.cover, this.radius = 0});
  final String url;
  final BoxFit fit;
  final double radius;

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(radius),
      child: Container(
        color: _KColors.ground,
        child: url.isEmpty
            ? const Center(child: Icon(Icons.image_outlined, color: _KColors.muted))
            : CachedNetworkImage(
                imageUrl: url,
                fit: fit,
                width: double.infinity,
                height: double.infinity,
                color: _KColors.ground,
                colorBlendMode: BlendMode.multiply,
                fadeInDuration: const Duration(milliseconds: 150),
                errorWidget: (_, __, ___) => const Center(child: Icon(Icons.image_not_supported_outlined, color: _KColors.muted)),
              ),
      ),
    );
  }
}

/// The product tile used everywhere: photo, discount, name, price, sold.
class _KProductCard extends StatelessWidget {
  const _KProductCard(this.product, {super.key, this.width});
  final _KProduct product;
  final double? width;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () => _KNav.openProduct(context, product.id),
      child: Container(
        width: width,
        decoration: BoxDecoration(color: _KColors.white, borderRadius: BorderRadius.circular(14)),
        clipBehavior: Clip.antiAlias,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            AspectRatio(
              aspectRatio: 1,
              child: Stack(
                fit: StackFit.expand,
                children: [
                  _KPhoto(product.image),
                  if (product.discount > 0)
                    Positioned(
                      top: 0,
                      left: 0,
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                        decoration: const BoxDecoration(
                          color: _KColors.yellow,
                          borderRadius: BorderRadius.only(bottomRight: Radius.circular(10)),
                        ),
                        child: Text('-${product.discount}%',
                            style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w900, color: _KColors.ink)),
                      ),
                    ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(10, 8, 10, 10),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(product.name,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: _KColors.body)),
                  const SizedBox(height: 3),
                  Text(_kMoney(product.price),
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w900,
                        color: product.reduced ? _KColors.sale : _KColors.ink,
                      )),
                  Row(
                    children: [
                      if (product.reduced)
                        Flexible(
                          child: Text(_kMoney(product.regularPrice),
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(
                                  fontSize: 11, color: _KColors.muted, decoration: TextDecoration.lineThrough)),
                        ),
                      if (product.reduced && product.totalSales > 0) const SizedBox(width: 6),
                      if (product.totalSales > 0)
                        Text('${_kCompact(product.totalSales)} sold',
                            style: const TextStyle(fontSize: 11, color: _KColors.muted)),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// A titled, swipeable row of product cards, optionally on a colour.
class _KCarousel extends StatelessWidget {
  const _KCarousel({
    super.key,
    required this.title,
    required this.products,
    this.onSeeAll,
    this.background = _KColors.white,
    this.titleColor = _KColors.ink,
  });

  final String title;
  final List<_KProduct> products;
  final VoidCallback? onSeeAll;
  final Color background;
  final Color titleColor;

  @override
  Widget build(BuildContext context) {
    if (products.length < 3) return const SizedBox.shrink();
    return Container(
      margin: const EdgeInsets.fromLTRB(12, 0, 12, 12),
      padding: const EdgeInsets.fromLTRB(0, 14, 0, 14),
      decoration: BoxDecoration(color: background, borderRadius: BorderRadius.circular(20)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 14),
            child: Row(
              children: [
                Expanded(
                  child: Text(title,
                      style: TextStyle(fontSize: 22, fontWeight: FontWeight.w900, color: titleColor, letterSpacing: -0.5)),
                ),
                if (onSeeAll != null)
                  GestureDetector(
                    onTap: onSeeAll,
                    child: Text('See all ›', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: titleColor)),
                  ),
              ],
            ),
          ),
          const SizedBox(height: 12),
          SizedBox(
            height: 248,
            child: ListView.separated(
              padding: const EdgeInsets.symmetric(horizontal: 14),
              scrollDirection: Axis.horizontal,
              itemCount: products.length,
              separatorBuilder: (_, __) => const SizedBox(width: 10),
              itemBuilder: (_, index) => _KProductCard(products[index], width: 158),
            ),
          ),
        ],
      ),
    );
  }
}

/// A two-column grid of product cards as a sliver.
class _KProductGrid extends StatelessWidget {
  const _KProductGrid(this.products, {super.key});
  final List<_KProduct> products;

  @override
  Widget build(BuildContext context) {
    return SliverPadding(
      padding: const EdgeInsets.symmetric(horizontal: 12),
      sliver: SliverGrid(
        gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
          crossAxisCount: 2,
          mainAxisSpacing: 10,
          crossAxisSpacing: 10,
          childAspectRatio: 0.66,
        ),
        delegate: SliverChildBuilderDelegate(
          (_, index) => _KProductCard(products[index]),
          childCount: products.length,
        ),
      ),
    );
  }
}

/// The app's five tabs. Cart shows its count.
class _KBottomNav extends StatelessWidget {
  const _KBottomNav({super.key, required this.current});
  final int current;

  @override
  Widget build(BuildContext context) {
    const items = [
      (Icons.home_outlined, Icons.home, 'Home'),
      (Icons.grid_view_outlined, Icons.grid_view_rounded, 'Shop'),
      (Icons.stars_outlined, Icons.stars_rounded, 'Rewards'),
      (Icons.shopping_bag_outlined, Icons.shopping_bag, 'Cart'),
      (Icons.person_outline, Icons.person, 'Account'),
    ];
    return AnimatedBuilder(
      animation: _KCart.instance,
      builder: (context, _) => Container(
        decoration: const BoxDecoration(
          color: _KColors.white,
          border: Border(top: BorderSide(color: _KColors.line)),
        ),
        child: SafeArea(
          top: false,
          child: SizedBox(
            height: 62,
            child: Row(
              children: [
                for (var i = 0; i < items.length; i++)
                  Expanded(
                    child: InkWell(
                      onTap: i == current ? null : () => _KNav.tab(context, i),
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Badge(
                            isLabelVisible: i == 3 && _KCart.instance.count > 0,
                            label: Text('${_KCart.instance.count}'),
                            backgroundColor: _KColors.sale,
                            child: Icon(i == current ? items[i].$2 : items[i].$1,
                                color: i == current ? _KColors.ink : _KColors.muted, size: 26),
                          ),
                          const SizedBox(height: 2),
                          Text(items[i].$3,
                              style: TextStyle(
                                fontSize: 11,
                                fontWeight: i == current ? FontWeight.w800 : FontWeight.w500,
                                color: i == current ? _KColors.ink : _KColors.muted,
                              )),
                        ],
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
}

/// A grey placeholder block while data loads.
class _KSkeleton extends StatelessWidget {
  const _KSkeleton({super.key, this.height = 120, this.radius = 16});
  final double height;
  final double radius;
  @override
  Widget build(BuildContext context) => Container(
        height: height,
        margin: const EdgeInsets.fromLTRB(12, 0, 12, 12),
        decoration: BoxDecoration(color: _KColors.line, borderRadius: BorderRadius.circular(radius)),
      );
}

/// A centred message with an optional action, for empty and error states.
class _KEmpty extends StatelessWidget {
  const _KEmpty({super.key, required this.icon, required this.title, this.message, this.action, this.onAction});
  final IconData icon;
  final String title;
  final String? message;
  final String? action;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(32),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 72,
            height: 72,
            decoration: const BoxDecoration(color: _KColors.yellowSoft, shape: BoxShape.circle),
            child: Icon(icon, size: 34, color: _KColors.ink),
          ),
          const SizedBox(height: 16),
          Text(title,
              textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w900, color: _KColors.ink)),
          if (message != null) ...[
            const SizedBox(height: 6),
            Text(message!, textAlign: TextAlign.center, style: const TextStyle(fontSize: 14, color: _KColors.muted)),
          ],
          if (action != null) ...[
            const SizedBox(height: 18),
            SizedBox(width: 220, child: _KButton(label: action!, onPressed: onAction)),
          ],
        ],
      ),
    );
  }
}

/// A short message at the bottom of the screen.
void _kToast(BuildContext context, String message) {
  ScaffoldMessenger.of(context)
    ..hideCurrentSnackBar()
    ..showSnackBar(SnackBar(
      content: Text(message, style: const TextStyle(fontWeight: FontWeight.w600)),
      behavior: SnackBarBehavior.floating,
      backgroundColor: _KColors.ink,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
    ));
}
