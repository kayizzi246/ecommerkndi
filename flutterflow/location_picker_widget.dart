// Automatic FlutterFlow imports
// ---- Two boilerplate imports are deliberately absent ----
//
// FlutterFlow's generated header normally opens with
//
//     import '/backend/backend.dart';
//     import '/backend/supabase/supabase.dart';
//
// and this project has neither file. See the note at the head of
// checkout_widget.dart — adding them back breaks the web build in every
// custom widget at once. Do not add them back.
import '/flutter_flow/flutter_flow_theme.dart';
import '/flutter_flow/flutter_flow_util.dart';
import '/custom_code/widgets/index.dart'; // Imports other custom widgets
import '/flutter_flow/custom_functions.dart'; // Imports custom functions
import 'package:flutter/material.dart';
// Begin custom widget code
// DO NOT REMOVE OR MODIFY THE CODE ABOVE!

import 'dart:async';
import 'dart:convert';

import 'package:flutter_map/flutter_map.dart';
import 'package:geolocator/geolocator.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:http/http.dart' as http;
import 'package:latlong2/latlong.dart';
import 'package:shared_preferences/shared_preferences.dart';

// ============================================================
//  KANDI — DELIVERY LOCATION PICKER
//
//  Sibling of cart_widget.dart, checkout_widget.dart and
//  delivery_address_widget.dart. Same brand, same type, same
//  storage record, same conventions.
//
//  PUBSUB DEPENDENCIES — ADD THESE IN FLUTTERFLOW
//  -----------------------------------------------------------
//  This file is the only one in the project that needs packages
//  beyond the shared set. In FlutterFlow they go on the custom
//  widget's Dependencies panel:
//
//      flutter_map: ^7.0.2
//      latlong2: ^0.9.1
//      geolocator: ^13.0.1
//
//  And the platform permission strings, which FlutterFlow does
//  not add for you:
//
//    android/app/src/main/AndroidManifest.xml
//      <uses-permission android:name=
//        "android.permission.ACCESS_FINE_LOCATION"/>
//      <uses-permission android:name=
//        "android.permission.ACCESS_COARSE_LOCATION"/>
//
//    ios/Runner/Info.plist
//      <key>NSLocationWhenInUseUsageDescription</key>
//      <string>Kandi uses your location to find your delivery
//       address and show you nearby stock.</string>
//
//  WHY OPENSTREETMAP AND GOOGLE, RATHER THAN ONE OF THEM
//  -----------------------------------------------------------
//  They are good at different halves of this job, and the halves
//  are separable:
//
//    • DRAWING THE MAP is OpenStreetMap, through `flutter_map`.
//      Raster tiles, no SDK, no API key, no per-load billing, and
//      no Google Play Services — which matters here, because a
//      meaningful share of Android handsets in this market ship
//      without them and google_maps_flutter renders a grey square
//      on those devices. OSM tiles are just images over HTTP.
//
//    • UNDERSTANDING THE PLACE is Google, through the Geocoding
//      and Places APIs. This is where Google is genuinely ahead
//      in Uganda: Nominatim knows the road, but Google knows
//      "Acacia Mall", "Ntinda Complex", "Kabalagala stage" — the
//      landmarks people actually give a rider. Search quality is
//      the whole value of the address step.
//
//  So: OSM renders, Google resolves. And when no Google key is
//  configured the resolving side falls back to OSM's own
//  Nominatim, so the screen still works end to end on a fresh
//  checkout rather than failing shut. That fallback is the reason
//  this is not simply "use Google": the app must not be unusable
//  because a key expired or a build has not had one set yet.
//
//  WHERE THE ANSWER GOES
//  -----------------------------------------------------------
//  Into the SAME SharedPreferences record every other screen
//  reads — `kandi_delivery_v2`. This file never invents a second
//  place to keep an address. Picking a pin in the cart is
//  therefore already visible on the checkout when the shopper
//  gets there, with no plumbing between the two screens, because
//  there is only one record and both read it on build.
// ============================================================

// ---- Brand, copied from the sibling screens ----
const Color _kOrange = Color(0xFFFF6A00);
const Color _kInk = Color(0xFF111827);
const Color _kBody = Color(0xFF4B5563);
const Color _kMuted = Color(0xFF6B7280);
const Color _kFaint = Color(0xFF9CA3AF);
const Color _kLine = Color(0xFFE5E7EB);
const Color _kSurface = Color(0xFFF3F4F6);

