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

import 'dart:convert';

import 'package:onesignal_flutter/onesignal_flutter.dart';
import 'package:shared_preferences/shared_preferences.dart';

// ============================================================
//  KANDI — PUSH NOTIFICATIONS (OneSignal)
//
//  DEPENDENCY — ADD THIS IN FLUTTERFLOW
//  -----------------------------------------------------------
//      onesignal_flutter: ^5.2.6
//
//  And the app id, at build time:
//      --dart-define=ONESIGNAL_APP_ID=xxxxxxxx-xxxx-xxxx-...
//
//  iOS still needs the APNs key uploaded to the OneSignal
//  dashboard, and Push Notifications + Background Modes >
//  Remote notifications enabled in Signing & Capabilities.
//  Without the APNs key, iOS subscribes and never receives —
//  with no error anywhere to explain it.
//
//  WHY ONESIGNAL AND NOT FIREBASE
//  -----------------------------------------------------------
//  This was written against FCM first, and the rewrite is worth
//  explaining because it deleted more than it added.
//
//  FCM is a TRANSPORT. It moves a message to a device token and
//  stops there, which means everything around it is yours to
//  build: a table of device tokens, the code that writes to it
//  on every launch and rotation, the pruning of dead tokens, the
//  join from an order to the devices its customer holds, and a
//  signed JWT for every send.
//
//  OneSignal is that whole layer. It keeps the subscriptions, it
//  knows which device belongs to which customer once you tell it
//  the customer's id, and it addresses them by that id. So:
//
//    • No device table in WordPress.
//    • No /api/app/notifications/register — the SDK registers
//      the device itself, and that route has been deleted rather
//      than left as a no-op for somebody to wire up later.
//    • No token refresh listener, no stale-token pruning.
//    • The server sends by CUSTOMER ID, which it already has on
//      the order, instead of first asking WordPress which
//      handsets that customer owns.
//
//  ONE PERSON, MANY DEVICES — external id does the work
//  -----------------------------------------------------------
//  `OneSignal.login(customerId)` ties this device to a customer.
//  A shopper with a phone and a tablet ends up with both
//  subscriptions under one external id, and an order message
//  addressed to that id reaches both without the shop knowing
//  either device exists.
//
//  `logout()` on sign-out cuts that link and leaves the device
//  subscribed anonymously — so promotions carry on and order
//  messages stop, which is exactly the right split for a handset
//  nobody is signed in on.
//
//  TAGS, NOT TOPICS
//  -----------------------------------------------------------
//  FCM topics were how the preference switches were made real.
//  OneSignal's equivalent is tags, and they are better suited:
//  a topic is a subscription the server cannot see, so the shop
//  could never answer "how many people want deal alerts". A tag
//  is an attribute of the subscription, so the same switch both
//  filters a send AND is countable.
//
//  ORDER MESSAGES ARE NOT A TAG
//  -----------------------------------------------------------
//  Unchanged from the FCM version, and for the same reason. A
//  shopper who turns order updates off stops them at the SERVER,
//  because a device that could unsubscribe itself from delivery
//  notifications would also stop receiving "your payment
//  failed", and a shop has to be able to deliver that.
// ============================================================

/// The OneSignal app id, from the build environment.
///
/// `--dart-define` rather than a constant in the file: this is not a secret —
/// it is public in every installed binary — but it differs between the
/// development and production OneSignal apps, and hard-coding it is how a test
/// build ends up sending real notifications to real shoppers.
///
/// Empty is a supported state. Everything below no-ops, exactly as the server
/// half does when its key is unset: a shop with push not yet configured must
/// still open.
const String _kOneSignalAppId = String.fromEnvironment('ONESIGNAL_APP_ID');

/// The tags the app sets, keyed by the preference that controls each.
///
/// The preference keys are the ones `account_widget.dart` already writes — this
/// file deliberately reuses them rather than inventing a parallel set, so the
/// switches a shopper has already set carry over rather than resetting to the
/// defaults the day push arrives.
///
/// The VALUES are the tag names the server filters on. `lib/push.ts` holds the
/// same three strings and the two have to agree: a send filtered on a tag the
/// app never sets reaches nobody, and does it silently.
const Map<String, String> _kTags = <String, String>{
  'kandi_notif_deals': 'deals',
  'kandi_notif_price_drops': 'price_drops',
  'kandi_notif_new_arrivals': 'new_arrivals',
};

