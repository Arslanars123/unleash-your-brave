import 'dart:async';
import 'dart:io';
import 'dart:ui' show Color;

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:unleash_your_brave/app/router/app_router.dart';
import 'package:unleash_your_brave/core/constants/app_constants.dart';
import 'package:unleash_your_brave/features/chat/domain/repositories/chat_repository.dart';
import 'package:unleash_your_brave/features/checkin/presentation/check_in_status_refresh.dart';
import 'package:unleash_your_brave/firebase_options.dart';

/// Handles FCM + local notifications for chat and announcements.
///
/// Android: FCM registration + notification channels.
/// iOS: APNs → FCM (requires Push capability + APNs key in Firebase).
@pragma('vm:entry-point')
Future<void> firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  await Firebase.initializeApp(options: DefaultFirebaseOptions.currentPlatform);
}

class PushNotificationService {
  PushNotificationService(this._chatRepository, this._prefs);

  final ChatRepository _chatRepository;
  final SharedPreferences _prefs;
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
  StreamSubscription<RemoteMessage>? _onMessageSub;
  StreamSubscription<RemoteMessage>? _onOpenedSub;
  Timer? _apnsRetryTimer;
  bool _initialized = false;

  /// User preference — defaults to on.
  bool get isEnabled =>
      _prefs.getBool(StorageKeys.pushNotificationsEnabled) ?? true;

  Future<void> initialize() async {
    if (_initialized) {
      if (isEnabled) {
        await registerTokenWithBackend();
      }
      return;
    }
    _initialized = true;

    FirebaseMessaging.onBackgroundMessage(firebaseMessagingBackgroundHandler);

    const androidInit = AndroidInitializationSettings('@drawable/ic_stat_uyb');
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

    final iosPlugin = _local
        .resolvePlatformSpecificImplementation<
            IOSFlutterLocalNotificationsPlugin>();
    await iosPlugin?.requestPermissions(alert: true, badge: true, sound: true);

    await _messaging.setForegroundNotificationPresentationOptions(
      alert: true,
      badge: true,
      sound: true,
    );

    _onMessageSub = FirebaseMessaging.onMessage.listen(_showForegroundNotification);
    _onOpenedSub = FirebaseMessaging.onMessageOpenedApp.listen(_handleMessageOpen);

    final initial = await _messaging.getInitialMessage();
    if (initial != null) {
      _handleMessageOpen(initial);
    }

    _tokenRefreshSub = _messaging.onTokenRefresh.listen((token) async {
      if (!isEnabled) return;
      try {
        await _chatRepository.registerDevice(
          token: token,
          platform: Platform.isIOS ? 'ios' : 'android',
        );
      } catch (error) {
        debugPrint('Failed to refresh FCM token registration: $error');
      }
    });

    if (isEnabled) {
      await _requestPermissionAndRegister();
    }
  }

  /// Persists the preference and registers/unregisters the device token.
  Future<bool> setEnabled(bool enabled) async {
    await _prefs.setBool(StorageKeys.pushNotificationsEnabled, enabled);

    if (enabled) {
      if (!_initialized) {
        await initialize();
      } else {
        final allowed = await _requestPermissionAndRegister();
        if (!allowed) {
          await _prefs.setBool(StorageKeys.pushNotificationsEnabled, false);
          return false;
        }
      }
      return isEnabled;
    }

    await unregisterCurrentToken(deleteToken: false);
    return false;
  }

  Future<bool> _requestPermissionAndRegister() async {
    final settings = await _messaging.requestPermission(
      alert: true,
      badge: true,
      sound: true,
      provisional: false,
      announcement: false,
      carPlay: false,
      criticalAlert: false,
    );

    if (settings.authorizationStatus == AuthorizationStatus.denied) {
      debugPrint('Push permission denied');
      return false;
    }

    await registerTokenWithBackend();
    return true;
  }

  Future<void> registerTokenWithBackend() async {
    if (!isEnabled) return;

    try {
      if (Platform.isIOS) {
        final apns = await _waitForApnsToken();
        if (apns == null || apns.isEmpty) {
          debugPrint(
            'Skipping FCM registration: APNs token not available yet. '
            'Confirm Push capability, matching Firebase iOS app bundle ID '
            '(com.unleashyourbrave.unleashapp), and APNs .p8 in Firebase.',
          );
          _scheduleApnsRetry();
          return;
        }
      }

      final token = await _messaging.getToken();
      if (token == null || token.isEmpty) {
        debugPrint('FCM token unavailable');
        _scheduleApnsRetry();
        return;
      }
      await _chatRepository.registerDevice(
        token: token,
        platform: Platform.isIOS ? 'ios' : 'android',
      );
      _apnsRetryTimer?.cancel();
      _apnsRetryTimer = null;
      debugPrint(
        'Registered FCM token for ${Platform.isIOS ? 'iOS' : 'Android'} '
        '(${token.substring(0, token.length.clamp(0, 12))}…)',
      );
    } on FirebaseException catch (error) {
      if (error.code == 'apns-token-not-set') {
        debugPrint(
          'Skipping FCM registration: APNs not ready '
          '(${error.message ?? error.code}).',
        );
        _scheduleApnsRetry();
        return;
      }
      debugPrint('Failed to register FCM token: ${error.message}');
    } catch (error) {
      debugPrint('Failed to register FCM token: $error');
    }
  }