TextStyle _type({
  double size = 14,
  FontWeight weight = FontWeight.w400,
  Color color = _kInk,
  double height = 1.35,
}) {
  return GoogleFonts.inter(
    fontSize: size,
    fontWeight: weight,
    color: color,
    height: height,
  );
}

/// Where the shop lives, and where the map opens when nothing is known yet.
///
/// Kampala city centre. A map picker that opens on the middle of the ocean —
/// which is what (0,0) is — asks the shopper to pan across a continent before
/// they can do anything, and most give up rather than pan.
const LatLng _kFallbackCentre = LatLng(0.3476, 32.5825);

/// The Google key, read from the build environment.
///
/// `--dart-define=GOOGLE_MAPS_API_KEY=...` at build time, which is how
/// FlutterFlow passes secrets into custom code without them being committed.
/// Empty is a supported state, not an error: everything below falls back to
/// Nominatim when this is blank. See the note at the head of the file.
const String _kGoogleKey = String.fromEnvironment('GOOGLE_MAPS_API_KEY');

bool get _hasGoogle => _kGoogleKey.trim().isNotEmpty;

/// Identifies this app to Nominatim, which requires it.
///
/// OSM's public geocoder rejects or throttles clients that do not name
/// themselves. This is their stated condition of use, not a nicety.
const String _kUserAgent = 'KandiUgApp/1.0 (https://kandiug.com)';

// ============================================================
//  STORAGE
// ============================================================

/// The saved delivery record.
///
/// Deliberately a duplicate of the readers in the sibling files — a top-level
/// class cannot cross a FlutterFlow file boundary, so the STORAGE KEY and the
/// JSON shape are the contract and each file carries its own reader. Change the
/// shape here and you change it in cart_widget, checkout_widget and
/// delivery_address_widget too.
class _Store {
  _Store._();

  static const String recordKey = 'kandi_delivery_v2';
  static const String legacyKey = 'kandi_delivery_address';

  static Future<Map<String, dynamic>> read() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final raw = prefs.getString(recordKey);
      if (raw != null && raw.trim().isNotEmpty) {
        final decoded = jsonDecode(raw);
        if (decoded is Map) return Map<String, dynamic>.from(decoded);
      }
    } catch (_) {}
    return <String, dynamic>{};
  }

  /// Merges a picked point into whatever is already saved.
  ///
  /// A merge rather than a write, and this is the whole reason this method
  /// exists: the record also holds the recipient's name and phone, collected on
  /// the address screen. Someone who has ordered before and is only moving the
  /// pin must not have their phone number silently erased by it — that is an
  /// order that cannot be delivered, caused by a screen that never mentioned
  /// phone numbers.
  static Future<Map<String, dynamic>> merge(Map<String, dynamic> patch) async {
    final current = await read();
    current.addAll(patch);
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(recordKey, jsonEncode(current));
      await prefs.setString(
        legacyKey,
        (current['address'] ?? '').toString().trim(),
      );
    } catch (_) {}
    return current;
  }
}

// ============================================================
//  GEOCODING — Google first, Nominatim as the floor
// ============================================================

/// One place, as both screens need it: a label, a sub-label and a point.
class KandiPlace {
  const KandiPlace({
    required this.title,
    required this.subtitle,
    required this.lat,
    required this.lng,
  });

  final String title;
  final String subtitle;
  final double lat;
  final double lng;

  LatLng get point => LatLng(lat, lng);

  /// The one line a rider reads.
  String get full =>
      subtitle.isEmpty ? title : (title.isEmpty ? subtitle : '$title, $subtitle');
}

class _Geo {
  _Geo._();

  static final http.Client _client = http.Client();
  static const Duration _timeout = Duration(seconds: 12);

  /// Turns a point into an address.
  ///
  /// Returns null rather than throwing. Every caller has something sensible to
  /// show when this fails — the coordinates themselves — and a picker that
  /// throws away a perfectly good pin because a geocoder timed out is worse
  /// than one that says "Pinned location" and takes the order.
  static Future<KandiPlace?> reverse(LatLng at) async {
    if (_hasGoogle) {
      final viaGoogle = await _googleReverse(at);
      if (viaGoogle != null) return viaGoogle;
    }
    return _nominatimReverse(at);
  }

