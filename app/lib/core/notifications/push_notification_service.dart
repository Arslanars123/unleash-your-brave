import 'dart:async';
import 'dart:io';

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:unleash_your_brave/app/router/app_router.dart';
import 'package:unleash_your_brave/features/chat/domain/repositories/chat_repository.dart';
import 'package:unleash_your_brave/firebase_options.dart';

/// Handles FCM + local notifications for chat.
///
/// Android: full foreground / background / killed delivery via FCM.
/// iOS: code is complete; APNs still requires an Apple Developer account
/// (see docs/PUSH_NOTIFICATIONS.md).
@pragma('vm:entry-point')
Future<void> firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  await Firebase.initializeApp(options: DefaultFirebaseOptions.currentPlatform);
}

class PushNotificationService {
  PushNotificationService(this._chatRepository);

  final ChatRepository _chatRepository;
  final FirebaseMessaging _messaging = FirebaseMessaging.instance;
  final FlutterLocalNotificationsPlugin _local =
      FlutterLocalNotificationsPlugin();

  static const _androidChannel = AndroidNotificationChannel(
    'chat_messages',
    'Chat messages',
    description: 'New messages in the event group chat',
    importance: Importance.high,
  );

  static const _announcementsChannel = AndroidNotificationChannel(
    'announcements',
    'Announcements',
    description: 'Event announcements and countdown reminders',
    importance: Importance.high,
  );

  StreamSubscription<String>? _tokenRefreshSub;
  bool _initialized = false;

  Future<void> initialize() async {
    if (_initialized) return;
    _initialized = true;

    FirebaseMessaging.onBackgroundMessage(firebaseMessagingBackgroundHandler);

    const androidInit = AndroidInitializationSettings('@mipmap/ic_launcher');
    const iosInit = DarwinInitializationSettings(
      requestAlertPermission: true,
      requestBadgePermission: true,
      requestSoundPermission: true,
    );
    await _local.initialize(
      const InitializationSettings(android: androidInit, iOS: iosInit),
      onDidReceiveNotificationResponse: _onLocalNotificationTap,
    );

    final androidPlugin = _local
        .resolvePlatformSpecificImplementation<
            AndroidFlutterLocalNotificationsPlugin>();
    await androidPlugin?.createNotificationChannel(_androidChannel);
    await androidPlugin?.createNotificationChannel(_announcementsChannel);

    await _messaging.setForegroundNotificationPresentationOptions(
      alert: true,
      badge: true,
      sound: true,
    );

    final settings = await _messaging.requestPermission(
      alert: true,
      badge: true,
      sound: true,
      provisional: false,
    );

    if (settings.authorizationStatus == AuthorizationStatus.denied) {
      debugPrint('Push permission denied');
      return;
    }

    FirebaseMessaging.onMessage.listen(_showForegroundNotification);
    FirebaseMessaging.onMessageOpenedApp.listen(_handleMessageOpen);

    final initial = await _messaging.getInitialMessage();
    if (initial != null) {
      _handleMessageOpen(initial);
    }

    await registerTokenWithBackend();
    _tokenRefreshSub = _messaging.onTokenRefresh.listen((token) async {
      try {
        await _chatRepository.registerDevice(
          token: token,
          platform: Platform.isIOS ? 'ios' : 'android',
        );
      } catch (error) {
        debugPrint('Failed to refresh FCM token registration: $error');
      }
    });
  }

  Future<void> registerTokenWithBackend() async {
    try {
      if (Platform.isIOS) {
        // Without an Apple Developer APNs key, getToken() throws.
        final apns = await _messaging.getAPNSToken();
        if (apns == null || apns.isEmpty) {
          debugPrint(
            'Skipping FCM registration: APNs token not set yet '
            '(expected until Apple Developer push is configured).',
          );
          return;
        }
      }

      final token = await _messaging.getToken();
      if (token == null || token.isEmpty) {
        debugPrint('FCM token unavailable');
        return;
      }
      await _chatRepository.registerDevice(
        token: token,
        platform: Platform.isIOS ? 'ios' : 'android',
      );
    } on FirebaseException catch (error) {
      if (error.code == 'apns-token-not-set') {
        debugPrint(
          'Skipping FCM registration: APNs not configured yet.',
        );
        return;
      }
      debugPrint('Failed to register FCM token: ${error.message}');
    } catch (error) {
      debugPrint('Failed to register FCM token: $error');
    }
  }

  Future<void> unregisterCurrentToken() async {
    try {
      if (Platform.isIOS) {
        final apns = await _messaging.getAPNSToken();
        if (apns == null || apns.isEmpty) return;
      }
      final token = _chatRepository.getFCMToken() ?? await _messaging.getToken();
      if (token == null) return;
      await _chatRepository.unregisterDevice(token);
      await _messaging.deleteToken();
    } catch (_) {}
  }

  Future<void> _showForegroundNotification(RemoteMessage message) async {
    final notification = message.notification;
    final isAnnouncement = message.data['type'] == 'announcement';
    final title = notification?.title ??
        (message.data['title'] as String?) ??
        (isAnnouncement ? 'Announcement' : 'New message');
    final body = notification?.body ??
        (message.data['body'] as String?) ??
        (isAnnouncement ? 'Open notifications' : 'Open the group chat');

    final channel = isAnnouncement ? _announcementsChannel : _androidChannel;

    await _local.show(
      message.hashCode,
      title,
      body,
      NotificationDetails(
        android: AndroidNotificationDetails(
          channel.id,
          channel.name,
          channelDescription: channel.description,
          importance: Importance.high,
          priority: Priority.high,
          icon: '@mipmap/ic_launcher',
          tag: isAnnouncement
              ? (message.data['announcementId'] as String? ?? 'announcement')
              : (message.data['groupId'] as String? ?? 'chat'),
        ),
        iOS: const DarwinNotificationDetails(
          presentAlert: true,
          presentBadge: true,
          presentSound: true,
        ),
      ),
      payload: jsonEncodePayload(message.data),
    );
  }

  void _onLocalNotificationTap(NotificationResponse response) {
    _navigateFromPayload(response.payload);
  }

  void _handleMessageOpen(RemoteMessage message) {
    _navigateFromData(message.data);
  }

  void _navigateFromPayload(String? payload) {
    if (payload == null || payload.isEmpty) {
      AppRouter.router.go('/network/chat');
      return;
    }
    final data = <String, String>{};
    for (final part in payload.split('&')) {
      final idx = part.indexOf('=');
      if (idx <= 0) continue;
      data[part.substring(0, idx)] = part.substring(idx + 1);
    }
    _navigateFromData(data);
  }

  void _navigateFromData(Map<String, dynamic> data) {
    final type = data['type'];
    if (type == 'announcement') {
      final id = data['announcementId'];
      if (id != null && id.toString().isNotEmpty) {
        AppRouter.router.go('/notifications?id=$id');
      } else {
        AppRouter.router.go('/notifications');
      }
      return;
    }
    if (type == 'chat.message' || data['groupId'] != null) {
      AppRouter.router.go('/network/chat');
    }
  }

  static String jsonEncodePayload(Map<String, dynamic> data) {
    return data.entries.map((e) => '${e.key}=${e.value}').join('&');
  }

  Future<void> dispose() async {
    await _tokenRefreshSub?.cancel();
  }
}
