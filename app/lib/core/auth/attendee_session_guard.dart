import 'package:unleash_your_brave/app/di/injection.dart';
import 'package:unleash_your_brave/core/auth/session_invalidation.dart';
import 'package:unleash_your_brave/features/auth/presentation/bloc/auth_bloc.dart';

/// Signs out attendee-only accounts that no longer have any event bookings.
void invalidateAttendeeSessionIfNoBookings(int bookingCount) {
  if (bookingCount > 0) return;

  final authState = sl<AuthBloc>().state;
  if (authState is AuthAuthenticated && authState.user.role == 'member') {
    SessionInvalidation.instance.notify();
  }
}