  /// Searches for a place by name.
  static Future<List<KandiPlace>> search(String query) async {
    final trimmed = query.trim();
    if (trimmed.length < 3) return const <KandiPlace>[];
    if (_hasGoogle) {
      final viaGoogle = await _googleSearch(trimmed);
      if (viaGoogle.isNotEmpty) return viaGoogle;
    }
    return _nominatimSearch(trimmed);
  }

  // ---- Google ----

  static Future<KandiPlace?> _googleReverse(LatLng at) async {
    try {
      final uri = Uri.https('maps.googleapis.com', '/maps/api/geocode/json', {
        'latlng': '${at.latitude},${at.longitude}',
        'key': _kGoogleKey,
        'region': 'ug',
      });
      final response = await _client.get(uri).timeout(_timeout);
      if (response.statusCode != 200) return null;
      final data = jsonDecode(response.body);
      if (data is! Map) return null;
      final results = data['results'];
      if (results is! List || results.isEmpty) return null;

      final first = results.first as Map;
      final formatted = (first['formatted_address'] ?? '').toString();
      // The first comma-separated part is the street or landmark, which is the
      // headline; the rest is the area, which is the sub-label. Google puts the
      // country on the end of every one of these and it is noise in a shop that
      // only delivers in one country.
      final parts = formatted
          .split(',')
          .map((s) => s.trim())
          .where((s) => s.isNotEmpty && s.toLowerCase() != 'uganda')
          .toList();
      if (parts.isEmpty) return null;
      return KandiPlace(
        title: parts.first,
        subtitle: parts.skip(1).join(', '),
        lat: at.latitude,
        lng: at.longitude,
      );
    } catch (_) {
      return null;
    }
  }

  static Future<List<KandiPlace>> _googleSearch(String query) async {
    try {
      // Text Search rather than Autocomplete: Autocomplete returns place_ids
      // that then need a second Details call each to get coordinates, which is
      // two round trips and two billed requests per tap. Text Search returns
      // the geometry in the first response.
      final uri =
          Uri.https('maps.googleapis.com', '/maps/api/place/textsearch/json', {
        'query': query,
        'key': _kGoogleKey,
        'region': 'ug',
        // Bias hard to the shop's own city rather than filtering to it: a
        // shopper searching "Entebbe Road" should still get it, but "Acacia"
        // should mean the Kampala one.
        'location': '${_kFallbackCentre.latitude},${_kFallbackCentre.longitude}',
        'radius': '50000',
      });
      final response = await _client.get(uri).timeout(_timeout);
      if (response.statusCode != 200) return const <KandiPlace>[];
      final data = jsonDecode(response.body);
      if (data is! Map) return const <KandiPlace>[];
      final results = data['results'];
      if (results is! List) return const <KandiPlace>[];

      final out = <KandiPlace>[];
      for (final entry in results.take(6)) {
        if (entry is! Map) continue;
        final location = entry['geometry']?['location'];
        if (location is! Map) continue;
        final lat = location['lat'], lng = location['lng'];
        if (lat is! num || lng is! num) continue;
        out.add(KandiPlace(
          title: (entry['name'] ?? '').toString(),
          subtitle: (entry['formatted_address'] ?? '')
              .toString()
              .replaceAll(RegExp(r',?\s*Uganda$'), ''),
          lat: lat.toDouble(),
          lng: lng.toDouble(),
        ));
      }
      return out;
    } catch (_) {
      return const <KandiPlace>[];
    }
  }

  // ---- Nominatim, the fallback ----