  void _scheduleApnsRetry() {
    if (!Platform.isIOS || !isEnabled) return;
    _apnsRetryTimer?.cancel();
    _apnsRetryTimer = Timer(const Duration(seconds: 8), () {
      registerTokenWithBackend();
    });
  }

  /// APNs token often arrives after permission + remote registration.
  Future<String?> _waitForApnsToken({
    int attempts = 20,
    Duration delay = const Duration(milliseconds: 750),
  }) async {
    for (var i = 0; i < attempts; i++) {
      final token = await _messaging.getAPNSToken();
      if (token != null && token.isNotEmpty) return token;
      await Future<void>.delayed(delay);
    }
    return _messaging.getAPNSToken();
  }

  Future<void> unregisterCurrentToken({bool deleteToken = true}) async {
    try {
      if (Platform.isIOS) {
        final apns = await _messaging.getAPNSToken();
        if (apns == null || apns.isEmpty) return;
      }
      final token = _chatRepository.getFCMToken() ?? await _messaging.getToken();
      if (token == null) return;
      await _chatRepository.unregisterDevice(token);
      if (deleteToken) {
        await _messaging.deleteToken();
      }
    } catch (_) {}
  }

  Future<void> _showForegroundNotification(RemoteMessage message) async {
    if (!isEnabled) return;

    _handleCheckInRefresh(message.data);

    final notification = message.notification;
    final type = message.data['type'] as String?;
    final isAnnouncement = type == 'announcement';
    final isCheckIn = type == 'checkin.completed' || type == 'checkin.form_required';
    final title = notification?.title ??
        (message.data['title'] as String?) ??
        (isCheckIn
            ? 'Check-in update'
            : isAnnouncement
                ? 'Announcement'
                : 'New message');
    final body = notification?.body ??
        (message.data['body'] as String?) ??
        (isCheckIn
            ? 'Your check-in status was updated'
            : isAnnouncement
                ? 'Open notifications'
                : 'Open the group chat');

    final channel = isAnnouncement || isCheckIn
        ? _announcementsChannel
        : _androidChannel;

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
          icon: '@drawable/ic_stat_uyb',
          color: const Color(0xFFE91E63),
          largeIcon: const DrawableResourceAndroidBitmap(
            '@drawable/ic_notification_brand',
          ),
          tag: isAnnouncement
              ? (message.data['announcementId'] as String? ?? 'announcement')
              : isCheckIn
                  ? (message.data['eventId'] as String? ?? 'checkin')
                  : (message.data['groupId'] as String? ?? 'chat'),
        ),
        iOS: DarwinNotificationDetails(
          presentAlert: true,
          presentBadge: true,
          presentSound: true,
          threadIdentifier: isAnnouncement || isCheckIn ? 'announcements' : 'chat',
        ),
      ),
      payload: jsonEncodePayload(message.data),
    );
  }

  void _onLocalNotificationTap(NotificationResponse response) {
    _navigateFromPayload(response.payload);
  }

  void _handleMessageOpen(RemoteMessage message) {
    _handleCheckInRefresh(message.data);
    _navigateFromData(message.data);
  }

  void _handleCheckInRefresh(Map<String, dynamic> data) {
    final type = data['type'];
    if (type == 'checkin.completed' || type == 'checkin.form_required') {
      CheckInStatusRefresh.instance.notify(
        eventId: data['eventId'] as String?,
      );
    }
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
    if (type == 'checkin.completed' || type == 'checkin.form_required') {
      final eventId = data['eventId'];
      final path = (eventId != null && eventId.toString().isNotEmpty)
          ? '/check-in?eventId=$eventId'
          : '/check-in';
      AppRouter.router.push(path);
      return;
    }
    if (type == 'announcement') {
      final id = data['announcementId'];
      final path = (id != null && id.toString().isNotEmpty)
          ? '/notifications?id=$id'
          : '/notifications';
      AppRouter.router.push(path);
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
    _apnsRetryTimer?.cancel();
    await _tokenRefreshSub?.cancel();
    await _onMessageSub?.cancel();
    await _onOpenedSub?.cancel();
  }
}
