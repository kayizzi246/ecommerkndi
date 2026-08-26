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

import 'package:shared_preferences/shared_preferences.dart';

// ============================================================
//  KANDI — ORDERS, AND ONE ORDER
//
//  Two screens in one file because they are one subject and
//  share every model in it. Splitting them would mean parsing
//  an order twice, and the second parser is the one that drifts.
//
//  WHAT WAS MISSING
//  -----------------------------------------------------------
//  The app had an order LIST and nothing behind it. Tapping an
//  order did nothing, so a shopper could see that order #1183
//  was "processing" and had no way to find out what was in it,
//  where it was going, what it cost, or when it might arrive.
//
//  That is the single most-asked question after somebody buys —
//  "where is my thing" — and the app's answer was a status word
//  on a list row. `KandiOrderScreen` is the answer.
//
//  THE TIMELINE IS NOT INVENTED
//  -----------------------------------------------------------
//  The progress track is drawn from the order's own status and
//  nothing else. It does not estimate a delivery date, because
//  the shop has no courier integration to estimate one from, and
//  a date the app makes up is a promise the shop then breaks.
//  A cancelled or refunded order gets its own state rather than
//  being drawn as a track that stopped.
// ============================================================

/// The status of an order, normalised.
///
/// WooCommerce statuses arrive as slugs — `wc-processing`, `on-hold` — and
/// with the prefix present or absent depending on the endpoint. Normalising
/// once here means the rest of the file matches on a known set rather than on
/// whatever string turned up.
enum KandiOrderStage {
  pending,
  processing,
  shipped,
  completed,
  cancelled,
  refunded,
  failed,
}

extension KandiOrderStageX on KandiOrderStage {
  String get label => switch (this) {
        KandiOrderStage.pending => 'Awaiting payment',
        KandiOrderStage.processing => 'Being packed',
        KandiOrderStage.shipped => 'On its way',
        KandiOrderStage.completed => 'Delivered',
        KandiOrderStage.cancelled => 'Cancelled',
        KandiOrderStage.refunded => 'Refunded',
        KandiOrderStage.failed => 'Payment failed',
      };

  Color get colour => switch (this) {
        KandiOrderStage.completed => KandiColors.success,
        KandiOrderStage.cancelled ||
        KandiOrderStage.failed =>
          KandiColors.sale,
        KandiOrderStage.refunded => KandiColors.muted,
        _ => KandiColors.primaryInk,
      };

  Color get tint => switch (this) {
        KandiOrderStage.completed => KandiColors.successSoft,
        KandiOrderStage.cancelled ||
        KandiOrderStage.failed =>
          KandiColors.saleSoft,
        KandiOrderStage.refunded => KandiColors.hairline,
        _ => KandiColors.primarySoft,
      };

  /// Whether this order is still moving.
  ///
  /// A cancelled or refunded order has no track to draw: showing one that
  /// stopped at step two implies it might start again.
  bool get isLive => switch (this) {
        KandiOrderStage.cancelled ||
        KandiOrderStage.refunded ||
        KandiOrderStage.failed =>
          false,
        _ => true,
      };

  /// How far along the four-step track this is.
  int get step => switch (this) {
        KandiOrderStage.pending => 0,
        KandiOrderStage.processing => 1,
        KandiOrderStage.shipped => 2,
        KandiOrderStage.completed => 3,
        _ => 0,
      };

  static KandiOrderStage parse(String raw) {
    final s = raw.toLowerCase().replaceFirst('wc-', '').trim();
    return switch (s) {
      'processing' => KandiOrderStage.processing,
      'shipped' || 'out-for-delivery' => KandiOrderStage.shipped,
      'completed' => KandiOrderStage.completed,
      'cancelled' || 'canceled' => KandiOrderStage.cancelled,
      'refunded' => KandiOrderStage.refunded,
      'failed' => KandiOrderStage.failed,
      // `pending`, `on-hold` and anything unrecognised. Defaulting to the
      // first step rather than throwing means a status WordPress adds next
      // year renders as an early-stage order instead of crashing the list.
      _ => KandiOrderStage.pending,
    };
  }
}

class KandiOrderItem {
  const KandiOrderItem({
    required this.name,
    required this.quantity,
    required this.total,
    this.image = '',
    this.productId = 0,
  });

  final String name;
  final int quantity;
  final String total;
  final String image;
  final int productId;

