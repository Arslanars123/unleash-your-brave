import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import 'package:unleash_your_brave/app/di/injection.dart';
import 'package:unleash_your_brave/features/agenda/domain/entities/session_entity.dart';
import 'package:unleash_your_brave/features/agenda/presentation/pages/agenda_page.dart';
import 'package:unleash_your_brave/features/agenda/presentation/pages/session_detail_page.dart';
import 'package:unleash_your_brave/features/announcements/presentation/pages/notifications_page.dart';
import 'package:unleash_your_brave/features/auth/presentation/bloc/auth_bloc.dart';
import 'package:unleash_your_brave/features/checkin/presentation/pages/checkin_qr_page.dart';
import 'package:unleash_your_brave/features/auth/presentation/pages/forgot_password_page.dart';
import 'package:unleash_your_brave/features/auth/presentation/pages/login_page.dart';
import 'package:unleash_your_brave/features/auth/presentation/pages/set_password_page.dart';
import 'package:unleash_your_brave/features/auth/presentation/pages/signup_page.dart';
import 'package:unleash_your_brave/features/auth/presentation/pages/verify_code_page.dart';
import 'package:unleash_your_brave/features/chat/presentation/cubit/chat_room_cubit.dart';
import 'package:unleash_your_brave/features/chat/presentation/cubit/chat_unread_cubit.dart';
import 'package:unleash_your_brave/features/chat/presentation/pages/chat_list_page.dart';
import 'package:unleash_your_brave/features/chat/presentation/pages/chat_room_page.dart';
import 'package:unleash_your_brave/features/home/presentation/pages/home_page.dart';
import 'package:unleash_your_brave/features/legal/presentation/pages/legal_document_page.dart';
import 'package:unleash_your_brave/features/map/presentation/pages/map_page.dart';
import 'package:unleash_your_brave/features/onboarding/presentation/pages/onboarding_page.dart';
import 'package:unleash_your_brave/features/shell/presentation/pages/edit_profile_page.dart';
import 'package:unleash_your_brave/features/shell/presentation/pages/main_shell.dart';
import 'package:unleash_your_brave/features/shell/presentation/pages/profile_page.dart';
import 'package:unleash_your_brave/features/splash/presentation/pages/splash_page.dart';

class AppRouter {
  const AppRouter._();

  static final GlobalKey<NavigatorState> rootNavigatorKey =
      GlobalKey<NavigatorState>(debugLabel: 'root');

  static final GoRouter router = GoRouter(
    navigatorKey: rootNavigatorKey,
    initialLocation: '/splash',
    refreshListenable: GoRouterRefreshStream(sl<AuthBloc>().stream),
    redirect: (context, state) {
      final authState = sl<AuthBloc>().state;
      final location = state.matchedLocation;
      final onSplash = location == '/splash';
      final onOnboarding = location == '/onboarding';
      final onAuthGate = location == '/login' ||
          location == '/signup' ||
          location == '/verify-code' ||
          location == '/forgot-password' ||
          onOnboarding;
      final onSetPassword = location == '/set-password';

      // Cold start / session restore only — never bounce form submits to splash.
      if (authState is AuthInitial || authState is AuthCheckingSession) {
        if (!onSplash) return '/splash';
        return null;
      }

      // Splash decides when to leave after its animation hold.
      if (onSplash) return null;

      // Form submit / transient error — keep the current route. AuthLoading is not
      // "logged out"; treating it that way flashes /login during set-password.
      if (authState is AuthLoading || authState is AuthFailureState) {
        return null;
      }

      final signedIn = authState is AuthAuthenticated;
      final mustChange = authState is AuthAuthenticated &&
          authState.user.mustChangePassword;

      if (!signedIn && !onAuthGate) return '/login';
      if (signedIn && mustChange && !onSetPassword) return '/set-password';
      if (signedIn && !mustChange && (onAuthGate || onSetPassword)) return '/';
      return null;
    },
    routes: [
      GoRoute(path: '/splash', builder: (context, state) => const SplashPage()),
      GoRoute(
        path: '/onboarding',
        builder: (context, state) => const OnboardingPage(),
      ),
      GoRoute(path: '/login', builder: (context, state) => const LoginPage()),
      GoRoute(path: '/signup', builder: (context, state) => const SignupPage()),
      GoRoute(
        path: '/verify-code',
        builder: (context, state) => const VerifyCodePage(),
      ),
      GoRoute(
        path: '/forgot-password',
        builder: (context, state) => const ForgotPasswordPage(),
      ),
      GoRoute(
        path: '/set-password',
        builder: (context, state) => const SetPasswordPage(),
      ),
      StatefulShellRoute.indexedStack(
        builder: (context, state, navigationShell) {
          return MainShell(navigationShell: navigationShell);
        },
        branches: [
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/',
                builder: (context, state) => const HomePage(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/agenda',
                builder: (context, state) => const AgendaPage(),
                routes: [
                  GoRoute(
                    path: 'sessions/:sessionId',
                    builder: (context, state) {
                      final sessionId =
                          state.pathParameters['sessionId'] ?? '';
                      final extra = state.extra;
                      return SessionDetailPage(
                        sessionId: sessionId,
                        initialSession:
                            extra is SessionEntity ? extra : null,
                      );
                    },
                  ),
                ],
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/network',
                builder: (context, state) => BlocProvider.value(
                  value: sl<ChatUnreadCubit>(),
                  child: const ChatListPage(),
                ),
                routes: [
                  GoRoute(
                    path: 'chat',
                    builder: (context, state) {
                      final authState = sl<AuthBloc>().state;
                      final currentUserId = authState is AuthAuthenticated
                          ? authState.user.id
                          : '';
                      return MultiBlocProvider(
                        providers: [
                          BlocProvider.value(value: sl<ChatUnreadCubit>()),
                          BlocProvider(
                            create: (_) =>
                                ChatRoomCubit(sl(), currentUserId)..loadInitial(),
                          ),
                        ],
                        child: const ChatRoomPage(),
                      );
                    },
                  ),
                ],
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/map',
                builder: (context, state) => const MapPage(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/profile',
                builder: (context, state) => const ProfilePage(),
                routes: [
                  GoRoute(
                    path: 'edit',
                    builder: (context, state) => const EditProfilePage(),
                  ),
                ],
              ),
            ],
          ),
        ],
      ),
      // Full-screen overlays above the tab shell — Back returns to the prior screen.
      GoRoute(
        parentNavigatorKey: rootNavigatorKey,
        path: '/check-in',
        builder: (context, state) => const CheckInQrPage(),
      ),
      GoRoute(
        parentNavigatorKey: rootNavigatorKey,
        path: '/notifications',
        builder: (context, state) {
          final highlightId = state.uri.queryParameters['id'];
          return NotificationsPage(highlightId: highlightId);
        },
      ),
      GoRoute(
        parentNavigatorKey: rootNavigatorKey,
        path: '/privacy-policy',
        builder: (context, state) => LegalDocumentPage.privacy(),
      ),
      GoRoute(
        parentNavigatorKey: rootNavigatorKey,
        path: '/terms',
        builder: (context, state) => LegalDocumentPage.terms(),
      ),
    ],
  );
}

class GoRouterRefreshStream extends ChangeNotifier {
  GoRouterRefreshStream(Stream<dynamic> stream) {
    _subscription = stream.asBroadcastStream().listen((_) => notifyListeners());
  }

  late final StreamSubscription<dynamic> _subscription;

  @override
  void dispose() {
    unawaited(_subscription.cancel());
    super.dispose();
  }
}
