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

import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

// ============================================================
//  KANDI — DELIVERY ADDRESSES
//
//  Where orders go, saved on the handset.
//
//  WHY LOCAL AND NOT ON THE SERVER
//  -----------------------------------------------------------
//  WooCommerce keeps ONE shipping address per customer. A "saved
//  addresses" screen backed by it could therefore hold exactly
//  one, which is not a feature — it is a form with a title.
//
//  Held locally the app can keep several, which is the actual
//  need: home, work, and the place a parcel gets left when
//  nobody is in. The checkout fills itself from whichever is
//  picked, and the one that goes on the order is still the one
//  the server records.
//
//  It also works signed out, which matters here. Most shoppers
//  in this app have not made an account, and asking somebody to
//  register before they can save the address they are about to
//  type is the kind of step that ends a purchase.
//
//  GEOLOCATION IS ABSENT, AND IT IS NOT A DESIGN CHOICE
//  -----------------------------------------------------------
//  `geolocator` is not in the FlutterFlow pubspec, and a pasted
//  custom widget cannot add a dependency — the missing package
//  fails the whole web build, in every widget at once. The old
//  delivery_address_widget.dart carries the same note.
//
//  To restore "use my current location": add
//  `geolocator: ^11.0.0` under FlutterFlow > Settings > App
//  Settings > Pubspec Dependencies, then the location permission
//  strings for both platforms. Do not add the import without the
//  pubspec entry.
// ============================================================

/// One saved address.
class KandiAddress {
  const KandiAddress({
    required this.id,
    required this.label,
    required this.name,
    required this.phone,
    required this.street,
    required this.city,
    this.notes = '',
  });

  /// Stable across edits, so "which one is selected" survives a rename.
  final String id;

  /// What the shopper calls it — "Home", "Mum's place".
  final String label;

  final String name;
  final String phone;
  final String street;
  final String city;
  final String notes;

  String get summary => [street, city].where((s) => s.isNotEmpty).join(', ');

  Map<String, dynamic> toJson() => {
        'id': id,
        'label': label,
        'name': name,
        'phone': phone,
        'street': street,
        'city': city,
        'notes': notes,
      };

  static KandiAddress? fromJson(dynamic raw) {
    if (raw is! Map) return null;
    final street = (raw['street'] ?? '').toString().trim();
    final city = (raw['city'] ?? '').toString().trim();
    // An address with no street and no town cannot be delivered to, so it is
    // dropped rather than shown as a row that will fail at checkout.
    if (street.isEmpty && city.isEmpty) return null;

    return KandiAddress(
      id: (raw['id'] ?? DateTime.now().microsecondsSinceEpoch).toString(),
      label: (raw['label'] ?? 'Address').toString(),
      name: (raw['name'] ?? '').toString(),
      phone: (raw['phone'] ?? '').toString(),
      street: street,
      city: city,
      notes: (raw['notes'] ?? '').toString(),
    );
  }
}

/// The address book.
class KandiAddresses {
  KandiAddresses._();

  static const String storageKey = 'kandi-addresses-v1';
  static const String _selectedKey = 'kandi-address-selected-v1';

  static final ValueNotifier<int> revision = ValueNotifier<int>(0);

  static List<KandiAddress> _items = <KandiAddress>[];
  static String? _selectedId;
  static bool _loaded = false;

  static List<KandiAddress> get items => List.unmodifiable(_items);

  /// The address the checkout should fill itself from.
  ///
  /// Falls back to the first saved one rather than to null: a shopper with an
  /// address book and nothing marked default still expects the checkout to be
  /// filled in, and "none selected" is an internal state, not an intention.
  static KandiAddress? get selected {
    if (_items.isEmpty) return null;
    for (final address in _items) {
      if (address.id == _selectedId) return address;
    }
    return _items.first;
  }

  static Future<void> load({bool force = false}) async {
    if (_loaded && !force) return;

    try {
      final prefs = await SharedPreferences.getInstance();
      final raw = prefs.getString(storageKey);
      if (raw != null && raw.isNotEmpty) {
        final decoded = jsonDecode(raw);
        if (decoded is List) {
          _items = decoded
              .map(KandiAddress.fromJson)
              .whereType<KandiAddress>()
              .toList();
        }
      }
      _selectedId = prefs.getString(_selectedKey);
    } catch (_) {
      _items = <KandiAddress>[];
    }

    _loaded = true;
    revision.value = revision.value + 1;
  }

  static Future<void> save(KandiAddress address) async {
    await load();

    final index = _items.indexWhere((a) => a.id == address.id);
    if (index >= 0) {
      _items[index] = address;
    } else {
      _items = [..._items, address];
      // The first address saved becomes the selected one automatically.
      // Making somebody pick a default from a list of one is a step with no
      // decision in it.
      _selectedId ??= address.id;
    }

    await _persist();
  }

