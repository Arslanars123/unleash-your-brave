import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:unleash_your_brave/core/constants/app_constants.dart';
import 'package:unleash_your_brave/core/error/exceptions.dart';
import 'package:unleash_your_brave/features/checkin/data/datasources/checkin_remote_datasource.dart';
import 'package:unleash_your_brave/features/home/data/datasources/events_remote_datasource.dart';
import 'package:unleash_your_brave/features/home/domain/entities/event_entity.dart';

class SelectedEventState extends Equatable {
  const SelectedEventState({
    this.eventId,
    this.event,
    this.loading = false,
    this.ready = false,
    this.error,
  });

  final String? eventId;
  final EventEntity? event;
  final bool loading;
  final bool ready;
  final String? error;

  SelectedEventState copyWith({
    String? eventId,
    EventEntity? event,
    bool? loading,
    bool? ready,
    String? error,
    bool clearError = false,
    bool clearEvent = false,
  }) {
    return SelectedEventState(
      eventId: clearEvent ? null : (eventId ?? this.eventId),
      event: clearEvent ? null : (event ?? this.event),
      loading: loading ?? this.loading,
      ready: ready ?? this.ready,
      error: clearError ? null : (error ?? this.error),
    );
  }

  @override
  List<Object?> get props => [eventId, event, loading, ready, error];
}

/// Persists and resolves the event that scopes home / agenda / store / sponsors.
class SelectedEventCubit extends Cubit<SelectedEventState> {
  SelectedEventCubit({
    required EventsRemoteDataSource events,
    required CheckInRemoteDataSource checkIns,
    required SharedPreferences prefs,
  })  : _events = events,
        _checkIns = checkIns,
        _prefs = prefs,
        super(const SelectedEventState());

  final EventsRemoteDataSource _events;
  final CheckInRemoteDataSource _checkIns;
  final SharedPreferences _prefs;

  bool _resolving = false;

  String? get selectedEventId => state.eventId;

  Future<void> ensureReady({bool force = false}) async {
    if (_resolving) return;
    if (!force && state.ready && state.event != null) return;

    _resolving = true;
    emit(state.copyWith(loading: true, clearError: true));

    try {
      // Home / Map / default Agenda always use the platform preferred (current) edition.
      // Do not restore a past edition from prefs — that was switching home countdown/map.
      EventEntity? resolved = await _resolveDefault();

      if (resolved == null) {
        final storedId = _prefs.getString(StorageKeys.selectedEventId)?.trim();
        if (storedId != null && storedId.isNotEmpty) {
          try {
            resolved = await _events.getById(storedId);
          } catch (_) {
            resolved = null;
          }
        }
      }

      if (resolved != null) {
        await _prefs.setString(StorageKeys.selectedEventId, resolved.id);
        emit(
          SelectedEventState(
            eventId: resolved.id,
            event: resolved,
            loading: false,
            ready: true,
          ),
        );
      } else {
        emit(
          const SelectedEventState(
            loading: false,
            ready: true,
            error: 'No event available',
          ),
        );
      }
    } on NetworkException catch (error) {
      emit(
        state.copyWith(
          loading: false,
          ready: true,
          error: error.message,
        ),
      );
    } on ServerException catch (error) {
      emit(
        state.copyWith(
          loading: false,
          ready: true,
          error: error.message,
        ),
      );
    } catch (_) {
      emit(
        state.copyWith(
          loading: false,
          ready: true,
          error: 'Unable to load event',
        ),
      );
    } finally {
      _resolving = false;
    }
  }

  /// Force Home / Map back onto the preferred current edition.
  Future<void> restoreCurrentEvent() async {
    _resolving = false;
    await ensureReady(force: true);
  }

  Future<void> selectEvent(String eventId) async {
    final id = eventId.trim();
    if (id.isEmpty) return;
    if (state.eventId == id && state.event != null) return;

    emit(state.copyWith(loading: true, clearError: true));
    try {
      final event = await _events.getById(id);
      await _prefs.setString(StorageKeys.selectedEventId, event.id);
      emit(
        SelectedEventState(
          eventId: event.id,
          event: event,
          loading: false,
          ready: true,
        ),
      );
    } on NetworkException catch (error) {
      emit(state.copyWith(loading: false, error: error.message));
    } on ServerException catch (error) {
      emit(state.copyWith(loading: false, error: error.message));
    } catch (_) {
      emit(state.copyWith(loading: false, error: 'Unable to switch event'));
    }
  }

  Future<void> selectEventEntity(EventEntity event) async {
    await _prefs.setString(StorageKeys.selectedEventId, event.id);
    emit(
      SelectedEventState(
        eventId: event.id,
        event: event,
        loading: false,
        ready: true,
      ),
    );
  }

  Future<void> clear() async {
    await _prefs.remove(StorageKeys.selectedEventId);
    emit(const SelectedEventState(ready: true));
  }

  Future<EventEntity?> _resolveDefault() async {
    try {
      return await _events.getCurrent();
    } catch (_) {
      // Fall through to bookings.
    }

    try {
      final bookings = await _checkIns.getMyBookings();
      if (bookings.isEmpty) return null;

      final entitled = bookings.where((b) => b.entitled).toList();
      final pool = entitled.isNotEmpty ? entitled : bookings;

      for (final booking in pool) {
        if (booking.event.isLive) return booking.event;
      }
      for (final booking in pool) {
        if (booking.event.isUpcoming) return booking.event;
      }
      return pool.first.event;
    } catch (_) {
      return null;
    }
  }
}