  static KandiOrderItem? fromJson(dynamic raw) {
    if (raw is! Map) return null;
    final name = (raw['name'] ?? '').toString().trim();
    if (name.isEmpty) return null;
    return KandiOrderItem(
      name: name,
      quantity: raw['quantity'] is num ? (raw['quantity'] as num).toInt() : 1,
      total: (raw['total'] ?? '').toString(),
      image: (raw['image'] ?? '').toString(),
      productId:
          raw['product_id'] is num ? (raw['product_id'] as num).toInt() : 0,
    );
  }
}

class KandiOrder {
  const KandiOrder({
    required this.id,
    required this.number,
    required this.stage,
    required this.total,
    required this.date,
    this.items = const [],
    this.address,
    this.paymentMethod,
  });

  final int id;
  final String number;
  final KandiOrderStage stage;
  final String total;
  final String date;
  final List<KandiOrderItem> items;
  final String? address;
  final String? paymentMethod;

  int get itemCount =>
      items.fold<int>(0, (sum, item) => sum + item.quantity);

  static KandiOrder? fromJson(dynamic raw) {
    if (raw is! Map) return null;
    final id = raw['id'] is num ? (raw['id'] as num).toInt() : 0;
    if (id == 0) return null;

    return KandiOrder(
      id: id,
      number: (raw['number'] ?? '$id').toString(),
      stage: KandiOrderStageX.parse((raw['status'] ?? '').toString()),
      total: (raw['total'] ?? '').toString(),
      date: (raw['date'] ?? '').toString(),
      items: raw['items'] is List
          ? (raw['items'] as List)
              .map(KandiOrderItem.fromJson)
              .whereType<KandiOrderItem>()
              .toList()
          : const [],
      address: _text(raw['address'] ?? raw['shipping_address']),
      paymentMethod: _text(raw['payment_method'] ?? raw['payment_method_title']),
    );
  }

  static String? _text(dynamic v) {
    final s = v?.toString().trim() ?? '';
    return s.isEmpty ? null : s;
  }
}

/// Reads the signed-in shopper's token.
///
/// Kept here rather than in the design system because it is the SHOPPER
/// session, and the seller centre deliberately keeps a separate one under its
/// own key — the two are different WordPress accounts and one person routinely
/// has both. Merging them would sign a seller out of shopping.
class KandiSession {
  KandiSession._();

  static const String _tokenKey = 'kandi_auth_token';

  static String? _token;
  static bool _loaded = false;

  static Future<String?> token() async {
    if (_loaded) return _token;
    _loaded = true;
    try {
      final prefs = await SharedPreferences.getInstance();
      _token = prefs.getString(_tokenKey);
    } catch (_) {
      _token = null;
    }
    return _token;
  }

  static Future<Map<String, String>> headers() async {
    final t = await token();
    return {
      'Content-Type': 'application/json',
      if (t != null && t.isNotEmpty) 'Authorization': 'Bearer $t',
    };
  }

  /// Forgets the session in memory as well as on disk.
  ///
  /// The in-memory half matters: without it a shopper who signs out and
  /// straight back in as somebody else keeps the first token for the rest of
  /// the process, and sees the wrong person's orders.
  static Future<void> clear() async {
    _token = null;
    _loaded = true;
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.remove(_tokenKey);
    } catch (_) {}
  }
}

// ============================================================
//  THE LIST
// ============================================================

class KandiOrdersScreen extends StatefulWidget {
  const KandiOrdersScreen({
    super.key,
    this.width,
    this.height,
    this.onOpenOrder,
    this.onSignIn,
    this.onStartShopping,
  });

  final double? width;
  final double? height;

  final void Function(KandiOrder order)? onOpenOrder;
  final VoidCallback? onSignIn;
  final VoidCallback? onStartShopping;

  @override
  State<KandiOrdersScreen> createState() => _KandiOrdersScreenState();
}

class _KandiOrdersScreenState extends State<KandiOrdersScreen> {
  static const String _key = 'orders:v1';