  static Future<void> remove(String id) async {
    await load();
    _items = _items.where((a) => a.id != id).toList();
    // Removing the selected one falls back to whatever is left, rather than
    // leaving a dangling id that makes `selected` skip to the first anyway.
    if (_selectedId == id) _selectedId = _items.isEmpty ? null : _items.first.id;
    await _persist();
  }

  static Future<void> select(String id) async {
    await load();
    _selectedId = id;
    await _persist();
  }

  static Future<void> _persist() async {
    revision.value = revision.value + 1;
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(
        storageKey,
        jsonEncode(_items.map((a) => a.toJson()).toList()),
      );
      if (_selectedId != null) {
        await prefs.setString(_selectedKey, _selectedId!);
      } else {
        await prefs.remove(_selectedKey);
      }
    } catch (_) {}
  }
}

class KandiAddressesScreen extends StatefulWidget {
  const KandiAddressesScreen({
    super.key,
    this.width,
    this.height,
    this.pickMode = false,
    this.onPicked,
  });

  final double? width;
  final double? height;

  /// Opened from the checkout to CHOOSE one, rather than from the account to
  /// manage them. The difference is what a tap does: pick and pop, or edit.
  final bool pickMode;

  final void Function(KandiAddress address)? onPicked;

  @override
  State<KandiAddressesScreen> createState() => _KandiAddressesScreenState();
}

class _KandiAddressesScreenState extends State<KandiAddressesScreen> {
  @override
  void initState() {
    super.initState();
    KandiAddresses.load();
  }

  Future<void> _edit([KandiAddress? existing]) async {
    final saved = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _AddressSheet(existing: existing),
    );
    if (saved == true && mounted) setState(() {});
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
          widget.pickMode ? 'Choose an address' : 'Delivery addresses',
        ),
        body: ValueListenableBuilder<int>(
          valueListenable: KandiAddresses.revision,
          builder: (context, _, __) {
            final items = KandiAddresses.items;

            if (items.isEmpty) {
              return KandiEmpty(
                icon: Icons.location_on_outlined,
                title: 'No addresses yet',
                message: 'Save one and your next checkout fills itself in.',
                actionLabel: 'Add an address',
                onAction: _edit,
              );
            }

            return ListView.separated(
              padding: const EdgeInsets.all(KandiSpace.gutter),
              itemCount: items.length,
              separatorBuilder: (_, __) => const SizedBox(height: KandiSpace.sm),
              itemBuilder: (context, index) => _card(items[index]),
            );
          },
        ),
        floatingActionButton: ValueListenableBuilder<int>(
          valueListenable: KandiAddresses.revision,
          builder: (context, _, __) {
            if (KandiAddresses.items.isEmpty) return const SizedBox.shrink();
            return FloatingActionButton.extended(
              onPressed: _edit,
              backgroundColor: KandiColors.primary,
              icon: const Icon(Icons.add_rounded, color: Colors.white),
              label: Text(
                'Add address',
                style: KandiType.title(color: Colors.white)
                    .copyWith(fontWeight: FontWeight.w700),
              ),
            );
          },
        ),
      ),
    );
  }

  Widget _card(KandiAddress address) {
    final isSelected = KandiAddresses.selected?.id == address.id;

    return KandiCard(
      padding: const EdgeInsets.all(KandiSpace.md),
      onTap: () async {
        if (widget.pickMode) {
          await KandiAddresses.select(address.id);
          if (!mounted) return;
          widget.onPicked?.call(address);
          Navigator.of(context).maybePop();
        } else {
          await KandiAddresses.select(address.id);
        }
      },
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(
            isSelected
                ? Icons.radio_button_checked_rounded
                : Icons.radio_button_off_rounded,
            size: 20,
            color: isSelected ? KandiColors.primary : KandiColors.line,
          ),
          const SizedBox(width: KandiSpace.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Text(address.label, style: KandiType.title()),
                    if (isSelected) ...[
                      const SizedBox(width: KandiSpace.sm),
                      const KandiChip(
                        label: 'Default',
                        background: KandiColors.primarySoft,
                        foreground: KandiColors.primaryInk,
                      ),
                    ],
                  ],
                ),
                const SizedBox(height: 2),
                Text(address.summary, style: KandiType.bodyText()),
                if (address.name.isNotEmpty || address.phone.isNotEmpty)
                  Text(
                    [address.name, address.phone]
                        .where((s) => s.isNotEmpty)
                        .join(' · '),
                    style: KandiType.caption(),
                  ),
              ],
            ),
          ),
          if (!widget.pickMode)
            PopupMenuButton<String>(
              icon: const Icon(Icons.more_vert_rounded,
                  size: 20, color: KandiColors.muted),
              color: KandiColors.surface,
              shape:
                  const RoundedRectangleBorder(borderRadius: KandiRadius.md),
              onSelected: (value) {
                if (value == 'edit') _edit(address);
                if (value == 'delete') KandiAddresses.remove(address.id);
              },
              itemBuilder: (_) => [
                PopupMenuItem(
                  value: 'edit',
                  child: Text('Edit', style: KandiType.label()),
                ),
                PopupMenuItem(
                  value: 'delete',
                  child: Text('Delete',
                      style: KandiType.label(color: KandiColors.sale)),
                ),
              ],
            ),
        ],
      ),
    );
  }
}

