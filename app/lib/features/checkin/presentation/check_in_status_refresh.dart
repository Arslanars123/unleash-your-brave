import 'dart:async';

/// Broadcasts when the attendee check-in screen should refresh (push or admin action).
class CheckInStatusRefresh {
  CheckInStatusRefresh._();

  static final CheckInStatusRefresh instance = CheckInStatusRefresh._();

  final StreamController<String?> _controller =
      StreamController<String?>.broadcast();

  Stream<String?> get stream => _controller.stream;

  void notify({String? eventId}) {
    if (_controller.isClosed) return;
    _controller.add(eventId);
  }
}
