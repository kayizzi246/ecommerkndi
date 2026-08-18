// Automatic FlutterFlow imports
import '/backend/backend.dart';
import '/backend/supabase/supabase.dart';
import '/flutter_flow/flutter_flow_theme.dart';
import '/flutter_flow/flutter_flow_util.dart';
import '/custom_code/widgets/index.dart'; // Imports other custom widgets
import '/flutter_flow/custom_functions.dart'; // Imports custom functions
import 'package:flutter/material.dart';
// Begin custom widget code
// DO NOT REMOVE OR MODIFY THE CODE ABOVE!

import 'dart:async';
import 'dart:convert';

import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

// ============================================================
//  KANDI — DELIVERY ADDRESS & FEE
//
//  Sibling of cart_widget.dart and checkout_widget.dart. Same
//  brand, same type, same API, same conventions.
//
//  WHAT THIS SCREEN IS FOR
//  -----------------------------------------------------------
//  Collecting where an order goes, and telling the shopper what
//  that costs BEFORE they reach the pay button.
//
//  THE ONE RULE: THIS APP NEVER PRICES A DELIVERY
//  -----------------------------------------------------------
//  Every figure on this screen comes from
//
//      POST {_kApiBaseUrl}/api/delivery/quote
//           { address | point, subtotal }
//
//  and none of it is computed in Dart. That is not caution for
//  its own sake — it is the only arrangement in which the number
//  shown here and the number charged can never disagree:
//
//    • The rates (base fee, per-km, free radius, maximum, the
//      shop's own coordinates) live in wp-admin under Kandi
//      Storefront ▸ Delivery pricing. The owner changes them
//      there and both the site and this app follow within a
//      minute. A copy of that arithmetic in Dart would need an
//      app release to stay honest, and would be wrong in the
//      window between.
//
//    • `POST /api/checkout` runs the SAME `quoteDelivery` again
//      when the order is placed, against the coordinates — never
//      against a fee the caller sent. So a fee this screen
//      invented would simply be overruled, and the shopper would
//      be charged something they were never shown.
//
//  This is also why the record saved at the end carries the
//  POINT and not the fee. The point is the input the server
//  prices from; the fee is its answer, and re-asking is cheap.
//
//  THE ADDRESS RECORD  (`kandi_delivery_v2`)
//  -----------------------------------------------------------
//      { address, city, place, lat, lng,
//        first_name, last_name, phone }
//
//  Written here, read by the checkout. `kandi_delivery_address`
//  is still written alongside it with the plain address string,
//  because an app updated in place has a shopper's address under
//  that older key and forgetting it would send them back to this
//  form for no visible reason.
//
//  THE DEVICE'S LOCATION — REMOVED, AND WHY
//  -----------------------------------------------------------
//  This screen used to open with "Use my current location": a
//  GPS fix from `package:geolocator`, posted to the same quote
//  endpoint, with the street and town fields filled from what
//  came back. It also tried the fix silently on open when
//  permission had already been granted, so returning shoppers
//  saw the fee with nothing to tap.
//
//  It is gone, and it was not a design decision — it is what the
//  build said:
//
//      Error: Couldn't resolve the package 'geolocator' in
//      'package:geolocator/geolocator.dart'.
//      lib/custom_code/widgets/delivery_address_page.dart:16:8
//
//  followed by fourteen more errors, every one of them a
//  `Geolocator`, `LocationPermission` or `LocationAccuracy` that
//  the analyser then had no type for. `geolocator` is not in this
//  FlutterFlow project's pubspec. The SETUP block below has
//  listed it since the screen was written and nobody added it,
//  so the whole app — not this screen, the WHOLE app — failed to
//  compile for web. One unavailable package took down the build.
//
//  ---- Why removal rather than adding the dependency ----
//
//  Adding it is the other correct answer and it cannot be done
//  from this file: pub dependencies live in the FlutterFlow
//  project settings, not in pasted custom code. Leaving the
//  import in until somebody clicks that means the build stays
//  broken in the meantime, and a broken build blocks every other
//  change to the app.
//
//  The cost of removing it is smaller than it looks, because the
//  fallback is not a worse version of the same thing — it is the
//  path the majority of shoppers were already taking. The typed
//  address goes to the SAME `POST /api/delivery/quote`, which
//  geocodes it server-side and prices it with the same
//  `quoteDelivery`. The fee is quoted, the record is saved, the
//  checkout works. What is lost is precision: a geocoded
//  "Ntinda" is the centroid of a suburb kilometres across, where
//  a GPS fix was the doorstep — so two shoppers on opposite
//  edges of an area now get the same fee. That is a rounding
//  error in the delivery charge, against a build that does not
//  compile.
//
//  ---- Putting it back ----
//
//  FlutterFlow ▸ Settings ▸ App Settings ▸ Pubspec Dependencies,
//  add `geolocator: ^11.0.0`, then restore this screen from git
//  history — the button, `_useMyLocation`, `_locationFailed` and
//  `_maybeLocateQuietly` came out together in one commit and go
//  back together. The permissions that went with them:
//
//      iOS — Info.plist
//        NSLocationWhenInUseUsageDescription
//          "Kandi uses your location to work out your delivery
//           fee and fill in your address."
//
//      Android — AndroidManifest.xml
//        ACCESS_COARSE_LOCATION and ACCESS_FINE_LOCATION.
//        COARSE is genuinely enough — the fee is priced per
//        kilometre and coarse is accurate to a city block — but
//        FINE has to be declared too, because Android grants
//        coarse-only when both are present and the shopper picks
//        "Approximate".
//
//  Do not restore the import without the pubspec entry. That is
//  the exact state this commit is undoing.
//
//  SETUP  (FlutterFlow)
//  -----------------------------------------------------------
//  • Custom Widget name:  DeliveryAddressPage   (must match the class)
//  • Dependencies (Settings ▸ Pubspec):
//        http: ^1.2.0
//        google_fonts: ^6.1.0
//        shared_preferences: ^2.2.2
//
//    Three, and all three are already in this project. Nothing on
//    this screen needs a platform channel or a permission any
//    more, which is also why it now compiles for web.
//  • Parameters — all optional:
//        width, height       double?
//        subtotal            double?   the basket total, so the
//                                      screen can say "free over X"
//        onSaved             Action    after a successful save
//        onBackTap           Action
//
//  NOT USED HERE: Supabase. The website keeps its delivery
//  address in the device's own storage and needs no account, and
//  this screen matches it key for key so a wrapped webview and
//  the native screens describe the same address.
// ============================================================