/// The add/edit form, as a sheet.
///
/// A sheet rather than a page: it is six fields, it is always reached from a
/// list, and a full screen push means a back button that looks like it might
/// discard what has been typed.
class _AddressSheet extends StatefulWidget {
  const _AddressSheet({this.existing});

  final KandiAddress? existing;

  @override
  State<_AddressSheet> createState() => _AddressSheetState();
}

class _AddressSheetState extends State<_AddressSheet> {
  late final _label =
      TextEditingController(text: widget.existing?.label ?? 'Home');
  late final _name = TextEditingController(text: widget.existing?.name ?? '');
  late final _phone = TextEditingController(text: widget.existing?.phone ?? '');
  late final _street =
      TextEditingController(text: widget.existing?.street ?? '');
  late final _city = TextEditingController(text: widget.existing?.city ?? '');
  late final _notes = TextEditingController(text: widget.existing?.notes ?? '');

  String? _error;

  @override
  void dispose() {
    for (final c in [_label, _name, _phone, _street, _city, _notes]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _save() async {
    if (_street.text.trim().isEmpty || _city.text.trim().isEmpty) {
      setState(() => _error = 'A street and a town are both needed.');
      return;
    }

    await KandiAddresses.save(KandiAddress(
      id: widget.existing?.id ??
          DateTime.now().microsecondsSinceEpoch.toString(),
      label: _label.text.trim().isEmpty ? 'Address' : _label.text.trim(),
      name: _name.text.trim(),
      phone: _phone.text.trim(),
      street: _street.text.trim(),
      city: _city.text.trim(),
      notes: _notes.text.trim(),
    ));

    if (mounted) Navigator.of(context).pop(true);
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      // Lifts the sheet clear of the keyboard, so the field being typed into
      // is never behind it. Without this the town field is under the keys on
      // most phones.
      padding: EdgeInsets.only(
        bottom: MediaQuery.of(context).viewInsets.bottom,
      ),
      child: Container(
        decoration: const BoxDecoration(
          color: KandiColors.surface,
          borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
        ),
        padding: const EdgeInsets.all(KandiSpace.lg),
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Center(
                child: Container(
                  width: 36,
                  height: 4,
                  decoration: BoxDecoration(
                    color: KandiColors.line,
                    borderRadius: KandiRadius.pill,
                  ),
                ),
              ),
              const SizedBox(height: KandiSpace.lg),
              Text(
                widget.existing == null ? 'New address' : 'Edit address',
                style: KandiType.heading(),
              ),
              const SizedBox(height: KandiSpace.lg),
              _field(_label, 'Name it', hint: 'Home, work, mum'),
              const SizedBox(height: KandiSpace.md),
              _field(_street, 'Street, building, landmark', maxLines: 2),
              const SizedBox(height: KandiSpace.md),
              _field(_city, 'Town or city'),
              const SizedBox(height: KandiSpace.md),
              Row(
                children: [
                  Expanded(child: _field(_name, 'Who receives it')),
                  const SizedBox(width: KandiSpace.sm),
                  Expanded(
                    child: _field(_phone, 'Their phone',
                        keyboard: TextInputType.phone),
                  ),
                ],
              ),
              const SizedBox(height: KandiSpace.md),
              _field(_notes, 'Notes for the courier (optional)'),
              if (_error != null) ...[
                const SizedBox(height: KandiSpace.md),
                Text(_error!, style: KandiType.label(color: KandiColors.sale)),
              ],
              const SizedBox(height: KandiSpace.lg),
              KandiButton(label: 'Save address', onPressed: _save),
              const SizedBox(height: KandiSpace.md),
            ],
          ),
        ),
      ),
    );
  }

  Widget _field(
    TextEditingController controller,
    String label, {
    String? hint,
    TextInputType? keyboard,
    int maxLines = 1,
  }) {
    return TextField(
      controller: controller,
      keyboardType: keyboard,
      maxLines: maxLines,
      textCapitalization: TextCapitalization.words,
      style: KandiType.bodyText(color: KandiColors.ink),
      decoration: InputDecoration(
        labelText: label,
        hintText: hint,
        labelStyle: KandiType.label(color: KandiColors.muted),
        hintStyle: KandiType.caption(color: KandiColors.faint),
        filled: true,
        fillColor: KandiColors.hairline,
        contentPadding: const EdgeInsets.all(KandiSpace.md),
        border: const OutlineInputBorder(
          borderRadius: KandiRadius.md,
          borderSide: BorderSide.none,
        ),
        enabledBorder: const OutlineInputBorder(
          borderRadius: KandiRadius.md,
          borderSide: BorderSide.none,
        ),
        focusedBorder: const OutlineInputBorder(
          borderRadius: KandiRadius.md,
          borderSide: BorderSide(color: KandiColors.primary, width: 1.5),
        ),
      ),
    );
  }
}
