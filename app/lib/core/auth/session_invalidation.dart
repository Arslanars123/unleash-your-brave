import 'dart:async';

/// Signals that the signed-in account no longer exists or the session is invalid.
class SessionInvalidation {
  SessionInvalidation._();

  static final SessionInvalidation instance = SessionInvalidation._();

  final StreamController<void> _controller = StreamController<void>.broadcast();

  Stream<void> get stream => _controller.stream;

  void notify() {
    if (_controller.isClosed) return;
    _controller.add(null);
  }
}