const String _kApiBaseUrl = 'https://kandiug.com';

const Color _kOrange = Color(0xFFFF6A00);
const Color _kOrangeDark = Color(0xFFE85D00);
const Color _kInk = Color(0xFF111827);
const Color _kBody = Color(0xFF4B5563);
const Color _kMuted = Color(0xFF6B7280);
const Color _kLine = Color(0xFFE5E7EB);
const Color _kSurface = Color(0xFFF9FAFB);
const Color _kGreen = Color(0xFF16A34A);
const Color _kRed = Color(0xFFE53935);

/// ============================================================
///  THE AREA LIST
/// ============================================================
///
/// Places this shop delivers to, for the search sheet.
///
/// ---- Why a bundled list and not an autocomplete ----
///
/// Typing a free-text area and waiting for the server to geocode it is what
/// this screen did, and it is the wrong shape for the problem. The shopper has
/// to produce a spelling the geocoder recognises, with no idea what it will
/// accept, and finds out 700ms later that it did not — "We could not find that
/// place" against a word they know is a real place because they live there.
/// Nothing on the screen tells them what a good answer looks like.
///
/// A real autocomplete would fix that and cannot be built from here. The
/// server's forward geocoder is either Nominatim, whose usage policy rate-
/// limits to roughly one request a second and which `lib/geocode.ts` is
/// explicit about never calling in a loop, or Google Geocoding, which is not
/// the Places Autocomplete API and does not do prefix matching. Neither is a
/// per-keystroke endpoint, and there is no `/api/delivery/suggest` to call.
///
/// So the answer is a list this app already holds: instant, offline, and made
/// of names that are KNOWN to geocode, because that is the only reason a name
/// is on it. Tapping one fills the town field with a spelling that works.
///
/// ---- What it is and is not ----
///
/// It is a shortcut, not a restriction. The town field stays free text
/// underneath, so somewhere not on this list is still typed and still quoted
/// exactly as before — the list cannot make an address unreachable.
///
/// Ordered roughly by where this shop's orders actually go: the Kampala
/// divisions and the suburbs around them first, then the greater-Kampala
/// towns, then the rest of the country. The search matches anywhere in the
/// string, so ordering only decides what an empty search shows.
///
/// Adding to it is safe and cheap. Removing a name is not — somebody may have
/// a saved address under it.
const List<String> _kAreas = <String>[
  // Kampala, by division
  'Kampala Central', 'Nakawa', 'Kawempe', 'Rubaga', 'Makindye',
  // Kampala suburbs, the ones people actually name
  'Ntinda', 'Kololo', 'Nakasero', 'Bugolobi', 'Muyenga', 'Kabalagala',
  'Kansanga', 'Ggaba', 'Munyonyo', 'Luzira', 'Butabika', 'Mutungo',
  'Bukoto', 'Kisaasi', 'Kyanja', 'Najeera', 'Kiwatule', 'Naguru',
  'Ntinda Kigowa', 'Bukasa', 'Kirinya', 'Namugongo', 'Kyaliwajjala',
  'Kira', 'Bweyogerere', 'Kireka', 'Banda', 'Kyambogo', 'Nakawa Market',
  'Wandegeya', 'Makerere', 'Kikoni', 'Kasubi', 'Kawaala', 'Bwaise',
  'Kalerwe', 'Mpererwe', 'Komamboga', 'Gayaza Road', 'Kanyanya',
  'Kyebando', 'Mulago', 'Kamwokya', 'Ntinda Stretcher', 'Kabowa',
  'Ndeeba', 'Nateete', 'Busega', 'Rubaga Road', 'Mengo', 'Namirembe',
  'Nsambya', 'Katwe', 'Kibuye', 'Najjanankumbi', 'Zana', 'Kajjansi',
  'Lubowa', 'Seguku', 'Bunamwaya', 'Wakiso', 'Nansana', 'Kawanda',
  'Matugga', 'Kasangati', 'Gayaza', 'Kiira', 'Namboole',
  // Greater Kampala and the Entebbe road
  'Entebbe', 'Kitoro', 'Abaita Ababiri', 'Kisubi', 'Nkumba',
  'Mukono', 'Seeta', 'Namanve', 'Nakisunga', 'Lugazi', 'Buikwe',
  // The rest of the country, by size
  'Jinja', 'Njeru', 'Iganga', 'Kamuli', 'Mbale', 'Tororo', 'Soroti',
  'Lira', 'Gulu', 'Kitgum', 'Arua', 'Nebbi', 'Masindi', 'Hoima',
  'Mbarara', 'Bushenyi', 'Ntungamo', 'Kabale', 'Kisoro', 'Fort Portal',
  'Kasese', 'Masaka', 'Lyantonde', 'Mityana', 'Mubende', 'Luweero',
  'Nakaseke', 'Kayunga', 'Bombo', 'Kiboga', 'Sembabule', 'Rakai',
  'Kalangala', 'Moroto', 'Kotido', 'Adjumani', 'Moyo', 'Yumbe',
  'Koboko', 'Pakwach', 'Apac', 'Dokolo', 'Kumi', 'Pallisa', 'Budaka',
  'Sironko', 'Kapchorwa', 'Busia', 'Bugiri', 'Mayuge', 'Buwenge',
];

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

