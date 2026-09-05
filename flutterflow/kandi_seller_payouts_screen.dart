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

import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

// ============================================================
//  KANDI — COMMISSIONS AND PAYOUTS
//
//  What the shop owes the trader, what it has already paid, and
//  the line-by-line arithmetic behind both.
//
//  Self-contained like every page here; the architecture is at
//  the head of kandi_home_screen.dart.
//
//  ---- Why the working is shown and not just the total ----
//
//  Commission is the most-argued number in any marketplace, and
//  a single figure with no working is the fastest way to lose a
//  trader's trust in it. Every entry carries its gross, the rate
//  applied, the commission taken and the net — so a seller who
//  thinks a payout is wrong can find the order it came from
//  rather than ringing to ask.
//
//  Nothing here is computed on the phone. The rate, the
//  commission and the net all come from the server, because a
//  second implementation of this arithmetic that disagreed with
//  the shop's by one shilling would be worse than no figure at
//  all.
// ============================================================

class _KColors {
  const _KColors._();
  static const Color canvas = Color(0xFFFFFFFF);
  static const Color panel = Color(0xFFFFFFFF);
  static const Color ink = Color(0xFF0B0B0B);
  static const Color body = Color(0xFF414346);
  static const Color muted = Color(0xFF5D6066);
  static const Color line = Color(0xFFE0E0E0);
  static const Color hairline = Color(0xFFF2F2F2);
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

  /// ---- The edge that makes a white card visible on a white page ----
  ///
  /// The app used to stand its tiles on #F5F5F5 and let the contrast do the
  /// separating. The site does not: its canvas is #ffffff, the same as the
  /// panel, so the tile is drawn by a 1px ring and nothing else. Matching the
  /// ground without matching the ring would have produced a grid of tiles with
  /// no edges at all.
  static const Color edge = Color(0xFFDEDEDE);


}

class _KSpace {
  const _KSpace._();
  static const double sm = 8;
  static const double md = 12;
  static const double lg = 16;
  static const double xl = 24;
}

const double _rPanel = 12;

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

class _KEntry {
  const _KEntry({
    required this.orderId,
    required this.date,
    required this.gross,
    required this.rate,
    required this.commission,
    required this.net,
    required this.status,
  });

  final int orderId;
  final String date;
  final num gross;
  final num rate;
  final num commission;
  final num net;

  /// `pending`, `payable` or `paid`.
  final String status;

  Color get tone {
    if (status == 'paid') return _KColors.save;
    if (status == 'payable') return _KColors.info;
    return _KColors.warn;
  }

  Color get toneSoft {
    if (status == 'paid') return _KColors.saveSoft;
    if (status == 'payable') return _KColors.infoSoft;
    return _KColors.warnSoft;
  }

  static List<_KEntry> listFrom(dynamic json) {
    if (json is! List) return const [];
    final out = <_KEntry>[];
    for (final row in json) {
      if (row is! Map) continue;
      out.add(_KEntry(
        orderId: row['order_id'] is int ? row['order_id'] as int : 0,
        date: (row['date'] ?? '').toString(),
        gross: row['gross'] is num ? row['gross'] as num : 0,
        rate: row['rate'] is num ? row['rate'] as num : 0,
        commission: row['commission'] is num ? row['commission'] as num : 0,
        net: row['net'] is num ? row['net'] as num : 0,
        status: (row['status'] ?? 'pending').toString(),
      ));
    }
    return out;
  }
}

class KandiSellerPayoutsScreen extends StatefulWidget {
  const KandiSellerPayoutsScreen({super.key, this.width, this.height});

  final double? width;
  final double? height;

  @override
  State<KandiSellerPayoutsScreen> createState() =>
      _KandiSellerPayoutsScreenState();
}

class _KandiSellerPayoutsScreenState extends State<KandiSellerPayoutsScreen> {
  bool _loading = true;
  bool _signedOut = false;
  bool _failed = false;
  String _range = '30d';

  num _gross = 0;
  num _commissionTotal = 0;
  num _netTotal = 0;
  num _paid = 0;
  num _payable = 0;
  num _pending = 0;
  num _rate = 0;
  List<_KEntry> _entries = const [];

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
        Uri.parse('$_apiBase/api/app/seller/commissions?range=$_range'),
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

    if (status != 200 || data is! Map) {
      setState(() {
        _loading = false;
        _failed = true;
      });
      return;
    }