  List<KandiOrder>? _orders = KandiCache.peek<List<KandiOrder>>(_key);
  bool _signedOut = false;
  bool _failed = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final orders = await KandiCache.read<List<KandiOrder>>(
        _key,
        // One minute. An order list is the one screen a shopper opens
        // precisely because they expect it to have changed.
        ttl: const Duration(minutes: 1),
        fetch: () async {
          final result = await KandiApi.get(
            '/api/app/account/orders',
            headers: await KandiSession.headers(),
          );
          if (result.status == 401) throw _SignedOut();
          if (result.status != 200) throw StateError('orders');

          final data = result.data;
          final list = data is Map ? data['orders'] : data;
          if (list is! List) return const <KandiOrder>[];
          return list
              .map(KandiOrder.fromJson)
              .whereType<KandiOrder>()
              .toList();
        },
        onRefresh: (fresh) {
          if (mounted) setState(() => _orders = fresh);
        },
      );

      if (!mounted) return;
      setState(() {
        _orders = orders;
        _signedOut = false;
        _failed = false;
      });
    } on _SignedOut {
      if (!mounted) return;
      setState(() {
        _signedOut = true;
        _orders = null;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() => _failed = _orders == null);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      width: widget.width,
      height: widget.height,
      color: KandiColors.page,
      child: Scaffold(
        backgroundColor: KandiColors.page,
        appBar: kandiAppBar(context, 'Your orders'),
        body: RefreshIndicator(
          color: KandiColors.primary,
          onRefresh: () async {
            KandiCache.invalidate(_key);
            await _load();
          },
          child: _body(),
        ),
      ),
    );
  }

  Widget _body() {
    if (_signedOut) {
      return KandiEmpty(
        icon: Icons.lock_outline_rounded,
        title: 'Sign in to see your orders',
        message: 'Your order history lives with your account.',
        actionLabel: 'Sign in',
        onAction: widget.onSignIn,
      );
    }

    final orders = _orders;
    if (orders == null && _failed) {
      return KandiEmpty(
        icon: Icons.wifi_off_rounded,
        title: 'Could not load your orders',
        message: 'Check your connection and try again.',
        actionLabel: 'Try again',
        onAction: () {
          KandiCache.invalidate(_key);
          setState(() => _failed = false);
          _load();
        },
      );
    }
    if (orders == null) return _skeleton();

    if (orders.isEmpty) {
      return KandiEmpty(
        icon: Icons.receipt_long_outlined,
        title: 'No orders yet',
        message: 'Everything you buy will show up here.',
        actionLabel: 'Start shopping',
        onAction: widget.onStartShopping,
      );
    }

    return ListView.separated(
      padding: const EdgeInsets.all(KandiSpace.gutter),
      itemCount: orders.length,
      separatorBuilder: (_, __) => const SizedBox(height: KandiSpace.sm),
      itemBuilder: (context, index) => _card(orders[index]),
    );
  }

  Widget _card(KandiOrder order) {
    return KandiCard(
      padding: const EdgeInsets.all(KandiSpace.md),
      onTap: () => widget.onOpenOrder?.call(order),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Text('#${order.number}', style: KandiType.title()),
              const SizedBox(width: KandiSpace.sm),
              KandiChip(
                label: order.stage.label,
                background: order.stage.tint,
                foreground: order.stage.colour,
              ),
              const Spacer(),
              const Icon(Icons.chevron_right_rounded,
                  size: 20, color: KandiColors.faint),
            ],
          ),
          const SizedBox(height: KandiSpace.sm),

          // The photographs, not just a count. "3 items" tells a shopper
          // nothing they can recognise; three thumbnails tell them which order
          // this is at a glance, which is the whole job of a list row.
          if (order.items.isNotEmpty)
            SizedBox(
              height: 46,
              child: Row(
                children: [
                  for (final item in order.items.take(4)) ...[
                    KandiImage(
                      url: item.image,
                      width: 46,
                      height: 46,
                      radius: KandiRadius.sm,
                    ),
                    const SizedBox(width: KandiSpace.xs),
                  ],
                  if (order.items.length > 4)
                    Container(
                      width: 46,
                      height: 46,
                      decoration: BoxDecoration(
                        color: KandiColors.hairline,
                        borderRadius: KandiRadius.sm,
                      ),
                      alignment: Alignment.center,
                      child: Text(
                        '+${order.items.length - 4}',
                        style: KandiType.micro(color: KandiColors.body),
                      ),
                    ),
                ],
              ),
            ),

          const SizedBox(height: KandiSpace.md),
          Row(
            children: [
              Text(
                order.date.isEmpty ? '' : _shortDate(order.date),
                style: KandiType.caption(),
              ),
              const Spacer(),
              Text(order.total, style: KandiType.price(size: 15)),
            ],
          ),
        ],
      ),
    );
  }

  Widget _skeleton() {
    return ListView.separated(
      padding: const EdgeInsets.all(KandiSpace.gutter),
      itemCount: 3,
      separatorBuilder: (_, __) => const SizedBox(height: KandiSpace.sm),
      itemBuilder: (context, _) => const KandiCard(
        padding: EdgeInsets.all(KandiSpace.md),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            KandiSkeleton(width: 140, height: 15),
            SizedBox(height: KandiSpace.md),
            KandiSkeleton(width: 200, height: 46),
            SizedBox(height: KandiSpace.md),
            KandiSkeleton(width: 100, height: 14),
          ],
        ),
      ),
    );
  }
}