  static Future<KandiPlace?> _nominatimReverse(LatLng at) async {
    try {
      final uri = Uri.https('nominatim.openstreetmap.org', '/reverse', {
        'lat': at.latitude.toString(),
        'lon': at.longitude.toString(),
        'format': 'jsonv2',
        'zoom': '18',
      });
      final response = await _client
          .get(uri, headers: {'User-Agent': _kUserAgent})
          .timeout(_timeout);
      if (response.statusCode != 200) return null;
      final data = jsonDecode(response.body);
      if (data is! Map) return null;

      final address = data['address'];
      String pick(List<String> keys) {
        if (address is! Map) return '';
        for (final key in keys) {
          final value = address[key];
          if (value != null && value.toString().trim().isNotEmpty) {
            return value.toString();
          }
        }
        return '';
      }

      final title = pick(['road', 'neighbourhood', 'suburb', 'quarter']);
      final area = pick(['suburb', 'city', 'town', 'county']);
      if (title.isEmpty && area.isEmpty) return null;
      return KandiPlace(
        title: title.isEmpty ? area : title,
        subtitle: title.isEmpty ? '' : area,
        lat: at.latitude,
        lng: at.longitude,
      );
    } catch (_) {
      return null;
    }
  }

  static Future<List<KandiPlace>> _nominatimSearch(String query) async {
    try {
      final uri = Uri.https('nominatim.openstreetmap.org', '/search', {
        'q': query,
        'format': 'jsonv2',
        'countrycodes': 'ug',
        'limit': '6',
      });
      final response = await _client
          .get(uri, headers: {'User-Agent': _kUserAgent})
          .timeout(_timeout);
      if (response.statusCode != 200) return const <KandiPlace>[];
      final data = jsonDecode(response.body);
      if (data is! List) return const <KandiPlace>[];

      final out = <KandiPlace>[];
      for (final entry in data) {
        if (entry is! Map) continue;
        final lat = double.tryParse((entry['lat'] ?? '').toString());
        final lng = double.tryParse((entry['lon'] ?? '').toString());
        if (lat == null || lng == null) continue;
        final display = (entry['display_name'] ?? '').toString();
        final parts = display
            .split(',')
            .map((s) => s.trim())
            .where((s) => s.isNotEmpty && s.toLowerCase() != 'uganda')
            .toList();
        if (parts.isEmpty) continue;
        out.add(KandiPlace(
          title: parts.first,
          subtitle: parts.skip(1).take(3).join(', '),
          lat: lat,
          lng: lng,
        ));
      }
      return out;
    } catch (_) {
      return const <KandiPlace>[];
    }
  }
}

// ============================================================
//  THE SHEET — "Choose delivery location"
// ============================================================

/// The two-option sheet, and the entry point every other screen calls.
///
/// One symbol, because that is all FlutterFlow exports from a custom widget
/// file: `KandiLocationSheet.choose(context)`. The cart calls it when the
/// shopper taps the delivery bar; the checkout calls the same one when they tap
/// Change on the address card. Two callers, one screen, so the two can never
/// present a different set of choices.
///
/// Resolves with the merged delivery record when a location was picked, or null
/// when the shopper backed out — so a caller can tell "changed" from "left it
/// alone" and avoid re-rendering for nothing.
class KandiLocationSheet extends StatelessWidget {
  const KandiLocationSheet({super.key});

  static Future<Map<String, dynamic>?> choose(BuildContext context) {
    return showModalBottomSheet<Map<String, dynamic>>(
      context: context,
      // The map is a full-height screen pushed from inside this sheet, so the
      // sheet itself only ever needs its natural height.
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      // Talabat's sheet dims hard and the reason is legibility, not drama: the
      // page behind it is a wall of product photography, and a light scrim
      // leaves white cards competing with white cards.
      barrierColor: Colors.black.withOpacity(0.45),
      builder: (_) => const KandiLocationSheet(),
    );
  }

