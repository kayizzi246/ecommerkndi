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

import 'package:flutter/foundation.dart' show defaultTargetPlatform, TargetPlatform;

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

// ============================================================
//  KANDI — PUSH NOTIFICATIONS
//
//  DEPENDENCIES — ADD THESE IN FLUTTERFLOW
//  -----------------------------------------------------------
//      firebase_core: ^3.6.0
//      firebase_messaging: ^15.1.3
//      flutter_local_notifications: ^18.0.1
//
//  FlutterFlow's own Firebase setup covers google-services.json
//  and GoogleService-Info.plist. What it does NOT do:
//
//    android/app/src/main/AndroidManifest.xml, inside <application>:
//      <meta-data
//        android:name="com.google.firebase.messaging.default_notification_channel_id"
//        android:value="kandi_orders"/>
//
//    ios: enable Push Notifications and Background Modes >
//      Remote notifications in Signing & Capabilities, and upload
//      the APNs key to the Firebase project. Without the APNs key
//      iOS registration silently returns a null token and nothing
//      ever arrives — with no error anywhere to explain it.
//
//  WHY FCM AND NOT SOMETHING SIMPLER
//  -----------------------------------------------------------
//  A shop needs to reach a phone whose app is CLOSED. That rules
//  out anything running in the app's own process — a websocket, a
//  poll, a timer — because none of them exist when the shopper
//  has swiped the app away, which is exactly when "your order is
//  on the way" matters. Only the OS-level transports can wake a
//  closed app, and on Android that is FCM.
//
//  THREE KINDS OF MESSAGE, AND THEY ARE NOT ALIKE
//  -----------------------------------------------------------
//    • ORDERS are addressed to ONE device, because they say
//      something true about one person's parcel. They go to a
//      registered token.
//    • PROMOTIONS are addressed to EVERYONE who wants them, and
//      go to a TOPIC. A topic costs the server nothing per
//      recipient and, more importantly, it means the shop does
//      not need a list of who to send to — the phones subscribe
//      themselves, and unsubscribing actually stops the messages
//      rather than setting a flag the sender might ignore.
//
//  That distinction is why the preference switches in the account
//  screen are real now. They were honest placeholders before —
//  the sheet said so — because there was nothing to switch. A
//  topic subscription is a thing that can genuinely be turned
//  off, from the device, without trusting the server.
//
//  ORDER MESSAGES ARE NOT OPTIONAL IN THE SAME WAY
//  -----------------------------------------------------------
//  There is no `orders` topic. A shopper who turns order updates
//  off stops them at the SERVER, by the preference this file
//  syncs with the token — because a device that unsubscribed
//  from its own delivery notifications would also stop receiving
//  "your payment failed", and that is a message a shop has to be
//  able to deliver.
// ============================================================

const String _kApiBaseUrl = 'https://kandiug.com';

/// Topics the app subscribes to, keyed by the preference that controls each.
///
/// The preference keys are the ones `account_widget.dart` already writes — this
/// file deliberately reuses them rather than inventing a parallel set, so the
/// switches a shopper has already set carry over rather than silently resetting
/// to the defaults the day push arrives.
const Map<String, String> _kTopics = <String, String>{
  'kandi_notif_deals': 'promos',
  'kandi_notif_price_drops': 'price_drops',
  'kandi_notif_new_arrivals': 'new_arrivals',
};

/// The Android channel orders arrive on.
///
/// Named in the manifest too (see the header). Android needs the channel to
/// exist before the first message lands, or that message is filed under a
/// default channel the shopper cannot then configure separately — and channels
/// cannot be renamed after creation, only deleted, so getting this wrong once
/// is permanent for every install that saw it.
const AndroidNotificationChannel _kOrderChannel = AndroidNotificationChannel(
  'kandi_orders',
  'Order updates',
  description: 'Confirmations, dispatch and delivery.',
  importance: Importance.high,
);