/// Push, as one thing the app turns on once.
///
/// `KandiPush.start()` from the first screen that builds. The public surface —
/// `start`, `syncTopics`, `forgetAccount` — is unchanged from the FCM version
/// on purpose: the account screen calls `syncTopics` from three switches, and a
/// rename would have been churn in a file that has nothing to do with which
/// vendor moves the messages.
class KandiPush {
  KandiPush._();

  static bool _started = false;

  static bool get _configured => _kOneSignalAppId.trim().isNotEmpty;

  /// Initialises the SDK, asks for permission, and applies the saved switches.
  ///
  /// Safe to call more than once — the guard matters because FlutterFlow will
  /// happily rebuild the widget that calls it.
  static Future<void> start() async {
    if (_started || !_configured) return;
    _started = true;

    try {
      OneSignal.initialize(_kOneSignalAppId);

      // ---- Permission ----
      //
      // iOS and Android 13+ both require it, and both treat a refusal as
      // final: asking again does nothing, the dialog never reappears. So it is
      // asked once, here, and a refusal is accepted quietly rather than nagged
      // at.
      //
      // `fallbackToSettings: false` — a shopper who said no is not then sent
      // to the system settings screen. That is the pattern that gets an app
      // uninstalled, and the answer to a refusal is to ask again later in
      // context, not to escalate.
      await OneSignal.Notifications.requestPermission(false);

      // A device that has signed in before is re-linked on every cold start.
      // OneSignal keeps the external id itself, but re-asserting it is what
      // repairs the case where the app was reinstalled and the session
      // restored from disk without ever passing through the sign-in screen.
      await _linkCustomer();

      await syncTopics();
    } catch (_) {
      // Push failing must never take the app down with it. A shop that does
      // not open because a notification service was unreachable has traded its
      // entire business for a convenience.
    }
  }

  /// Ties this device to the signed-in shopper, or cuts the link when nobody is.
  ///
  /// The customer id is read from the record `auth_widget.dart` saves. A
  /// private reader over a key another file owns, in the same pattern every
  /// screen here uses — the STORAGE KEY is the contract.
  static Future<void> _linkCustomer() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final raw = prefs.getString('kandi_auth_customer');
      if (raw == null || raw.isEmpty) {
        await OneSignal.logout();
        return;
      }

      final decoded = jsonDecode(raw);
      final id = decoded is Map ? decoded['id'] : null;
      if (id == null) {
        await OneSignal.logout();
        return;
      }

      // The WordPress customer id, as a string, and it must be the SAME id the
      // server addresses in `lib/push.ts`. That is the entire contract between
      // the two halves of this feature: get it wrong and every order
      // notification is sent successfully to nobody.
      await OneSignal.login(id.toString());
    } catch (_) {}
  }

  /// Applies the shopper's switches to their real subscription tags.
  ///
  /// Called at startup and every time a switch moves. Setting a tag that is
  /// already set, or clearing one that was never there, are both no-ops at
  /// OneSignal — so this runs wholesale rather than diffing, which is what
  /// keeps it correct after a reinstall restores the preferences but not the
  /// subscription state.
  ///
  /// Still named `syncTopics` although OneSignal calls them tags: three call
  /// sites in the account screen use this name, and renaming it would be churn
  /// for no behavioural gain. The doc comment is the honest version.
  static Future<void> syncTopics() async {
    if (!_configured) return;
    try {
      final prefs = await SharedPreferences.getInstance();

      for (final entry in _kTags.entries) {
        // Defaults match the account sheet's: deals and price drops on, new
        // arrivals off. A shop that opts everyone into everything on install
        // gets one week of reach and then a permanently disabled channel.
        final wanted =
            prefs.getBool(entry.key) ?? (entry.key != 'kandi_notif_new_arrivals');
        if (wanted) {
          // "1" rather than "true": the server's filter compares strings, and
          // one side writing a bool that serialises differently is the kind of
          // mismatch that shows up as a campaign reaching nobody.
          OneSignal.User.addTagWithKey(entry.value, '1');
        } else {
          OneSignal.User.removeTag(entry.value);
        }
      }
    } catch (_) {}
  }

  /// Called on sign-in AND sign-out — it reads the session rather than being
  /// told which happened, so one call is correct either way.
  ///
  /// After sign-out the device stays subscribed anonymously: promotions carry
  /// on, order messages stop. That is the right split for a handset nobody is
  /// signed in on, and it means the next sign-in re-links rather than
  /// re-registering from nothing.
  static Future<void> forgetAccount() async {
    if (!_configured) return;
    await _linkCustomer();
  }
}