  @override
  Widget build(BuildContext context) {
    final bottomInset = MediaQuery.of(context).padding.bottom;

    return Container(
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(22)),
      ),
      padding: EdgeInsets.fromLTRB(20, 10, 20, 20 + bottomInset),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // The grab handle. It is not decoration — it is the only thing that
          // says this panel can be flicked away, and without it people hunt for
          // the X or press the system back button.
          Center(
            child: Container(
              width: 44,
              height: 4,
              decoration: BoxDecoration(
                color: _kLine,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),
          const SizedBox(height: 16),

          // Close, then the title under it rather than beside it. A title
          // centred between an X and nothing is a title that is not actually
          // centred on anything, and it wastes the full width the heading wants.
          _CircleButton(
            icon: Icons.close,
            onTap: () => Navigator.of(context).pop(),
          ),
          const SizedBox(height: 18),
          Text(
            'Choose delivery location',
            style: _type(size: 21, weight: FontWeight.w700),
          ),
          const SizedBox(height: 4),
          Text(
            'So we know where to send your order.',
            style: _type(size: 13.5, color: _kMuted),
          ),
          const SizedBox(height: 18),
          const Divider(height: 1, color: _kLine),
          const SizedBox(height: 18),

          _OptionRow(
            icon: Icons.location_searching,
            title: 'Deliver to a different location',
            subtitle: 'Choose the spot on a map',
            onTap: () async {
              final picked = await _MapPickerPage.open(context);
              if (picked != null && context.mounted) {
                Navigator.of(context).pop(picked);
              }
            },
          ),
          const SizedBox(height: 12),
          _OptionRow(
            icon: Icons.near_me,
            title: 'Deliver to current location',
            subtitle: 'Allow Kandi to access your location',
            onTap: () => _useCurrent(context),
          ),
        ],
      ),
    );
  }

  /// Take the GPS fix, then open the map on it — do not just save it.
  ///
  /// A raw fix is accurate to somewhere between 5m and 50m depending on the
  /// handset and whether it is indoors, and in a city that is the difference
  /// between a shop and the flat above it. Dropping the shopper onto the map at
  /// their own position lets them nudge the pin the twenty metres that matters
  /// and confirm what they see, which is the difference between an address they
  /// accepted and one they were assigned.
  Future<void> _useCurrent(BuildContext context) async {
    final messenger = ScaffoldMessenger.maybeOf(context);
    final navigator = Navigator.of(context);

    LatLng? fix;
    try {
      if (!await Geolocator.isLocationServiceEnabled()) {
        messenger?.showSnackBar(const SnackBar(
          content: Text('Turn on location services to use this.'),
        ));
        return;
      }
      var permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
      }
      if (permission == LocationPermission.denied ||
          permission == LocationPermission.deniedForever) {
        messenger?.showSnackBar(const SnackBar(
          content: Text('Location permission is off — pick on the map instead.'),
        ));
        return;
      }

      final position = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.high,
          // A fix is not worth an indefinite wait on a weak signal. Past this
          // the map opens on the city instead, which is still usable.
          timeLimit: Duration(seconds: 12),
        ),
      );
      fix = LatLng(position.latitude, position.longitude);
    } catch (_) {
      messenger?.showSnackBar(const SnackBar(
        content: Text('Could not get your location — pick on the map instead.'),
      ));
      return;
    }

    if (!context.mounted) return;
    final picked = await _MapPickerPage.open(context, start: fix);
    if (picked != null) navigator.pop(picked);
  }
}

/// One tappable option in the sheet.
class _OptionRow extends StatelessWidget {
  const _OptionRow({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.onTap,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.white,
      borderRadius: BorderRadius.circular(14),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(14),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
          decoration: BoxDecoration(
            border: Border.all(color: _kLine),
            borderRadius: BorderRadius.circular(14),
          ),
          child: Row(
            children: [
              Container(
                width: 38,
                height: 38,
                decoration: BoxDecoration(
                  color: _kOrange.withOpacity(0.10),
                  borderRadius: BorderRadius.circular(11),
                ),
                child: Icon(icon, size: 20, color: _kOrange),
              ),
              const SizedBox(width: 13),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(title,
                        style: _type(size: 14.5, weight: FontWeight.w600)),
                    const SizedBox(height: 2),
                    Text(subtitle, style: _type(size: 12.5, color: _kMuted)),
                  ],
                ),
              ),
              const Icon(Icons.chevron_right, size: 22, color: _kFaint),
            ],
          ),
        ),
      ),
    );
  }
}

class _CircleButton extends StatelessWidget {
  const _CircleButton({required this.icon, required this.onTap});

  final IconData icon;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.white,
      shape: const CircleBorder(),
      child: InkWell(
        onTap: onTap,
        customBorder: const CircleBorder(),
        child: Container(
          width: 40,
          height: 40,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            border: Border.all(color: _kLine),
          ),
          child: Icon(icon, size: 20, color: _kInk),
        ),
      ),
    );
  }
}

