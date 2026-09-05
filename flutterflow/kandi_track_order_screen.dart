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

// ============================================================
//  KANDI — TRACK AN ORDER
//
//  Self-contained like every page here: its own palette, HTTP
//  and model, all file-private. The architecture is written out
//  in full at the head of kandi_home_screen.dart.
//
//  ---- Why this is not part of My orders ----
//
//  My orders needs an account. Most orders on this shop are
//  placed without one — the checkout takes a name, a phone and
//  an address and asks for nothing else — so for the majority of
//  shoppers "where is my parcel" had no answer anywhere in the
//  app. It had one on the website all along, and this is that
//  page: an order number, the phone or email it was placed with,
//  and the four steps back.
//
//  ---- The four steps are not WooCommerce's statuses ----
//
//  They are the four questions a shopper is actually asking: did
//  you get my order, have you taken the money, has it left, is
//  it here. "Processing" is warehouse vocabulary and tells
//  nobody where their parcel is. The mapping below is copied
//  from the website's own tracking panel deliberately — one
//  shopper checking the same order in both places must not be
//  told two different things.
//
//  ---- Nothing here is trusted to the phone ----
//
//  Whether these details are enough to see this order is decided
//  in WordPress, behind a shared secret the app never holds. The
//  screen sends what was typed and renders what comes back.
// ============================================================

class _KColors {
  const _KColors._();
  static const Color canvas = Color(0xFFFFFFFF);
  static const Color panel = Color(0xFFFFFFFF);
  static const Color ink = Color(0xFF0B0B0B);
  static const Color body = Color(0xFF414346);
  static const Color muted = Color(0xFF5D6066);
  static const Color faint = Color(0xFF8E9196);
  static const Color line = Color(0xFFE0E0E0);
  static const Color hairline = Color(0xFFF2F2F2);
  static const Color primary = Color(0xFFFF6A00);
  static const Color save = Color(0xFF15803D);
  static const Color saveSoft = Color(0xFFECFDF3);

  /// Amber, for an order that stopped — cancelled, refunded, failed.
  ///
  /// Not red. Red on this shop is the money colour, and a cancelled order
  /// printed in the same ink as every price reads as an error in the app rather
  /// than as a fact about the order.
  static const Color warn = Color(0xFFB45309);
  static const Color warnSoft = Color(0xFFFFF7ED);


  /// ---- The edge that makes a white card visible on a white page ----
  ///
  /// The app used to stand its tiles on #F5F5F5 and let the contrast do the
  /// separating. The site does not: its canvas is #ffffff, the same as the
  /// panel, so the tile is drawn by a 1px ring and nothing else. Matching the
  /// ground without matching the ring would have produced a grid of tiles with
  /// no edges at all.
  static const Color edge = Color(0xFFDEDEDE);

  /// The ground behind a product photograph.
  ///
  /// Warm rather than neutral, and that is the point: most of this catalogue is
  /// shot on white, so the box behind it has to be a shade the white sits ON.
  /// A grey would read as a grey rectangle behind the product; #FBF7F4 reads as
  /// paper. It is \`--color-shop-photo\` on the site.
  static const Color photo = Color(0xFFFBF7F4);

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

/// The brand gradient: Kandi orange running into the deep red.
const LinearGradient _brandGradient = LinearGradient(
  begin: Alignment.centerLeft,
  end: Alignment.centerRight,
  colors: [Color(0xFFFF6A00), Color(0xFFD62200)],
);

/// Fully rounded. The primary calls to action are pills, which is what tells
/// them apart from the square panels they sit on.
const double _rPill = 999;
const String _apiBase = 'https://kandiug.com';

String _money(num amount) {
  final whole = amount.round().toString();
  final out = StringBuffer();
  for (int i = 0; i < whole.length; i++) {
    if (i > 0 && (whole.length - i) % 3 == 0) out.write(',');
    out.write(whole[i]);
  }
  return 'UGX $out';
}

/// "14 Mar, 18:20", or empty for a date the shop did not send.
///
/// Written out by hand rather than through `intl`: the package is not a
/// dependency of this project and one line of date formatting is not worth
/// making it one. Local time, because a shopper reading "dispatched at 09:00"
/// means their own morning.
String _shortDate(String? iso) {
  if (iso == null || iso.isEmpty) return '';
  final parsed = DateTime.tryParse(iso);
  if (parsed == null) return '';
  final local = parsed.toLocal();
  const months = <String>[
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];
  final hour = local.hour.toString().padLeft(2, '0');
  final minute = local.minute.toString().padLeft(2, '0');
  return '${local.day} ${months[local.month - 1]}, $hour:$minute';
}

class _KLine {
  const _KLine({
    required this.name,
    required this.quantity,
    required this.total,
    required this.image,
  });