String _ugx(double amount) {
  final whole = amount.round().toString();
  final buffer = StringBuffer();
  for (var i = 0; i < whole.length; i++) {
    if (i > 0 && (whole.length - i) % 3 == 0) buffer.write(',');
    buffer.write(whole[i]);
  }
  return 'UGX $buffer';
}

/// A priced delivery, straight from `POST /api/delivery/quote`.
class _Quote {
  final double fee;
  final bool free;
  final bool deliverable;
  final String label;
  final String? place;
  final double freeDeliveryFrom;
  final double? lat;
  final double? lng;
  final String street;
  final String city;

  const _Quote({
    required this.fee,
    required this.free,
    required this.deliverable,
    required this.label,
    required this.place,
    required this.freeDeliveryFrom,
    required this.lat,
    required this.lng,
    required this.street,
    required this.city,
  });

  factory _Quote.fromJson(Map<String, dynamic> j) {
    final point = (j['point'] as Map?) ?? const {};
    final address = (j['address'] as Map?) ?? const {};
    return _Quote(
      fee: (j['fee'] is num) ? (j['fee'] as num).toDouble() : 0,
      free: j['free'] == true,
      deliverable: j['deliverable'] != false,
      label: (j['label'] ?? '').toString(),
      place: j['place']?.toString(),
      freeDeliveryFrom: (j['freeDeliveryFrom'] is num)
          ? (j['freeDeliveryFrom'] as num).toDouble()
          : 0,
      lat: (point['lat'] is num) ? (point['lat'] as num).toDouble() : null,
      lng: (point['lng'] is num) ? (point['lng'] as num).toDouble() : null,
      street: (address['street'] ?? '').toString(),
      city: (address['city'] ?? '').toString(),
    );
  }
}

/// The saved address record. Private, and deliberately a duplicate of the
/// reader in `cart_widget.dart` — see the note at the head of that file on why
/// a top-level class cannot cross a FlutterFlow file boundary. The STORAGE KEY
/// and the JSON shape are the contract; the readers are per-file.
class _Store {
  _Store._();

  static const String recordKey = 'kandi_delivery_v2';
  static const String legacyKey = 'kandi_delivery_address';

  static Future<Map<String, dynamic>?> read() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final raw = prefs.getString(recordKey);
      if (raw != null && raw.trim().isNotEmpty) {
        final decoded = jsonDecode(raw);
        if (decoded is Map) return Map<String, dynamic>.from(decoded);
      }
      final legacy = prefs.getString(legacyKey);
      if (legacy != null && legacy.trim().isNotEmpty) {
        return <String, dynamic>{'address': legacy.trim()};
      }
    } catch (_) {}
    return null;
  }

  static Future<void> write(Map<String, dynamic> record) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(recordKey, jsonEncode(record));
      await prefs.setString(
        legacyKey,
        (record['address'] ?? '').toString().trim(),
      );
    } catch (_) {}
  }
}

class DeliveryAddressPage extends StatefulWidget {
  const DeliveryAddressPage({
    super.key,
    this.width,
    this.height,
    this.subtotal,
    this.onSaved,
    this.onBackTap,
  });

  final double? width;
  final double? height;

  /// The basket total, so the quote can apply the free-delivery threshold and
  /// the screen can say how much more is needed to reach it.
  final double? subtotal;

  final Future Function()? onSaved;
  final Future Function()? onBackTap;

