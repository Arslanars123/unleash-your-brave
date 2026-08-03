import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:unleash_your_brave/core/constants/app_constants.dart';
import 'package:unleash_your_brave/features/chat/data/models/chat_group_model.dart';
import 'package:unleash_your_brave/features/chat/data/models/chat_message_model.dart';

class ChatLocalDataSource {
  ChatLocalDataSource(this._prefs);

  final SharedPreferences _prefs;

  // Cache group info
  Future<void> cacheGroup(ChatGroupModel group) async {
    await _prefs.setString(StorageKeys.cachedChatGroup, group.encode());
  }

  ChatGroupModel? getCachedGroup() {
    final json = _prefs.getString(StorageKeys.cachedChatGroup);
    if (json == null) return null;
    try {
      return ChatGroupModel.decode(json);
    } catch (e) {
      return null;
    }
  }

  // Pending messages (offline queue)
  Future<void> addPendingMessage(ChatMessageModel message) async {
    final pending = getPendingMessages();
    pending.add(message);
    await _savePendingMessages(pending);
  }

  Future<void> removePendingMessage(String clientId) async {
    final pending = getPendingMessages();
    pending.removeWhere((msg) => msg.clientId == clientId);
    await _savePendingMessages(pending);
  }

  List<ChatMessageModel> getPendingMessages() {
    final json = _prefs.getString('pending_messages');
    if (json == null) return [];
    try {
      final list = jsonDecode(json) as List<dynamic>;
      return list
          .cast<Map<String, dynamic>>()
          .map((item) => ChatMessageModel.fromJson(item))
          .toList();
    } catch (e) {
      return [];
    }
  }

  Future<void> _savePendingMessages(List<ChatMessageModel> messages) async {
    final json = jsonEncode(messages.map((m) => m.toJson()).toList());
    await _prefs.setString('pending_messages', json);
  }

  Future<void> clearPendingMessages() async {
    await _prefs.remove('pending_messages');
  }

  // Unread count
  Future<void> setUnreadCount(int count) async {
    await _prefs.setInt(StorageKeys.chatUnreadCount, count);
  }

  int getUnreadCount() {
    return _prefs.getInt(StorageKeys.chatUnreadCount) ?? 0;
  }

  // Last sync time
  Future<void> setLastSync(DateTime sync) async {
    await _prefs.setString(StorageKeys.chatLastSync, sync.toIso8601String());
  }

  DateTime? getLastSync() {
    final syncStr = _prefs.getString(StorageKeys.chatLastSync);
    if (syncStr == null) return null;
    try {
      return DateTime.parse(syncStr);
    } catch (e) {
      return null;
    }
  }

  // FCM token
  Future<void> saveFCMToken(String token) async {
    await _prefs.setString(StorageKeys.fcmToken, token);
  }

  String? getFCMToken() {
    return _prefs.getString(StorageKeys.fcmToken);
  }
}