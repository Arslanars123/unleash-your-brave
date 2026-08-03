import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import 'package:unleash_your_brave/app/di/injection.dart';
import 'package:unleash_your_brave/features/agenda/domain/entities/session_entity.dart';
import 'package:unleash_your_brave/features/agenda/presentation/pages/agenda_page.dart';
import 'package:unleash_your_brave/features/agenda/presentation/pages/session_detail_page.dart';
import 'package:unleash_your_brave/features/auth/presentation/bloc/auth_bloc.dart';
import 'package:unleash_your_brave/features/auth/presentation/pages/login_page.dart';
import 'package:unleash_your_brave/features/auth/presentation/pages/set_password_page.dart';
import 'package:unleash_your_brave/features/auth/presentation/pages/signup_page.dart';
import 'package:unleash_your_brave/features/auth/presentation/pages/verify_code_page.dart';
import 'package:unleash_your_brave/features/chat/presentation/cubit/chat_unread_cubit.dart';
import 'package:unleash_your_brave/features/chat/presentation/pages/chat_list_page.dart';
import 'package:unleash_your_brave/features/chat/presentation/pages/chat_room_page.dart';
import 'package:unleash_your_brave/features/home/presentation/pages/home_page.dart';
import 'package:unleash_your_brave/features/shell/presentation/pages/edit_profile_page.dart';
import 'package:unleash_your_brave/features/shell/presentation/pages/main_shell.dart';
import 'package:unleash_your_brave/features/shell/presentation/pages/placeholder_tab_page.dart';
import 'package:unleash_your_brave/features/shell/presentation/pages/profile_page.dart';

class AppRouter {
  const AppRouter._();

  static final GoRouter router = GoRouter(
    initialLocation: '/login',
    refreshListenable: GoRouterRefreshStream(sl<AuthBloc>().stream),
    redirect: (context, state) {
      final authState = sl<AuthBloc>().state;
      final location = state.matchedLocation;
      final onAuthGate = location == '/login' ||
          location == '/signup' ||
          location == '/verify-code';
      final onSetPassword = location == '/set-password';

      if (authState is AuthInitial || authState is AuthLoading) {
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
      GoRoute(path: '/login', builder: (context, state) => const LoginPage()),
      GoRoute(path: '/signup', builder: (context, state) => const SignupPage()),
      GoRoute(
        path: '/verify-code',
        builder: (context, state) => const VerifyCodePage(),
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
                    builder: (context, state) => BlocProvider.value(
                      value: sl<ChatUnreadCubit>(),
                      child: const ChatRoomPage(),
                    ),
                  ),
                ],
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/map',
                builder: (context, state) => const PlaceholderTabPage(
                  title: 'Map',
                  subtitle: 'Venue map and wayfinding coming next.',
                  icon: Icons.map_outlined,
                ),
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