    num n(String key) => data[key] is num ? data[key] as num : 0;

    setState(() {
      _loading = false;
      _failed = false;
      _gross = n('gross');
      _commissionTotal = n('commission_total');
      _netTotal = n('net_total');
      _paid = n('paid');
      _payable = n('payable');
      _pending = n('pending');
      _rate = n('rate');
      _entries = _KEntry.listFrom(data['entries']);
    });
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
          title: const Text('Commissions',
              style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w700,
                  color: Colors.white)),
        ),
        body: _buildBody(),
      ),
    );
  }

  Widget _buildBody() {
    // A skeleton of the right shape rather than a spinner — see `_Skeleton`.
    if (_loading) return const _Skeleton();

    if (_signedOut) {
      return _message(
        icon: Icons.lock_outline_rounded,
        title: 'Your seller session ended',
        message: 'Sign in again from the Seller Centre.',
        actionLabel: 'Back',
        onAction: () => Navigator.of(context).maybePop(),
      );
    }

    if (_failed) {
      return _message(
        icon: Icons.wifi_off_rounded,
        title: 'Could not load your commissions',
        message: 'Check your connection and try again.',
        actionLabel: 'Try again',
        onAction: _load,
      );
    }

    return RefreshIndicator(
      color: _KColors.primary,
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.all(_KSpace.md),
        children: [
          Row(
            children: [
              for (final option in const [
                (key: '7d', label: '7 days'),
                (key: '30d', label: '30 days'),
                (key: '90d', label: '90 days'),
              ])
                Padding(
                  padding: const EdgeInsets.only(right: _KSpace.sm),
                  child: GestureDetector(
                    onTap: () {
                      if (_range == option.key) return;
                      setState(() => _range = option.key);
                      _load();
                    },
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: _KSpace.md, vertical: _KSpace.sm),
                      decoration: BoxDecoration(
                        color: _range == option.key
                            ? _KColors.flameSoft
                            : _KColors.panel,
                        // A pill, like every other filter in the app.
                        borderRadius: BorderRadius.circular(_rPill),
                        border: Border.all(
                            color: _range == option.key
                                ? _KColors.flame
                                : _KColors.line,
                            width: _range == option.key ? 1.5 : 1),
                      ),
                      child: Text(option.label,
                          style: TextStyle(
                              fontSize: 13,
                              fontWeight: _range == option.key
                                  ? FontWeight.w700
                                  : FontWeight.w500,
                              color: _KColors.ink)),
                    ),
                  ),
                ),
            ],
          ),
          const SizedBox(height: _KSpace.md),

          // The figure a trader actually came for, given the whole panel.
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(_KSpace.lg),
            decoration: BoxDecoration(
              color: _KColors.saveSoft,
              borderRadius: BorderRadius.circular(_rPanel),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('Waiting to be paid to you',
                    style: TextStyle(fontSize: 12.5, color: _KColors.save)),
                const SizedBox(height: 4),
                Text(_money(_payable),
                    style: const TextStyle(
                        fontSize: 26,
                        height: 1.1,
                        fontWeight: FontWeight.w800,
                        color: _KColors.save)),
                if (_pending > 0) ...[
                  const SizedBox(height: 6),
                  Text(
                    '${_money(_pending)} still pending — released once those orders complete.',
                    style:
                        const TextStyle(fontSize: 12, color: _KColors.body),
                  ),
                ],
              ],
            ),
          ),
          const SizedBox(height: _KSpace.md),

          _panel(
            title: 'How it adds up',
            child: Column(
              children: [
                _line('Your sales', _money(_gross)),
                _line(
                  _rate > 0
                      ? 'Kandi commission (${_rate.toStringAsFixed(_rate % 1 == 0 ? 0 : 1)}%)'
                      : 'Kandi commission',
                  '− ${_money(_commissionTotal)}',
                  tone: _KColors.warn,
                ),
                const Divider(color: _KColors.hairline, height: _KSpace.lg),
                _line('Your earnings', _money(_netTotal), bold: true),
                const SizedBox(height: _KSpace.sm),
                _line('Already paid', _money(_paid), tone: _KColors.save),
              ],
            ),
          ),

          if (_entries.isNotEmpty) ...[
            const SizedBox(height: _KSpace.md),
            _panel(
              title: 'Order by order',
              child: Column(
                children: [
                  for (final entry in _entries) _entryRow(entry),
                ],
              ),
            ),
          ],
          const SizedBox(height: _KSpace.xl),
        ],
      ),
    );
  }

  Widget _entryRow(_KEntry entry) {
    return Padding(
      padding: const EdgeInsets.only(bottom: _KSpace.md),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Text('Order #${entry.orderId}',
                  style: const TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w700,
                      color: _KColors.ink)),
              const SizedBox(width: _KSpace.sm),
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                decoration: BoxDecoration(
                  color: entry.toneSoft,
                  borderRadius: BorderRadius.circular(5),
                ),
                child: Text(entry.status,
                    style: TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.w800,
                        color: entry.tone)),
              ),
              const Spacer(),
              Text(_money(entry.net),
                  style: const TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w800,
                      color: _KColors.ink)),
            ],
          ),
          const SizedBox(height: 2),
          // The working, in one quiet line. This is what turns a disputed
          // total into a figure a trader can check for themselves.
          Text(
            '${_money(entry.gross)} sale − ${_money(entry.commission)} commission'
            '${entry.date.isNotEmpty ? ' · ${entry.date}' : ''}',
            style: const TextStyle(fontSize: 11.5, color: _KColors.muted),
          ),
        ],
      ),
    );
  }

  Widget _line(String label, String value,
      {Color tone = _KColors.ink, bool bold = false}) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Row(
        children: [
          Text(label,
              style: TextStyle(
                  fontSize: 13.5,
                  fontWeight: bold ? FontWeight.w700 : FontWeight.w400,
                  color: bold ? _KColors.ink : _KColors.body)),
          const Spacer(),
          Text(value,
              style: TextStyle(
                  fontSize: bold ? 16 : 13.5,
                  fontWeight: bold ? FontWeight.w800 : FontWeight.w600,
                  color: tone)),
        ],
      ),
    );
  }

  Widget _panel({required String title, required Widget child}) {
    return Container(
      padding: const EdgeInsets.all(_KSpace.lg),
      decoration: BoxDecoration(
        color: _KColors.panel,
        borderRadius: BorderRadius.circular(_rPanel),
        border: Border.all(color: _KColors.edge),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title,
              style: const TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w800,
                  color: _KColors.ink)),
          const SizedBox(height: _KSpace.md),
          child,
        ],
      ),
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
              width: 200,
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