class _SignedOut implements Exception {}

/// "12 Mar 2025" out of whatever date string WordPress sent.
///
/// Falls back to the raw string rather than throwing: a date the app cannot
/// parse should still be shown, because an unfamiliar format is readable and a
/// crash is not.
String _shortDate(String raw) {
  final parsed = DateTime.tryParse(raw);
  if (parsed == null) return raw.split('T').first;
  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];
  return '${parsed.day} ${months[parsed.month - 1]} ${parsed.year}';
}

// ============================================================
//  ONE ORDER
// ============================================================

/// The screen the app never had.
///
/// See the note at the head of this file: the list existed and led nowhere, so
/// "where is my order" had no answer beyond a status word.
class KandiOrderScreen extends StatelessWidget {
  const KandiOrderScreen({
    super.key,
    this.width,
    this.height,
    required this.order,
    this.onOpenProduct,
    this.onContactSupport,
    this.onBuyAgain,
  });

  final double? width;
  final double? height;
  final KandiOrder order;

  final void Function(int productId)? onOpenProduct;
  final VoidCallback? onContactSupport;
  final void Function(KandiOrder order)? onBuyAgain;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: width,
      height: height,
      color: KandiColors.page,
      child: Scaffold(
        backgroundColor: KandiColors.page,
        appBar: kandiAppBar(context, 'Order #${order.number}'),
        body: ListView(
          padding: const EdgeInsets.all(KandiSpace.gutter),
          children: [
            _status(),
            const SizedBox(height: KandiSpace.md),
            _items(),
            const SizedBox(height: KandiSpace.md),
            _details(),
            if (onContactSupport != null) ...[
              const SizedBox(height: KandiSpace.md),
              _help(),
            ],
            const SizedBox(height: KandiSpace.xxl),
          ],
        ),
        bottomNavigationBar: onBuyAgain == null
            ? null
            : Container(
                padding: EdgeInsets.fromLTRB(
                  KandiSpace.gutter,
                  KandiSpace.md,
                  KandiSpace.gutter,
                  KandiSpace.md + MediaQuery.of(context).padding.bottom,
                ),
                decoration: const BoxDecoration(
                  color: KandiColors.surface,
                  boxShadow: KandiShadow.raised,
                ),
                child: KandiButton(
                  label: 'Buy these again',
                  icon: Icons.replay_rounded,
                  tone: KandiButtonTone.outline,
                  onPressed: () => onBuyAgain!(order),
                ),
              ),
      ),
    );
  }

  Widget _status() {
    return KandiCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              KandiChip(
                label: order.stage.label,
                background: order.stage.tint,
                foreground: order.stage.colour,
              ),
              const Spacer(),
              Text(_shortDate(order.date), style: KandiType.caption()),
            ],
          ),
          if (order.stage.isLive) ...[
            const SizedBox(height: KandiSpace.xl),
            _track(),
          ] else ...[
            const SizedBox(height: KandiSpace.md),
            Text(
              switch (order.stage) {
                KandiOrderStage.cancelled =>
                  'This order was cancelled. Nothing has been charged.',
                KandiOrderStage.refunded =>
                  'This order was refunded. The money is on its way back.',
                _ => 'The payment for this order did not go through.',
              },
              style: KandiType.bodyText(),
            ),
          ],
        ],
      ),
    );
  }

  /// Four steps, drawn from the status and nothing else.
  ///
  /// No estimated date. The shop has no courier integration to estimate one
  /// from, and a date the app invents is a promise the shop then breaks — the
  /// one thing worse than not knowing when a parcel arrives is being told a
  /// day that passes.
  Widget _track() {
    const steps = [
      (Icons.receipt_long_rounded, 'Placed'),
      (Icons.inventory_2_outlined, 'Packed'),
      (Icons.local_shipping_outlined, 'On its way'),
      (Icons.check_circle_outline_rounded, 'Delivered'),
    ];

    final reached = order.stage.step;

    return Row(
      children: [
        for (var i = 0; i < steps.length; i++) ...[
          Column(
            children: [
              Container(
                width: 34,
                height: 34,
                decoration: BoxDecoration(
                  color: i <= reached
                      ? KandiColors.primary
                      : KandiColors.hairline,
                  shape: BoxShape.circle,
                ),
                child: Icon(
                  steps[i].$1,
                  size: 16,
                  color: i <= reached ? Colors.white : KandiColors.faint,
                ),
              ),
              const SizedBox(height: KandiSpace.xs),
              SizedBox(
                width: 62,
                child: Text(
                  steps[i].$2,
                  textAlign: TextAlign.center,
                  style: KandiType.micro(
                    color: i <= reached ? KandiColors.ink : KandiColors.faint,
                    weight: i <= reached ? FontWeight.w600 : FontWeight.w400,
                  ),
                ),
              ),
            ],
          ),
          if (i < steps.length - 1)
            Expanded(
              child: Container(
                height: 2,
                margin: const EdgeInsets.only(bottom: 22),
                color:
                    i < reached ? KandiColors.primary : KandiColors.hairline,
              ),
            ),
        ],
      ],
    );
  }

  Widget _items() {
    return KandiCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            '${order.itemCount} ${order.itemCount == 1 ? "item" : "items"}',
            style: KandiType.heading(),
          ),
          const SizedBox(height: KandiSpace.md),
          for (final item in order.items) ...[
            InkWell(
              onTap: item.productId == 0
                  ? null
                  : () => onOpenProduct?.call(item.productId),
              borderRadius: KandiRadius.sm,
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  KandiImage(url: item.image, width: 52, height: 52),
                  const SizedBox(width: KandiSpace.md),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          item.name,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: KandiType.label(),
                        ),
                        Text('× ${item.quantity}',
                            style: KandiType.caption()),
                      ],
                    ),
                  ),
                  const SizedBox(width: KandiSpace.sm),
                  Text(item.total, style: KandiType.price(size: 13)),
                ],
              ),
            ),
            if (item != order.items.last)
              const Padding(
                padding: EdgeInsets.symmetric(vertical: KandiSpace.md),
                child: Divider(height: 1, color: KandiColors.hairline),
              ),
          ],
          const SizedBox(height: KandiSpace.md),
          const Divider(height: 1, color: KandiColors.hairline),
          const SizedBox(height: KandiSpace.md),
          Row(
            children: [
              Text('Total', style: KandiType.title()),
              const Spacer(),
              Text(order.total, style: KandiType.price(size: 19)),
            ],
          ),
        ],
      ),
    );
  }

  Widget _details() {
    final rows = <(IconData, String, String)>[
      if (order.address != null)
        (Icons.location_on_outlined, 'Delivering to', order.address!),
      if (order.paymentMethod != null)
        (Icons.payments_outlined, 'Paid with', order.paymentMethod!),
      (Icons.tag_rounded, 'Order number', '#${order.number}'),
    ];

    return KandiCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Details', style: KandiType.heading()),
          const SizedBox(height: KandiSpace.md),
          for (final row in rows) ...[
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(row.$1, size: 17, color: KandiColors.muted),
                const SizedBox(width: KandiSpace.md),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(row.$2, style: KandiType.caption()),
                      Text(row.$3, style: KandiType.label()),
                    ],
                  ),
                ),
              ],
            ),
            if (row != rows.last) const SizedBox(height: KandiSpace.md),
          ],
        ],
      ),
    );
  }

  Widget _help() {
    return KandiCard(
      padding: const EdgeInsets.symmetric(
        horizontal: KandiSpace.lg,
        vertical: KandiSpace.md,
      ),
      onTap: onContactSupport,
      child: Row(
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: const BoxDecoration(
              color: KandiColors.primarySoft,
              shape: BoxShape.circle,
            ),
            child: const Icon(Icons.support_agent_rounded,
                size: 18, color: KandiColors.primary),
          ),
          const SizedBox(width: KandiSpace.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Something wrong with this order?',
                    style: KandiType.label()),
                Text('Talk to someone about it', style: KandiType.caption()),
              ],
            ),
          ),
          const Icon(Icons.chevron_right_rounded, color: KandiColors.faint),
        ],
      ),
    );
  }
}