// ============================================================
//  THE MAP — drag the map, not the pin
// ============================================================

class _MapPickerPage extends StatefulWidget {
  const _MapPickerPage({this.start});

  final LatLng? start;

  static Future<Map<String, dynamic>?> open(
    BuildContext context, {
    LatLng? start,
  }) {
    return Navigator.of(context).push<Map<String, dynamic>>(
      MaterialPageRoute<Map<String, dynamic>>(
        builder: (_) => _MapPickerPage(start: start),
      ),
    );
  }

  @override
  State<_MapPickerPage> createState() => _MapPickerPageState();
}

class _MapPickerPageState extends State<_MapPickerPage> {
  final MapController _map = MapController();
  final TextEditingController _searchCtrl = TextEditingController();

  LatLng _centre = _kFallbackCentre;
  KandiPlace? _resolved;
  bool _resolving = false;
  bool _saving = false;

  List<KandiPlace> _results = const <KandiPlace>[];
  bool _searching = false;
  Timer? _debounce;

  /// Guards against an older reverse-geocode landing after a newer one.
  ///
  /// Panning fires these continuously. Without a sequence number the label
  /// under the pin can end up showing wherever the map was two drags ago,
  /// because that request happened to be slower — and the shopper then confirms
  /// a place they are no longer looking at.
  int _resolveSeq = 0;

  @override
  void initState() {
    super.initState();
    _centre = widget.start ?? _kFallbackCentre;
    _restoreSaved();
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _searchCtrl.dispose();
    super.dispose();
  }

  /// Open on the pin the shopper last confirmed, when there is one and no
  /// explicit start was passed. Re-picking is nearly always a small correction
  /// to a known address, not a fresh search from the middle of the city.
  Future<void> _restoreSaved() async {
    if (widget.start == null) {
      final saved = await _Store.read();
      final lat = saved['lat'], lng = saved['lng'];
      if (lat is num && lng is num && mounted) {
        setState(() => _centre = LatLng(lat.toDouble(), lng.toDouble()));
        _map.move(_centre, 16.5);
      }
    }
    _resolve(_centre);
  }

  Future<void> _resolve(LatLng at) async {
    final seq = ++_resolveSeq;
    setState(() => _resolving = true);
    final place = await _Geo.reverse(at);
    if (!mounted || seq != _resolveSeq) return;
    setState(() {
      _resolving = false;
      _resolved = place ??
          KandiPlace(
            // Never a dead end. A pin with no name is still a deliverable point,
            // and the coordinates are what the rider's app actually uses.
            title: 'Pinned location',
            subtitle:
                '${at.latitude.toStringAsFixed(5)}, ${at.longitude.toStringAsFixed(5)}',
            lat: at.latitude,
            lng: at.longitude,
          );
    });
  }

  void _onSearchChanged(String value) {
    _debounce?.cancel();
    if (value.trim().length < 3) {
      setState(() => _results = const <KandiPlace>[]);
      return;
    }
    // 400ms: long enough that typing "Kabalagala" is one request rather than
    // ten, short enough that it still feels like it is keeping up.
    _debounce = Timer(const Duration(milliseconds: 400), () async {
      setState(() => _searching = true);
      final found = await _Geo.search(value);
      if (!mounted) return;
      setState(() {
        _results = found;
        _searching = false;
      });
    });
  }

  void _pick(KandiPlace place) {
    FocusScope.of(context).unfocus();
    setState(() {
      _results = const <KandiPlace>[];
      _searchCtrl.clear();
      _centre = place.point;
      _resolved = place;
    });
    _map.move(place.point, 17);
  }

  Future<void> _confirm() async {
    final place = _resolved;
    if (place == null || _saving) return;
    setState(() => _saving = true);

    // Merged, not written — the recipient's name and phone live in this record
    // too. See `_Store.merge`.
    final record = await _Store.merge(<String, dynamic>{
      'address': place.full,
      'city': place.subtitle.isEmpty ? place.title : place.subtitle,
      'place': place.full,
      'lat': _centre.latitude,
      'lng': _centre.longitude,
    });

    if (!mounted) return;
    Navigator.of(context).pop(record);
  }