  final String name;
  final int quantity;
  final num total;
  final String image;

  static _KLine? from(dynamic json) {
    if (json is! Map) return null;
    return _KLine(
      name: (json['name'] ?? '').toString(),
      quantity: json['quantity'] is int ? json['quantity'] as int : 1,
      total: json['total'] is num ? json['total'] as num : 0,
      image: (json['image'] ?? '').toString(),
    );
  }
}

class _KOrder {
  const _KOrder({
    required this.number,
    required this.status,
    required this.total,
    required this.payment,
    required this.city,
    required this.created,
    required this.paid,
    required this.dispatched,
    required this.completed,
    required this.items,
  });

  final String number;
  final String status;
  final num total;
  final String payment;
  final String city;
  final String? created;
  final String? paid;
  final String? dispatched;
  final String? completed;
  final List<_KLine> items;

  static _KOrder? from(dynamic json) {
    if (json is! Map) return null;
    final number = (json['number'] ?? '').toString();
    if (number.isEmpty) return null;
    return _KOrder(
      number: number,
      status: (json['status'] ?? '').toString().toLowerCase(),
      total: json['total'] is num ? json['total'] as num : 0,
      payment: (json['payment'] ?? '').toString(),
      city: (json['city'] ?? '').toString(),
      created: json['created']?.toString(),
      paid: json['paid']?.toString(),
      dispatched: json['dispatched']?.toString(),
      completed: json['completed']?.toString(),
      items: json['items'] is List
          ? (json['items'] as List)
              .map(_KLine.from)
              .whereType<_KLine>()
              .toList()
          : const <_KLine>[],
    );
  }

  /// Which of the four steps this order has reached. -1 for a stopped order.
  ///
  /// Copied step for step from the website's tracking panel. The awkward
  /// clause is the second one and it is deliberate: a completed order with no
  /// dispatch time recorded is finished, not stuck at "confirmed" — some
  /// sellers mark an order complete on handover without ever flipping the
  /// dispatch flag.
  int get step {
    if (status == 'cancelled' || status == 'refunded' || status == 'failed') {
      return -1;
    }
    if (status == 'completed' && (dispatched == null || dispatched!.isEmpty)) {
      return 3;
    }
    if (dispatched != null && dispatched!.isNotEmpty) {
      return status == 'completed' ? 2 : 3;
    }
    if (status == 'processing' || status == 'on-hold') return 1;
    return 0;
  }

  String get stoppedLabel {
    switch (status) {
      case 'cancelled':
        return 'Cancelled';
      case 'refunded':
        return 'Refunded';
      case 'failed':
        return 'Payment failed';
      default:
        return 'Stopped';
    }
  }

  String get stoppedNote {
    switch (status) {
      case 'cancelled':
        return 'This order was stopped. Nothing is owed.';
      case 'refunded':
        return 'The money has been sent back to you.';
      case 'failed':
        return 'The payment did not go through, so nothing was packed.';
      default:
        return 'This order is not moving. Contact us and we will look at it.';
    }
  }
}

/// The four states an order passes through, as a shopper would describe them.
class _Step {
  const _Step(this.label, this.note);

  final String label;
  final String note;
}

const List<_Step> _steps = <_Step>[
  _Step('Order placed', 'We have your order.'),
  _Step('Confirmed', 'The seller is packing it.'),
  _Step('On the way', 'Out with the rider.'),
  _Step('Delivered', 'Handed over.'),
];

class KandiTrackOrderScreen extends StatefulWidget {
  const KandiTrackOrderScreen({super.key, this.width, this.height});

  final double? width;
  final double? height;

  @override
  State<KandiTrackOrderScreen> createState() => _KandiTrackOrderScreenState();
}

class _KandiTrackOrderScreenState extends State<KandiTrackOrderScreen> {
  final TextEditingController _number = TextEditingController();
  final TextEditingController _contact = TextEditingController();

  bool _looking = false;
  String? _error;
  _KOrder? _order;

  @override
  void dispose() {
    _number.dispose();
    _contact.dispose();
    super.dispose();
  }