const AndroidNotificationChannel _kPromoChannel = AndroidNotificationChannel(
  'kandi_promos',
  'Deals and offers',
  // Deliberately quieter than orders. A flash sale that buzzes the phone at
  // the same intensity as "your parcel is at the door" is how an app gets its
  // notifications turned off wholesale, and the shop loses the delivery ones
  // it actually needed.
  description: 'Super Deals, price drops and new arrivals.',
  importance: Importance.defaultImportance,
);

/// Handles a message that arrived while the app was killed or backgrounded.
///
/// MUST be a top-level function — Flutter spins up a separate isolate for it,
/// and an isolate cannot be handed a closure. It must also initialise Firebase
/// itself for the same reason: the isolate does not inherit the one `main()`
/// set up.
///
/// It deliberately does almost nothing. A notification with a `notification`
/// block is drawn by the OS without the app being involved; anything done here
/// runs on a background isolate with no UI and a short leash. Badge counts and
/// deep-link state are set when the app is actually opened.
@pragma('vm:entry-point')
Future<void> kandiBackgroundMessage(RemoteMessage message) async {
  await Firebase.initializeApp();
}

/// Push, as one thing the app turns on once.
///
/// `KandiPush.start()` from the first screen that builds. Everything else here
/// is either called by that or by the notification preferences sheet.
class KandiPush {
  KandiPush._();

  static final FlutterLocalNotificationsPlugin _local =
      FlutterLocalNotificationsPlugin();

  static bool _started = false;

  /// Registers this device and wires up the three delivery paths.
  ///
  /// Safe to call more than once — the guard matters because FlutterFlow will
  /// happily rebuild the widget that calls it, and registering the foreground
  /// listener twice shows every notification twice.
  static Future<void> start() async {
    if (_started) return;
    _started = true;

    try {
      await Firebase.initializeApp();

      // ---- Permission ----
      //
      // iOS and Android 13+ both require it, and both treat a refusal as final:
      // asking again does nothing, the dialog never appears a second time. So
      // this is asked once, here, and a refusal is accepted quietly rather than
      // nagged at.
      final messaging = FirebaseMessaging.instance;
      final settings = await messaging.requestPermission(
        alert: true,
        badge: true,
        sound: true,
      );
      if (settings.authorizationStatus == AuthorizationStatus.denied) {
        return;
      }

      // ---- Channels, before the first message ----
      const androidInit = AndroidInitializationSettings('@mipmap/ic_launcher');
      const iosInit = DarwinInitializationSettings(
        // All false: permission was just requested above, and asking twice
        // shows the shopper two dialogs for one decision.
        requestAlertPermission: false,
        requestBadgePermission: false,
        requestSoundPermission: false,
      );
      await _local.initialize(
        const InitializationSettings(android: androidInit, iOS: iosInit),
      );

      final android = _local.resolvePlatformSpecificImplementation<
          AndroidFlutterLocalNotificationsPlugin>();
      await android?.createNotificationChannel(_kOrderChannel);
      await android?.createNotificationChannel(_kPromoChannel);

      // ---- The three paths a message can arrive by ----
      //
      // Backgrounded and killed are handled by the OS and the top-level
      // handler. FOREGROUND is the one that needs code: FCM does not draw a
      // notification while the app is open, on the assumption the app will show
      // it in-context. Without this, a shopper looking at the app when their
      // order ships sees nothing at all.
      FirebaseMessaging.onBackgroundMessage(kandiBackgroundMessage);
      FirebaseMessaging.onMessage.listen(_showForeground);

      // ---- The token ----
      final token = await messaging.getToken();
      if (token != null) await _register(token);

      // Tokens rotate — on reinstall, on restore to a new handset, and
      // occasionally for no visible reason. Without this listener the shop goes
      // on sending to a dead token and the shopper simply stops hearing from
      // it, which looks like the feature having been removed.
      FirebaseMessaging.instance.onTokenRefresh.listen(_register);

      await syncTopics();
    } catch (_) {
      // Push failing must never take the app down with it. A shop that does not
      // open because a notification service was unreachable has traded its
      // entire business for a convenience.
    }
  }