  @override
  Widget build(BuildContext context) {
    final bottomInset = MediaQuery.of(context).padding.bottom;

    return Scaffold(
      backgroundColor: Colors.white,
      body: Stack(
        children: [
          // ---- The map ----
          FlutterMap(
            mapController: _map,
            options: MapOptions(
              initialCenter: _centre,
              initialZoom: 16.5,
              minZoom: 4,
              maxZoom: 19,
              interactionOptions: const InteractionOptions(
                // Rotation off. A rotated map has no upside for choosing a
                // delivery point and every accidental two-finger twist leaves
                // north pointing sideways, which people cannot undo.
                flags: InteractiveFlag.all & ~InteractiveFlag.rotate,
              ),
              // flutter_map 7 hands back a MapCamera whose `center` is
              // non-nullable, so there is nothing to null-check here.
              onPositionChanged: (camera, hasGesture) {
                _centre = camera.center;
                // Only while a finger is involved: programmatic moves from
                // search already know their own address and re-resolving would
                // overwrite a good Google name with a vaguer reverse lookup.
                if (hasGesture) {
                  _debounce?.cancel();
                  _debounce = Timer(
                    const Duration(milliseconds: 500),
                    () => _resolve(_centre),
                  );
                }
              },
            ),
            children: [
              TileLayer(
                urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                // OSM's tile policy requires a real identifier. An app that
                // does not send one gets blocked, and it gets blocked in
                // production rather than in testing.
                userAgentPackageName: 'com.kandiug.app',
                maxNativeZoom: 19,
              ),
              // Attribution is a licence condition of using OSM tiles, not a
              // credit we may drop for tidiness.
              const RichAttributionWidget(
                alignment: AttributionAlignment.bottomLeft,
                attributions: [
                  TextSourceAttribution('OpenStreetMap contributors'),
                ],
              ),
            ],
          ),

          // ---- The pin ----
          //
          // Fixed dead centre of the screen, and the MAP moves under it. That is
          // the pattern every delivery app converged on, and the reason is the
          // thumb: a draggable pin is under your finger exactly when you most
          // need to see it, so you place it blind and then check. A fixed pin is
          // always visible and always exactly where the crosshair says.
          //
          // Offset up by half its own height so the POINT of the pin sits on the
          // centre, not the middle of the teardrop — an 18px error at street
          // zoom, which is a building.
          IgnorePointer(
            child: Center(
              child: Transform.translate(
                offset: const Offset(0, -18),
                child: _Pin(lifted: _resolving),
              ),
            ),
          ),

          // ---- Search, back, and the results over the map ----
          Positioned(
            top: 0,
            left: 0,
            right: 0,
            child: SafeArea(
              bottom: false,
              child: Padding(
                padding: const EdgeInsets.fromLTRB(14, 10, 14, 0),
                child: Column(
                  children: [
                    Row(
                      children: [
                        _CircleButton(
                          icon: Icons.arrow_back,
                          onTap: () => Navigator.of(context).pop(),
                        ),
                        const SizedBox(width: 10),
                        Expanded(child: _searchField()),
                      ],
                    ),
                    if (_results.isNotEmpty || _searching) _resultsPanel(),
                  ],
                ),
              ),
            ),
          ),

          // ---- The confirm card ----
          Positioned(
            left: 0,
            right: 0,
            bottom: 0,
            child: _confirmCard(bottomInset),
          ),
        ],
      ),
    );
  }

