import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';
import 'package:unleash_your_brave/core/constants/app_constants.dart';
import 'package:unleash_your_brave/features/agenda/data/models/session_model.dart';
import 'package:unleash_your_brave/features/home/data/models/event_model.dart';

/// Persists the last successful agenda payload so the screen stays usable offline.
class AgendaLocalDataSource {
  AgendaLocalDataSource(this._prefs);

  final SharedPreferences _prefs;

  Future<void> cacheEvent(EventModel event) async {
    final previous = await readCachedEvent();
    if (previous != null && previous.id != event.id) {
      await _clearSessionsForEvent(previous.id);
    }
    await _prefs.setString(
      StorageKeys.cachedAgendaEvent,
      jsonEncode(event.toJson()),
    );
  }

  Future<EventModel?> readCachedEvent() async {
    final raw = _prefs.getString(StorageKeys.cachedAgendaEvent);
    if (raw == null || raw.isEmpty) return null;
    try {
      return EventModel.fromJson(jsonDecode(raw) as Map<String, dynamic>);
    } catch (_) {
      return null;
    }
  }

  Future<void> cacheDaySessions({
    required String eventId,
    required int dayNumber,
    required List<SessionModel> sessions,
  }) async {
    final key = _sessionsKey(eventId, dayNumber);
    final encoded = jsonEncode(
      sessions.map((session) => session.toJson()).toList(growable: false),
    );
    await _prefs.setString(key, encoded);

    final index = _readDayIndex(eventId)..add(dayNumber);
    await _prefs.setStringList(_dayIndexKey(eventId), index.map((d) => '$d').toList());
  }

  Future<List<SessionModel>?> readDaySessions({
    required String eventId,
    required int dayNumber,
  }) async {
    final raw = _prefs.getString(_sessionsKey(eventId, dayNumber));
    if (raw == null) return null;
    try {
      final list = jsonDecode(raw) as List<dynamic>;
      return list
          .whereType<Map<String, dynamic>>()
          .map(SessionModel.fromJson)
          .toList(growable: false);
    } catch (_) {
      return null;
    }
  }

  Future<Map<int, List<SessionModel>>> readAllCachedSessions(String eventId) async {
    final result = <int, List<SessionModel>>{};
    for (final day in _readDayIndex(eventId)) {
      final sessions = await readDaySessions(eventId: eventId, dayNumber: day);
      if (sessions != null) {
        result[day] = sessions;
      }
    }
    return result;
  }

  Future<void> _clearSessionsForEvent(String eventId) async {
    for (final day in _readDayIndex(eventId)) {
      await _prefs.remove(_sessionsKey(eventId, day));
    }
    await _prefs.remove(_dayIndexKey(eventId));
  }

  Set<int> _readDayIndex(String eventId) {
    final raw = _prefs.getStringList(_dayIndexKey(eventId)) ?? const [];
    return raw.map(int.tryParse).whereType<int>().toSet();
  }

  String _sessionsKey(String eventId, int dayNumber) =>
      '${StorageKeys.cachedAgendaSessionsPrefix}${eventId}_$dayNumber';

  String _dayIndexKey(String eventId) =>
      '${StorageKeys.cachedAgendaDayIndexPrefix}$eventId';
}