/// What the screen shows before the first answer arrives.
///
/// A shimmering block of roughly the right shape rather than a spinner: a
/// spinner says "something is happening", a skeleton says "the rows are
/// arriving", and the second stops the layout jumping when they do. The same
/// widget the home screen uses, sized for cards rather than for product tiles.
///
/// It matters more on a seller's screen than anywhere else in the app. These
/// pages are opened to check a figure — today's takings, what is payable, what
/// is out of stock — and a full-screen spinner gives a trader nothing to read
/// while the shop answers.
class _Skeleton extends StatefulWidget {
  const _Skeleton();

  @override
  State<_Skeleton> createState() => _SkeletonState();
}

class _SkeletonState extends State<_Skeleton>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1100),
  )..repeat(reverse: true);

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Widget _block(double width, double height, [double radius = 6]) {
    return AnimatedBuilder(
      animation: _controller,
      builder: (context, _) => Container(
        width: width,
        height: height,
        decoration: BoxDecoration(
          color:
              Color.lerp(_KColors.hairline, _KColors.line, _controller.value),
          borderRadius: BorderRadius.circular(radius),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return ListView.separated(
      padding: const EdgeInsets.all(_KSpace.md),
      itemCount: 4,
      separatorBuilder: (_, __) => const SizedBox(height: _KSpace.md),
      itemBuilder: (_, __) => Container(
        padding: const EdgeInsets.all(_KSpace.lg),
        decoration: BoxDecoration(
          color: _KColors.panel,
          borderRadius: BorderRadius.circular(_rPanel),
          border: Border.all(color: _KColors.edge),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                _block(130, 16),
                const Spacer(),
                _block(64, 18, 6),
              ],
            ),
            const SizedBox(height: _KSpace.sm),
            _block(96, 12),
            const SizedBox(height: _KSpace.lg),
            Row(
              children: [
                _block(70, 13),
                const Spacer(),
                _block(88, 18),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