  Widget _searchField() {
    return Container(
      height: 46,
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(23),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.10),
            blurRadius: 12,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      padding: const EdgeInsets.symmetric(horizontal: 14),
      child: Row(
        children: [
          const Icon(Icons.search, size: 20, color: _kMuted),
          const SizedBox(width: 8),
          Expanded(
            child: TextField(
              controller: _searchCtrl,
              onChanged: _onSearchChanged,
              textInputAction: TextInputAction.search,
              style: _type(size: 14.5),
              decoration: InputDecoration(
                isDense: true,
                border: InputBorder.none,
                hintText: 'Search area, street or landmark',
                hintStyle: _type(size: 14, color: _kFaint),
              ),
            ),
          ),
          if (_searchCtrl.text.isNotEmpty)
            GestureDetector(
              onTap: () {
                _searchCtrl.clear();
                setState(() => _results = const <KandiPlace>[]);
              },
              child: const Icon(Icons.close, size: 18, color: _kMuted),
            ),
        ],
      ),
    );
  }

  Widget _resultsPanel() {
    return Container(
      margin: const EdgeInsets.only(top: 8),
      constraints: const BoxConstraints(maxHeight: 280),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.12),
            blurRadius: 18,
            offset: const Offset(0, 6),
          ),
        ],
      ),
      child: _searching
          ? Padding(
              padding: const EdgeInsets.all(18),
              child: Row(
                children: [
                  const SizedBox(
                    width: 16,
                    height: 16,
                    child: CircularProgressIndicator(
                        strokeWidth: 2, color: _kOrange),
                  ),
                  const SizedBox(width: 12),
                  Text('Searching…', style: _type(size: 13.5, color: _kMuted)),
                ],
              ),
            )
          : ListView.separated(
              shrinkWrap: true,
              padding: const EdgeInsets.symmetric(vertical: 6),
              itemCount: _results.length,
              separatorBuilder: (_, __) =>
                  const Divider(height: 1, color: _kLine, indent: 52),
              itemBuilder: (_, index) {
                final place = _results[index];
                return ListTile(
                  dense: true,
                  leading: const Icon(Icons.place_outlined,
                      size: 20, color: _kMuted),
                  title: Text(place.title,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: _type(size: 14, weight: FontWeight.w600)),
                  subtitle: place.subtitle.isEmpty
                      ? null
                      : Text(place.subtitle,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: _type(size: 12, color: _kMuted)),
                  onTap: () => _pick(place),
                );
              },
            ),
    );
  }

  Widget _confirmCard(double bottomInset) {
    final place = _resolved;
    return Container(
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(22)),
        boxShadow: [
          BoxShadow(color: Color(0x1A000000), blurRadius: 20, offset: Offset(0, -4)),
        ],
      ),
      padding: EdgeInsets.fromLTRB(18, 16, 18, 16 + bottomInset),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Icon(Icons.place, size: 22, color: _kOrange),
              const SizedBox(width: 10),
              Expanded(
                child: _resolving
                    ? Text('Finding this place…',
                        style: _type(size: 14.5, color: _kMuted))
                    : Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            place?.title ?? 'Move the map to your location',
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style:
                                _type(size: 15.5, weight: FontWeight.w700),
                          ),
                          if ((place?.subtitle ?? '').isNotEmpty) ...[
                            const SizedBox(height: 2),
                            Text(place!.subtitle,
                                maxLines: 2,
                                overflow: TextOverflow.ellipsis,
                                style: _type(size: 12.5, color: _kMuted)),
                          ],
                        ],
                      ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          SizedBox(
            width: double.infinity,
            height: 50,
            child: ElevatedButton(
              onPressed: (_resolving || _saving) ? null : _confirm,
              style: ElevatedButton.styleFrom(
                backgroundColor: _kOrange,
                disabledBackgroundColor: _kOrange.withOpacity(0.45),
                foregroundColor: Colors.white,
                elevation: 0,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(13),
                ),
              ),
              child: _saving
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(
                          strokeWidth: 2, color: Colors.white),
                    )
                  : Text('Confirm location',
                      style: _type(
                          size: 15.5,
                          weight: FontWeight.w700,
                          color: Colors.white)),
            ),
          ),
        ],
      ),
    );
  }
}

/// The centre pin, which lifts while the map is settling.
///
/// The lift is the only feedback that a drag was registered — without it, a pan
/// on a slow tile load looks like nothing happened at all.
class _Pin extends StatelessWidget {
  const _Pin({required this.lifted});

  final bool lifted;

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        AnimatedContainer(
          duration: const Duration(milliseconds: 160),
          transform: Matrix4.translationValues(0, lifted ? -8 : 0, 0),
          child: const Icon(Icons.location_on, size: 44, color: _kOrange),
        ),
        // The shadow stays put while the pin lifts off it, which is what makes
        // the lift read as height rather than as the whole marker sliding.
        Container(
          width: 10,
          height: 4,
          decoration: BoxDecoration(
            color: Colors.black.withOpacity(0.28),
            borderRadius: BorderRadius.circular(2),
          ),
        ),
      ],
    );
  }
}
