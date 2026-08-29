import 'dart:async';

/// Broadcasts when attendee access changes (added/removed from an event).
///
/// [eventId] is null when all event access may have changed.
class AttendeeAccessRefresh {
  AttendeeAccessRefresh._();

  static final AttendeeAccessRefresh instance = AttendeeAccessRefresh._();

  final StreamController<String?> _controller =
      StreamController<String?>.broadcast();

  Stream<String?> get stream => _controller.stream;

  void notify({String? eventId}) {
    if (_controller.isClosed) return;
    _controller.add(eventId);
  }
}
