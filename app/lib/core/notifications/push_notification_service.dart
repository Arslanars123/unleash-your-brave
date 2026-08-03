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

    await _local
        .resolvePlatformSpecificImplementation<
            AndroidFlutterLocalNotificationsPlugin>()
        ?.createNotificationChannel(_androidChannel);

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
      await _chatRepository.registerDevice(
        token: token,
        platform: Platform.isIOS ? 'ios' : 'android',
      );
    });
  }

  Future<void> registerTokenWithBackend() async {
    try {
      // On iOS without APNs this may return null — that's expected until
      // Apple Developer + APNs are configured.
      final token = await _messaging.getToken();
      if (token == null || token.isEmpty) {
        debugPrint('FCM token unavailable (APNs may be missing on iOS)');
        return;
      }
      await _chatRepository.registerDevice(
        token: token,
        platform: Platform.isIOS ? 'ios' : 'android',
      );
    } catch (error, stack) {
      debugPrint('Failed to register FCM token: $error\n$stack');
    }
  }

  Future<void> unregisterCurrentToken() async {
    final token = _chatRepository.getFCMToken() ?? await _messaging.getToken();
    if (token == null) return;
    await _chatRepository.unregisterDevice(token);
    try {
      await _messaging.deleteToken();
    } catch (_) {}
  }

  Future<void> _showForegroundNotification(RemoteMessage message) async {
    final notification = message.notification;
    final title = notification?.title ??
        (message.data['title'] as String?) ??
        'New message';
    final body = notification?.body ??
        (message.data['body'] as String?) ??
        'Open the group chat';

    await _local.show(
      message.hashCode,
      title,
      body,
      NotificationDetails(
        android: AndroidNotificationDetails(
          _androidChannel.id,
          _androidChannel.name,
          channelDescription: _androidChannel.description,
          importance: Importance.high,
          priority: Priority.high,
          icon: '@mipmap/ic_launcher',
          tag: message.data['groupId'] as String? ?? 'chat',
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
    AppRouter.router.go('/network/chat');
  }

  void _handleMessageOpen(RemoteMessage message) {
    final type = message.data['type'];
    if (type == 'chat.message' || message.data['groupId'] != null) {
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