  /// Opens the address screen and resolves when it closes.
  ///
  /// A static on the widget class because that is the only symbol FlutterFlow
  /// exports from this file — the checkout calls this to send a shopper here
  /// and awaits their return.
  static Future<void> open(BuildContext context, {double? subtotal}) {
    return Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => DeliveryAddressPage(subtotal: subtotal),
      ),
    );
  }

  /// The saved delivery record, or null when there is none.
  ///
  /// Plain map of primitives, so it crosses the file boundary. Keys:
  /// `address`, `city`, `place`, `lat`, `lng`, `first_name`, `last_name`,
  /// `phone`.
  static Future<Map<String, dynamic>?> savedRecord() => _Store.read();

  /// True when the saved record carries coordinates.
  ///
  /// The checkout uses this rather than "is there an address": an address with
  /// no point cannot be priced, so the order would be placed with no delivery
  /// line. A v1 record restored from the old key is exactly that case.
  static Future<bool> hasLocation() async {
    final record = await _Store.read();
    return record != null && record['lat'] is num && record['lng'] is num;
  }

  @override
  State<DeliveryAddressPage> createState() => _DeliveryAddressPageState();
}

class _DeliveryAddressPageState extends State<DeliveryAddressPage> {
  final _nameCtrl = TextEditingController();
  final _phoneCtrl = TextEditingController();
  final _addressCtrl = TextEditingController();
  final _cityCtrl = TextEditingController();

  _Quote? _quote;
  bool _quoting = false;

  bool _saving = false;
  String? _error;
  Timer? _debounce;

  /// The coordinates the current quote was priced from.
  ///
  /// Held rather than read back off `_quote` so a typed-address quote and a GPS
  /// quote save the same way: the server echoes the point it geocoded to, and
  /// that echoed point — not the text — is what the order is priced from.
  double? _lat;
  double? _lng;

  @override
  void initState() {
    super.initState();
    _restore();
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _nameCtrl.dispose();
    _phoneCtrl.dispose();
    _addressCtrl.dispose();
    _cityCtrl.dispose();
    super.dispose();
  }

  double get _subtotal => widget.subtotal ?? 0;

  /// The phone, normalised to the 9 digits after the country code.
  String get _cleanPhone {
    var p = _phoneCtrl.text.replaceAll(RegExp(r'[^0-9]'), '');
    if (p.startsWith('256')) p = p.substring(3);
    if (p.startsWith('0')) p = p.substring(1);
    return p.length > 9 ? p.substring(0, 9) : p;
  }

  String get _fullPhone => '+256$_cleanPhone';

  bool get _phoneValid => _cleanPhone.length == 9;

  bool get _canSave =>
      _nameCtrl.text.trim().isNotEmpty &&
      _phoneValid &&
      _addressCtrl.text.trim().isNotEmpty &&
      _cityCtrl.text.trim().isNotEmpty &&
      _quote != null &&
      _quote!.deliverable;

  Future<void> _restore() async {
    final record = await _Store.read();

    // Nothing saved: a first-time shopper gets an empty form.
    //
    // This used to attempt a silent GPS fix here so a returning shopper who had
    // already granted permission saw the fee with nothing to tap. That went with
    // the rest of the location code — see the header. There is nothing to fall
    // back to and nothing to report: the form is empty either way, and the quote
    // arrives as soon as the address field has something in it.
    if (record == null) return;
    if (!mounted) return;

    final first = (record['first_name'] ?? '').toString();
    final last = (record['last_name'] ?? '').toString();
    final name = [first, last].where((s) => s.trim().isNotEmpty).join(' ');

    _nameCtrl.text = name;
    _addressCtrl.text = (record['address'] ?? '').toString();
    _cityCtrl.text = (record['city'] ?? '').toString();

    var phone = (record['phone'] ?? '').toString();
    if (phone.isNotEmpty) {
      phone = phone.replaceAll(RegExp(r'[^0-9]'), '');
      if (phone.startsWith('256')) phone = phone.substring(3);
      if (phone.startsWith('0')) phone = phone.substring(1);
      _phoneCtrl.text = phone.length > 9 ? phone.substring(0, 9) : phone;
    }

    // The saved coordinates come back too. The re-quote below normally
    // replaces them with the server's echo, but restoring them first means a
    // shopper whose network drops can still save the address they already had.
    _lat = (record['lat'] is num) ? (record['lat'] as num).toDouble() : null;
    _lng = (record['lng'] is num) ? (record['lng'] as num).toDouble() : null;

    setState(() {});

    // Re-quote rather than restoring the saved fee.
    //
    // The rates may have changed in wp-admin since this address was saved, and
    // the basket total almost certainly has — which decides whether the order
    // clears the free-delivery threshold. A restored fee would be a figure from
    // a previous shopping trip presented as today's price.
    //
    // By POINT when there is one. Re-geocoding text that was already resolved
    // to coordinates can land somewhere slightly different — a geocoder is not
    // required to be stable across time — and would move a saved doorstep to a
    // suburb centroid.
    if (_lat != null && _lng != null) {
      _requestQuote(lat: _lat, lng: _lng);
    } else if (_addressCtrl.text.trim().isNotEmpty) {
      // A v1 record: an address with no point. Geocoding it is exactly how it
      // gets upgraded to one.
      _requestQuote();
    }
  }

  void _onAddressChanged() {
    // Debounced, because this fires per keystroke and each one is a geocode on
    // the server. 700ms is past the gap between letters in a word and short
    // enough that the fee appears while the shopper is still looking at the
    // field they typed it into.
    _debounce?.cancel();
    setState(() {
      _quote = null;
      _error = null;
    });
    _debounce = Timer(const Duration(milliseconds: 700), _requestQuote);
  }