  /// Draws a message that arrived while the app was on screen.
  static Future<void> _showForeground(RemoteMessage message) async {
    final notification = message.notification;
    if (notification == null) return;

    final isPromo = (message.data['kind'] ?? '') == 'promo';
    final channel = isPromo ? _kPromoChannel : _kOrderChannel;

    await _local.show(
      notification.hashCode,
      notification.title,
      notification.body,
      NotificationDetails(
        android: AndroidNotificationDetails(
          channel.id,
          channel.name,
          channelDescription: channel.description,
          importance: channel.importance,
          priority: isPromo ? Priority.defaultPriority : Priority.high,
          icon: '@mipmap/ic_launcher',
        ),
        iOS: const DarwinNotificationDetails(),
      ),
      payload: jsonEncode(message.data),
    );
  }

  /// Tells the shop which device this is, and who is holding it.
  ///
  /// The bearer token goes up with it when there is one, so the server can file
  /// the device against a customer and address order messages to it. Sent
  /// WITHOUT one when nobody is signed in, which is not a mistake: an anonymous
  /// device can still receive promotions, and re-registering after sign-in is
  /// what attaches it to the account.
  static Future<void> _register(String fcmToken) async {
    try {
      final prefs = await SharedPreferences.getInstance();

      // Nothing to do if this exact token is already registered against this
      // exact signed-in state. Called on every cold start otherwise, which is a
      // request per launch for a row that has not changed.
      final auth = prefs.getString('kandi_auth_token') ?? '';
      final fingerprint = '$fcmToken:${auth.isEmpty ? 'guest' : 'user'}';
      if (prefs.getString('kandi_push_registered') == fingerprint) return;

      final response = await http
          .post(
            Uri.parse('$_kApiBaseUrl/api/app/notifications/register'),
            headers: {
              'Content-Type': 'application/json',
              if (auth.isNotEmpty) 'Authorization': 'Bearer $auth',
            },
            body: jsonEncode({
              'token': fcmToken,
              // `defaultTargetPlatform` rather than `Theme.of(context).platform`:
              // this runs from a token-refresh listener that has no widget and
              // no context, and reaching for one there is how registration ends
              // up silently failing on exactly the devices whose token rotated.
              'platform':
                  defaultTargetPlatform == TargetPlatform.iOS ? 'ios' : 'android',
            }),
          )
          .timeout(const Duration(seconds: 20));

      if (response.statusCode == 200) {
        await prefs.setString('kandi_push_registered', fingerprint);
      }
    } catch (_) {}
  }

  /// Applies the shopper's switches to their real topic subscriptions.
  ///
  /// Called at startup and every time a switch moves. Subscribing to a topic
  /// you are already on, or leaving one you were never on, are both no-ops at
  /// Firebase — so this can be run wholesale rather than diffed, which is what
  /// keeps it correct after a reinstall restores the preferences but not the
  /// subscriptions.
  static Future<void> syncTopics() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final messaging = FirebaseMessaging.instance;

      for (final entry in _kTopics.entries) {
        // Defaults match the account sheet's: deals and price drops on, new
        // arrivals off. A shop that opts everyone into everything on install
        // gets one week of reach and then a permanently disabled channel.
        final wanted =
            prefs.getBool(entry.key) ?? (entry.key != 'kandi_notif_new_arrivals');
        if (wanted) {
          await messaging.subscribeToTopic(entry.value);
        } else {
          await messaging.unsubscribeFromTopic(entry.value);
        }
      }
    } catch (_) {}
  }

  /// Called on sign-out. Drops the account link but keeps the device known, so
  /// promotions carry on and the next sign-in re-attaches it.
  static Future<void> forgetAccount() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.remove('kandi_push_registered');
      final token = await FirebaseMessaging.instance.getToken();
      if (token != null) await _register(token);
    } catch (_) {}
  }
}