  Future<void> _track() async {
    final number = _number.text.trim();
    final contact = _contact.text.trim();

    if (number.isEmpty || contact.isEmpty) {
      setState(() => _error =
          'Enter your order number and the phone or email you ordered with.');
      return;
    }

    FocusScope.of(context).unfocus();
    setState(() {
      _looking = true;
      _error = null;
    });

    dynamic data;
    int status = 0;
    try {
      final response = await http
          .get(Uri.parse('$_apiBase/api/track'
              '?number=${Uri.encodeQueryComponent(number)}'
              '&contact=${Uri.encodeQueryComponent(contact)}'))
          .timeout(const Duration(seconds: 20));
      status = response.statusCode;
      data = jsonDecode(response.body);
    } catch (_) {
      status = 0;
    }

    if (!mounted) return;

    setState(() {
      _looking = false;
      if (status == 200) {
        final order = _KOrder.from(data);
        if (order == null) {
          _order = null;
          _error = 'We could not read that order. Try again in a moment.';
        } else {
          _order = order;
          _error = null;
        }
      } else {
        _order = null;
        // The shop's own words where it sent any. It knows the difference
        // between "no such order" and "those details do not match", and
        // flattening the two here would send somebody hunting for a typo in
        // details that were correct.
        final message = data is Map ? data['message'] : null;
        _error = message is String && message.isNotEmpty
            ? message
            : (status == 0
                ? 'Could not reach the shop. Check your connection.'
                : 'We could not find an order with those details.');
      }
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
          title: const Text('Track an order',
              style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w700,
                  color: Colors.white)),
        ),
        body: ListView(
          padding: const EdgeInsets.all(_KSpace.md),
          children: [
            _buildForm(),
            if (_error != null) ...[
              const SizedBox(height: _KSpace.md),
              _buildError(_error!),
            ],
            if (_order != null) ...[
              const SizedBox(height: _KSpace.md),
              _buildOrder(_order!),
            ],
            const SizedBox(height: _KSpace.xl),
          ],
        ),
      ),
    );
  }

  Widget _buildForm() {
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
          const Text('Where is my order?',
              style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.w800,
                  color: _KColors.ink)),
          const SizedBox(height: 4),
          const Text(
            'No account needed. Use the order number from your confirmation and the phone number or email you ordered with.',
            style: TextStyle(fontSize: 13, height: 1.45, color: _KColors.body),
          ),
          const SizedBox(height: _KSpace.lg),
          _Field(
            controller: _number,
            label: 'Order number',
            hint: '1563',
            icon: Icons.receipt_long_rounded,
            keyboardType: TextInputType.number,
          ),
          const SizedBox(height: _KSpace.md),
          _Field(
            controller: _contact,
            label: 'Phone or email',
            hint: '0772 123 456',
            icon: Icons.person_outline_rounded,
            keyboardType: TextInputType.text,
            onSubmitted: (_) => _track(),
          ),
          const SizedBox(height: _KSpace.lg),
          SizedBox(
            width: double.infinity,
            height: 50,
            child: DecoratedBox(
              decoration: BoxDecoration(
                gradient: _looking ? null : _brandGradient,
                color: _looking ? _KColors.line : null,
                borderRadius: BorderRadius.circular(_rPill),
              ),
              child: TextButton(
                onPressed: _looking ? null : _track,
                style: TextButton.styleFrom(
                  foregroundColor: Colors.white,
                  disabledForegroundColor: _KColors.muted,
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(_rPill)),
                ),
                child: _looking
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(
                            strokeWidth: 2.4, color: Colors.white),
                      )
                    : const Text('Track it',
                        style: TextStyle(
                            fontSize: 15.5, fontWeight: FontWeight.w800)),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildError(String message) {
    return Container(
      padding: const EdgeInsets.all(_KSpace.lg),
      decoration: BoxDecoration(
        color: _KColors.warnSoft,
        borderRadius: BorderRadius.circular(_rPanel),
        border: Border.all(color: _KColors.warn.withValues(alpha: 0.25)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(Icons.info_outline_rounded,
              size: 20, color: _KColors.warn),
          const SizedBox(width: _KSpace.sm),
          Expanded(
            child: Text(message,
                style: const TextStyle(
                    fontSize: 13.5, height: 1.45, color: _KColors.warn)),
          ),
        ],
      ),
    );
  }

  Widget _buildOrder(_KOrder order) {
    final stopped = order.step < 0;

    return Container(
      decoration: BoxDecoration(
        color: _KColors.panel,
        borderRadius: BorderRadius.circular(_rPanel),
        border: Border.all(color: _KColors.edge),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.all(_KSpace.lg),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Order #${order.number}',
                          style: const TextStyle(
                              fontSize: 17,
                              fontWeight: FontWeight.w800,
                              color: _KColors.ink)),
                      const SizedBox(height: 2),
                      Text(
                        [
                          if (_shortDate(order.created).isNotEmpty)
                            'Placed ${_shortDate(order.created)}',
                          if (order.city.isNotEmpty) 'to ${order.city}',
                        ].join(' · '),
                        style: const TextStyle(
                            fontSize: 12, color: _KColors.muted),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: _KSpace.sm),
                Text(_money(order.total),
                    style: const TextStyle(
                        fontSize: 17,
                        fontWeight: FontWeight.w800,
                        color: _KColors.ink)),
              ],
            ),
          ),
          const Divider(height: 1, color: _KColors.hairline),
          Padding(
            padding: const EdgeInsets.all(_KSpace.lg),
            child: stopped ? _buildStopped(order) : _buildTimeline(order),
          ),
          if (order.items.isNotEmpty) ...[
            const Divider(height: 1, color: _KColors.hairline),
            for (final line in order.items) _buildLine(line),
          ],
          if (order.payment.isNotEmpty) ...[
            const Divider(height: 1, color: _KColors.hairline),
            Padding(
              padding: const EdgeInsets.all(_KSpace.lg),
              child: Row(
                children: [
                  const Icon(Icons.payments_outlined,
                      size: 18, color: _KColors.muted),
                  const SizedBox(width: _KSpace.sm),
                  Expanded(
                    child: Text('Paid by ${order.payment}',
                        style: const TextStyle(
                            fontSize: 13, color: _KColors.body)),
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildStopped(_KOrder order) {
    return Container(
      padding: const EdgeInsets.all(_KSpace.md),
      decoration: BoxDecoration(
        color: _KColors.warnSoft,
        borderRadius: BorderRadius.circular(_rPhoto),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(Icons.cancel_outlined, size: 20, color: _KColors.warn),
          const SizedBox(width: _KSpace.sm),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(order.stoppedLabel,
                    style: const TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w800,
                        color: _KColors.warn)),
                const SizedBox(height: 2),
                Text(order.stoppedNote,
                    style: const TextStyle(
                        fontSize: 13, height: 1.4, color: _KColors.body)),
              ],
            ),
          ),
        ],
      ),
    );
  }

  /// The four steps, drawn as a column with the rail down the left.
  ///
  /// The rail is a piece of each row rather than one line behind them, so it
  /// stretches with whatever a row's text does — a two-line note on a phone in
  /// large type would otherwise leave the line short of the next dot.
  Widget _buildTimeline(_KOrder order) {
    final reached = order.step;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        for (int index = 0; index < _steps.length; index++)
          IntrinsicHeight(
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Column(
                  children: [
                    Container(
                      width: 18,
                      height: 18,
                      decoration: BoxDecoration(
                        color: index <= reached
                            ? _KColors.save
                            : _KColors.panel,
                        shape: BoxShape.circle,
                        border: Border.all(
                          color: index <= reached
                              ? _KColors.save
                              : _KColors.line,
                          width: 2,
                        ),
                      ),
                      child: index <= reached
                          ? const Icon(Icons.check_rounded,
                              size: 11, color: Colors.white)
                          : null,
                    ),
                    if (index < _steps.length - 1)
                      Expanded(
                        child: Container(
                          width: 2,
                          margin: const EdgeInsets.symmetric(vertical: 2),
                          color: index < reached
                              ? _KColors.save
                              : _KColors.line,
                        ),
                      ),
                  ],
                ),
                const SizedBox(width: _KSpace.md),
                Expanded(
                  child: Padding(
                    padding: EdgeInsets.only(
                        bottom: index < _steps.length - 1 ? _KSpace.lg : 0),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(_steps[index].label,
                            style: TextStyle(
                              fontSize: 14,
                              fontWeight: index == reached
                                  ? FontWeight.w800
                                  : FontWeight.w600,
                              color: index <= reached
                                  ? _KColors.ink
                                  : _KColors.faint,
                            )),
                        const SizedBox(height: 1),
                        Text(
                          _stampFor(order, index).isNotEmpty
                              ? _stampFor(order, index)
                              : _steps[index].note,
                          style: TextStyle(
                            fontSize: 12.5,
                            color: index <= reached
                                ? _KColors.body
                                : _KColors.faint,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        const SizedBox(height: _KSpace.md),
        Container(
          padding: const EdgeInsets.symmetric(
              horizontal: _KSpace.md, vertical: _KSpace.sm),
          decoration: BoxDecoration(
            color: _KColors.saveSoft,
            borderRadius: BorderRadius.circular(_rPhoto),
          ),
          child: Row(
            children: [
              const Icon(Icons.local_shipping_outlined,
                  size: 18, color: _KColors.save),
              const SizedBox(width: _KSpace.sm),
              Expanded(
                child: Text(
                  reached >= 3
                      ? 'Delivered. Thank you for shopping with us.'
                      : 'The rider calls the number on the order before delivery.',
                  style: const TextStyle(
                      fontSize: 12.5, height: 1.4, color: _KColors.save),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  /// The timestamp on a step, where the shop recorded one.
  ///
  /// A step that has been reached but has no time against it keeps its note
  /// instead. An empty line under a ticked step reads as missing data; the note
  /// at least says what the step means.
  String _stampFor(_KOrder order, int index) {
    switch (index) {
      case 0:
        return _shortDate(order.created);
      case 1:
        return _shortDate(order.paid);
      case 2:
        return _shortDate(order.dispatched);
      default:
        return _shortDate(order.completed);
    }
  }

  Widget _buildLine(_KLine line) {
    return Padding(
      padding: const EdgeInsets.symmetric(
          horizontal: _KSpace.lg, vertical: _KSpace.md),
      child: Row(
        children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(_rPhoto),
            child: Container(
              width: 46,
              height: 46,
              color: _KColors.photo,
              child: line.image.isEmpty
                  ? const Icon(Icons.image_not_supported_outlined,
                      size: 18, color: _KColors.faint)
                  : CachedNetworkImage(
                      imageUrl: line.image,
                      httpHeaders: _kImageHeaders,
                      fit: BoxFit.contain,
                      placeholder: (_, __) =>
                          const ColoredBox(color: _KColors.photo),
                      errorWidget: (_, __, ___) =>
                          const ColoredBox(color: _KColors.photo),
                    ),
            ),
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
                        fontSize: 13.5, height: 1.3, color: _KColors.ink)),
                if (line.quantity > 1)
                  Text('× ${line.quantity}',
                      style: const TextStyle(
                          fontSize: 12, color: _KColors.muted)),
              ],
            ),
          ),
          const SizedBox(width: _KSpace.sm),
          Text(_money(line.total),
              style: const TextStyle(
                  fontSize: 13.5,
                  fontWeight: FontWeight.w700,
                  color: _KColors.ink)),
        ],
      ),
    );
  }
}

/// A labelled text field. The same control the account and checkout pages
/// draw, repeated here rather than imported — nothing crosses a file boundary
/// in this app.
class _Field extends StatelessWidget {
  const _Field({
    required this.controller,
    required this.label,
    required this.hint,
    required this.icon,
    this.keyboardType,
    this.onSubmitted,
  });

  final TextEditingController controller;
  final String label;
  final String hint;
  final IconData icon;
  final TextInputType? keyboardType;
  final ValueChanged<String>? onSubmitted;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label,
            style: const TextStyle(
                fontSize: 12.5,
                fontWeight: FontWeight.w700,
                color: _KColors.body)),
        const SizedBox(height: 5),
        TextField(
          controller: controller,
          keyboardType: keyboardType,
          onSubmitted: onSubmitted,
          textInputAction: TextInputAction.done,
          style: const TextStyle(fontSize: 15, color: _KColors.ink),
          decoration: InputDecoration(
            isDense: true,
            hintText: hint,
            hintStyle: const TextStyle(fontSize: 14.5, color: _KColors.faint),
            prefixIcon: Icon(icon, size: 19, color: _KColors.muted),
            contentPadding: const EdgeInsets.symmetric(
                horizontal: _KSpace.md, vertical: 14),
            filled: true,
            fillColor: _KColors.canvas,
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(_rPhoto),
              borderSide: const BorderSide(color: _KColors.line),
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(_rPhoto),
              borderSide: const BorderSide(color: _KColors.line),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(_rPhoto),
              borderSide: const BorderSide(color: _KColors.primary, width: 1.5),
            ),
          ),
        ),
      ],
    );
  }
}