  /// Prices one delivery — from coordinates when given, otherwise from the
  /// typed address.
  ///
  /// One function for both because they are one decision at the other end:
  /// `/api/delivery/quote` takes `point` OR `address`, geocodes the second into
  /// the first, and runs the same `quoteDelivery` either way. Two functions
  /// here would be two chances to send a subtly different body.
  ///
  /// The `lat`/`lng` parameters have no caller inside this file any more — the
  /// GPS button that supplied them is gone (see the header). They are kept
  /// rather than deleted because the by-point branch is not dead weight: the
  /// server echoes back the point it geocoded a typed address to, that echoed
  /// point is what the order is priced from, and restoring the button means
  /// restoring one call site rather than re-deriving this request shape.
  Future<void> _requestQuote({double? lat, double? lng}) async {
    final byPoint = lat != null && lng != null;

    final typed = [_addressCtrl.text.trim(), _cityCtrl.text.trim()]
        .where((s) => s.isNotEmpty)
        .join(', ');
    if (!byPoint && typed.isEmpty) return;

    setState(() {
      _quoting = true;
      _error = null;
    });

    try {
      final res = await http
          .post(
            Uri.parse('$_kApiBaseUrl/api/delivery/quote'),
            headers: const {'Content-Type': 'application/json'},
            body: jsonEncode(
              byPoint
                  ? {
                      'point': {'lat': lat, 'lng': lng},
                      'subtotal': _subtotal,
                    }
                  : {'address': typed, 'subtotal': _subtotal},
            ),
          )
          .timeout(const Duration(seconds: 20));

      if (!mounted) return;

      final data = jsonDecode(res.body);
      if (data is! Map) throw Exception('bad response');
      final map = Map<String, dynamic>.from(data);

      if (res.statusCode != 200) {
        setState(() {
          _quoting = false;
          _quote = null;
          _error = (map['error'] ??
                  'We could not find that place. Try a nearby landmark or suburb.')
              .toString();
        });
        return;
      }

      final quote = _Quote.fromJson(map);
      setState(() {
        _quoting = false;
        _quote = quote;
        // The point the SERVER priced from, not the one we sent. For a typed
        // address they differ — it geocoded the text — and the order must be
        // placed against the same coordinates the fee came from.
        _lat = quote.lat ?? lat;
        _lng = quote.lng ?? lng;
        _error = quote.deliverable
            ? null
            : 'We do not deliver that far yet. Try an address closer to town.';
      });

      // The server's own reading of the street and town, offered back only
      // where the shopper left a field empty. Overwriting what somebody typed
      // with a geocoder's guess is how "Plot 14, Bukoto" becomes "Bukoto Rd".
      //
      // This is what makes the location button feel like it filled the form
      // in: a GPS quote arrives with both fields blank, so both get written.
      if (_addressCtrl.text.trim().isEmpty && quote.street.isNotEmpty) {
        _addressCtrl.text = quote.street;
      }
      if (_cityCtrl.text.trim().isEmpty && quote.city.isNotEmpty) {
        _cityCtrl.text = quote.city;
      }
      if (mounted) setState(() {});
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _quoting = false;
        _quote = null;
        _error = 'Could not reach the shop just now. Check your connection.';
      });
    }
  }

  Future<void> _save() async {
    final quote = _quote;
    if (!_canSave || quote == null) return;

    setState(() => _saving = true);

    final parts = _nameCtrl.text.trim().split(RegExp(r'\s+'));
    final record = <String, dynamic>{
      'address': _addressCtrl.text.trim(),
      'city': _cityCtrl.text.trim(),
      'place': quote.place ?? quote.label,
      // The two fields the whole record exists for. `POST /api/checkout` prices
      // delivery from these; without them an order is placed with no delivery
      // line at all.
      //
      // `_lat`/`_lng` rather than the quote's, because they are the same value
      // with a fallback: a GPS fix keeps the phone's own coordinates when the
      // server did not echo a point back.
      'lat': _lat ?? quote.lat,
      'lng': _lng ?? quote.lng,
      'first_name': parts.isNotEmpty ? parts.first : '',
      'last_name': parts.length > 1 ? parts.sublist(1).join(' ') : '',
      'phone': _fullPhone,
    };

    await _Store.write(record);
    HapticFeedback.mediumImpact();

    if (!mounted) return;
    setState(() => _saving = false);

    await widget.onSaved?.call();
    if (mounted) Navigator.of(context).maybePop();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      body: SafeArea(
        child: Column(
          children: [
            _header(),
            Expanded(
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  // The "Use my current location" button and the "or type it
                  // below" divider under it both went with the GPS code — see
                  // the header.
                  //
                  // The area search took the top slot they left, and it is the
                  // right thing to have there for the same reason the location
                  // button was: it is the fastest correct answer to the
                  // question this screen exists to ask. See `_areaButton`.
                  _areaButton(),
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      const Expanded(child: Divider(color: _kLine)),
                      Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 10),
                        child: Text('or fill it in yourself',
                            style: _type(size: 11.5, color: _kMuted)),
                      ),
                      const Expanded(child: Divider(color: _kLine)),
                    ],
                  ),
                  const SizedBox(height: 12),
                  _field('Full name', _nameCtrl,
                      hint: 'Who is receiving the order',
                      onChanged: (_) => setState(() {})),
                  const SizedBox(height: 16),
                  _phoneField(),
                  const SizedBox(height: 16),
                  _field('Address', _addressCtrl,
                      hint: 'Plot, street or nearest landmark',
                      onChanged: (_) => _onAddressChanged()),
                  const SizedBox(height: 16),
                  _field('Town or area', _cityCtrl,
                      hint: 'Kampala, Ntinda, Mukono…',
                      onChanged: (_) => _onAddressChanged()),
                  const SizedBox(height: 20),
                  _quoteCard(),
                ],
              ),
            ),
            _saveBar(),
          ],
        ),
      ),
    );
  }

  Widget _header() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 12),
      decoration: const BoxDecoration(
        border: Border(bottom: BorderSide(color: _kLine)),
      ),
      child: Row(
        children: [
          GestureDetector(
            onTap: () async {
              await widget.onBackTap?.call();
              if (mounted) Navigator.of(context).maybePop();
            },
            child: const SizedBox(
              width: 40,
              height: 40,
              child: Icon(Icons.arrow_back_ios_new, size: 20, color: _kInk),
            ),
          ),
          const SizedBox(width: 8),
          Text('Delivery address',
              style: _type(size: 18, weight: FontWeight.w700)),
        ],
      ),
    );
  }

  Widget _field(
    String label,
    TextEditingController controller, {
    String hint = '',
    ValueChanged<String>? onChanged,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label,
            style: _type(size: 12, weight: FontWeight.w600, color: _kBody)),
        const SizedBox(height: 6),
        Container(
          decoration: BoxDecoration(
            color: _kSurface,
            borderRadius: BorderRadius.circular(10),
            border: Border.all(color: _kLine),
          ),
          child: TextField(
            controller: controller,
            onChanged: onChanged,
            style: _type(size: 14),
            decoration: InputDecoration(
              hintText: hint,
              hintStyle: _type(size: 14, color: _kMuted),
              border: InputBorder.none,
              contentPadding:
                  const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
            ),
          ),
        ),
      ],
    );
  }

  Widget _phoneField() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('Phone number',
            style: _type(size: 12, weight: FontWeight.w600, color: _kBody)),
        const SizedBox(height: 6),
        Container(
          decoration: BoxDecoration(
            color: _kSurface,
            borderRadius: BorderRadius.circular(10),
            border: Border.all(color: _kLine),
          ),
          child: Row(
            children: [
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
                decoration: const BoxDecoration(
                  border: Border(right: BorderSide(color: _kLine)),
                ),
                child: Text('🇺🇬 +256',
                    style: _type(size: 14, weight: FontWeight.w600)),
              ),
              Expanded(
                child: TextField(
                  controller: _phoneCtrl,
                  keyboardType: TextInputType.phone,
                  inputFormatters: [
                    FilteringTextInputFormatter.digitsOnly,
                    LengthLimitingTextInputFormatter(9),
                  ],
                  onChanged: (_) => setState(() {}),
                  style: _type(size: 14),
                  decoration: InputDecoration(
                    hintText: '7XX XXX XXX',
                    hintStyle: _type(size: 14, color: _kMuted),
                    border: InputBorder.none,
                    contentPadding: const EdgeInsets.symmetric(horizontal: 14),
                  ),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _quoteCard() {
    if (_quoting) {
      return _panel(
        Row(
          children: [
            const SizedBox(
              width: 18,
              height: 18,
              child: CircularProgressIndicator(strokeWidth: 2, color: _kOrange),
            ),
            const SizedBox(width: 12),
            Text('Working out delivery…',
                style: _type(size: 13, color: _kBody)),
          ],
        ),
      );
    }

    if (_error != null) {
      return _panel(
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Icon(Icons.error_outline, size: 18, color: _kRed),
            const SizedBox(width: 12),
            Expanded(
              child: Text(_error!, style: _type(size: 13, color: _kRed)),
            ),
          ],
        ),
        tint: _kRed.withOpacity(0.06),
        edge: _kRed.withOpacity(0.25),
      );
    }

    final quote = _quote;
    if (quote == null) {
      return _panel(
        Text(
          'Type your address and we will work out the delivery fee.',
          style: _type(size: 13, color: _kMuted),
        ),
      );
    }

    final shortfall = quote.freeDeliveryFrom - _subtotal;

    return _panel(
      Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(Icons.local_shipping_outlined,
                  size: 18, color: quote.free ? _kGreen : _kOrange),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  quote.place ?? quote.label,
                  style: _type(size: 13, weight: FontWeight.w600),
                ),
              ),
              Text(
                quote.free ? 'FREE' : _ugx(quote.fee),
                style: _type(
                  size: 15,
                  weight: FontWeight.w700,
                  color: quote.free ? _kGreen : _kOrange,
                ),
              ),
            ],
          ),
          if (!quote.free && quote.freeDeliveryFrom > 0 && shortfall > 0) ...[
            const SizedBox(height: 10),
            Text(
              'Add ${_ugx(shortfall)} more to your basket for free delivery.',
              style: _type(size: 12, color: _kBody),
            ),
          ],
        ],
      ),
      tint: quote.free ? _kGreen.withOpacity(0.06) : _kSurface,
      edge: quote.free ? _kGreen.withOpacity(0.25) : _kLine,
    );
  }

  /// "Search your area" — the top slot, and the fastest correct answer here.
  ///
  /// Drawn as a search FIELD rather than a button, deliberately. A button
  /// saying "Search your area" is a thing to be pressed; a field with a
  /// magnifier and a grey prompt is a thing to be typed into, and it is
  /// recognised as such without being read. It is not actually a field — it
  /// opens the sheet — because a real one would need the suggestion list
  /// rendered inline underneath, and inline suggestions inside a scrolling
  /// form get covered by the keyboard on a short phone.
  ///
  /// Shows the chosen town once there is one, so this row doubles as the
  /// answer rather than staying an empty prompt above a filled-in form.
  Widget _areaButton() {
    final chosen = _cityCtrl.text.trim();
    final has = chosen.isNotEmpty;

    return GestureDetector(
      onTap: _openAreaSearch,
      child: Container(
        height: 48,
        padding: const EdgeInsets.symmetric(horizontal: 14),
        decoration: BoxDecoration(
          color: has ? _kOrange.withOpacity(0.06) : _kSurface,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: has ? _kOrange.withOpacity(0.45) : _kLine),
        ),
        child: Row(
          children: [
            Icon(Icons.search_rounded, size: 19, color: has ? _kOrange : _kMuted),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                has ? chosen : 'Search your area',
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: _type(
                  size: 14,
                  weight: has ? FontWeight.w600 : FontWeight.w400,
                  color: has ? _kInk : _kMuted,
                ),
              ),
            ),
            Text(
              has ? 'Change' : 'Ntinda, Jinja…',
              style: _type(
                size: 12,
                color: has ? _kOrangeDark : _kMuted,
                weight: has ? FontWeight.w600 : FontWeight.w400,
              ),
            ),
          ],
        ),
      ),
    );
  }

  /// The area picker: a filter field over `_kAreas`.
  ///
  /// ---- What this replaces ----
  ///
  /// Typing a town, waiting 700ms, and being told "We could not find that
  /// place. Try a nearby landmark or suburb." — with no clue what the
  /// geocoder would have accepted. Every name in this list is one that works,
  /// so a tap cannot produce that error.
  ///
  /// ---- Details ----
  ///
  /// The filter matches ANYWHERE in the name, not just the start: people
  /// search "kira" expecting Bweyogerere-Kira, and "gaba" for Ggaba. A
  /// prefix-only match is the version of this that feels broken.
  ///
  /// Names that START with the query sort first, so typing "kam" puts Kampala
  /// Central above Kamwokya above Bukamba — substring matching without that
  /// re-sort buries the exact thing being typed.
  ///
  /// `autofocus` on the field, because the sheet was opened by somebody who
  /// intends to type. It costs a keyboard animation nobody asked to wait for
  /// otherwise.
  ///
  /// A tap fills the town field and quotes IMMEDIATELY rather than waiting for
  /// the 700ms debounce: a tap is a finished decision, where a keystroke is
  /// not, and the debounce exists only for the second case.
  Future<void> _openAreaSearch() async {
    HapticFeedback.selectionClick();
    final queryCtrl = TextEditingController();

    await showModalBottomSheet<void>(
      context: context,
      backgroundColor: Colors.white,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(18)),
      ),
      builder: (rootSheetContext) {
        return StatefulBuilder(
          builder: (sheetContext, setSheetState) {
            final query = queryCtrl.text.trim().toLowerCase();

            final matches = query.isEmpty
                ? _kAreas
                : (_kAreas
                    .where((area) => area.toLowerCase().contains(query))
                    .toList()
                  ..sort((a, b) {
                    final aStarts = a.toLowerCase().startsWith(query);
                    final bStarts = b.toLowerCase().startsWith(query);
                    if (aStarts == bStarts) return a.compareTo(b);
                    return aStarts ? -1 : 1;
                  }));

            return Padding(
              // The keyboard. Without this the list is drawn behind it and the
              // matches for what is being typed are the ones covered up.
              padding: EdgeInsets.only(
                bottom: MediaQuery.of(sheetContext).viewInsets.bottom,
              ),
              child: SizedBox(
                height: MediaQuery.of(sheetContext).size.height * 0.75,
                child: Column(
                  children: [
                    Container(
                      width: 36,
                      height: 4,
                      margin: const EdgeInsets.only(top: 10, bottom: 12),
                      decoration: BoxDecoration(
                        color: _kLine,
                        borderRadius: BorderRadius.circular(2),
                      ),
                    ),
                    Padding(
                      padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
                      child: Container(
                        decoration: BoxDecoration(
                          color: _kSurface,
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(color: _kLine),
                        ),
                        child: Row(
                          children: [
                            const Padding(
                              padding: EdgeInsets.only(left: 12, right: 8),
                              child: Icon(Icons.search_rounded,
                                  size: 19, color: _kMuted),
                            ),
                            Expanded(
                              child: TextField(
                                controller: queryCtrl,
                                autofocus: true,
                                textInputAction: TextInputAction.search,
                                onChanged: (_) => setSheetState(() {}),
                                style: _type(size: 14),
                                decoration: InputDecoration(
                                  hintText: 'Type your town or suburb',
                                  hintStyle: _type(size: 14, color: _kMuted),
                                  border: InputBorder.none,
                                  contentPadding:
                                      const EdgeInsets.symmetric(vertical: 14),
                                ),
                              ),
                            ),
                            if (query.isNotEmpty)
                              GestureDetector(
                                onTap: () {
                                  queryCtrl.clear();
                                  setSheetState(() {});
                                },
                                child: const Padding(
                                  padding: EdgeInsets.symmetric(horizontal: 12),
                                  child: Icon(Icons.close_rounded,
                                      size: 18, color: _kMuted),
                                ),
                              ),
                          ],
                        ),
                      ),
                    ),
                    const Divider(height: 1, color: _kLine),
                    Expanded(
                      child: matches.isEmpty
                          // Not a dead end. Somewhere genuinely absent from the
                          // list is still deliverable — the town field is free
                          // text — so this offers the typed word rather than
                          // just reporting failure.
                          ? _areaNotFound(sheetContext, queryCtrl.text.trim())
                          : ListView.separated(
                              keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
                              itemCount: matches.length,
                              separatorBuilder: (_, __) => const Divider(
                                  height: 1, color: _kSurface, indent: 16),
                              itemBuilder: (_, i) => GestureDetector(
                                behavior: HitTestBehavior.opaque,
                                onTap: () {
                                  Navigator.of(sheetContext).pop();
                                  _chooseArea(matches[i]);
                                },
                                child: Padding(
                                  padding: const EdgeInsets.symmetric(
                                      horizontal: 16, vertical: 14),
                                  child: Row(
                                    children: [
                                      const Icon(Icons.place_outlined,
                                          size: 18, color: _kMuted),
                                      const SizedBox(width: 12),
                                      Expanded(
                                        child: Text(matches[i],
                                            style: _type(size: 14.5)),
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                            ),
                    ),
                  ],
                ),
              ),
            );
          },
        );
      },
    );

    queryCtrl.dispose();
  }

  /// Offers a typed word that is not on the list, rather than refusing it.
  Widget _areaNotFound(BuildContext sheetContext, String typed) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.travel_explore_outlined, size: 34, color: _kMuted),
            const SizedBox(height: 12),
            Text(
              'Not in our list — that is fine.',
              style: _type(size: 14, weight: FontWeight.w600),
            ),
            const SizedBox(height: 6),
            Text(
              'We can still work out delivery from it. Use it and we will '
              'look it up.',
              textAlign: TextAlign.center,
              style: _type(size: 12.5, color: _kBody),
            ),
            if (typed.isNotEmpty) ...[
              const SizedBox(height: 16),
              GestureDetector(
                onTap: () {
                  Navigator.of(sheetContext).pop();
                  _chooseArea(typed);
                },
                child: Container(
                  padding: const EdgeInsets.symmetric(
                      horizontal: 20, vertical: 12),
                  decoration: BoxDecoration(
                    color: _kOrange,
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Text(
                    'Use "$typed"',
                    style: _type(
                        size: 13.5,
                        weight: FontWeight.w700,
                        color: Colors.white),
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  /// Takes the picked area and prices it, without waiting on the debounce.
  void _chooseArea(String area) {
    HapticFeedback.selectionClick();
    _debounce?.cancel();
    setState(() {
      _cityCtrl.text = area;
      _quote = null;
      _error = null;
      // The saved point belonged to the OLD town. Leaving it would let a
      // shopper who changed area from Ntinda to Gulu save a record still
      // carrying the Ntinda coordinates — and the coordinates are what the
      // order is priced from, so the fee would be for a delivery nobody is
      // making. Cleared here and replaced by whatever the quote echoes back.
      _lat = null;
      _lng = null;
    });
    _requestQuote();
  }

  Widget _panel(Widget child, {Color? tint, Color? edge}) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: tint ?? _kSurface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: edge ?? _kLine),
      ),
      child: child,
    );
  }

  Widget _saveBar() {
    final enabled = _canSave && !_saving;
    return Container(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 16),
      decoration: const BoxDecoration(
        border: Border(top: BorderSide(color: _kLine)),
      ),
      child: GestureDetector(
        onTap: enabled ? _save : null,
        child: Container(
          height: 52,
          decoration: BoxDecoration(
            gradient: enabled
                ? const LinearGradient(colors: [_kOrange, _kOrangeDark])
                : null,
            color: enabled ? null : _kLine,
            borderRadius: BorderRadius.circular(12),
          ),
          child: Center(
            child: _saving
                ? const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(
                        strokeWidth: 2, color: Colors.white),
                  )
                : Text(
                    'Save address',
                    style: _type(
                      size: 15,
                      weight: FontWeight.w700,
                      color: enabled ? Colors.white : _kMuted,
                    ),
                  ),
          ),
        ),
      ),
    );
  }
}
