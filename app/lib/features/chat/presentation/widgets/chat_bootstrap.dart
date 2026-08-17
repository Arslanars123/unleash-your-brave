import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:unleash_your_brave/app/di/injection.dart';
import 'package:unleash_your_brave/core/notifications/push_notification_service.dart';
import 'package:unleash_your_brave/features/auth/presentation/bloc/auth_bloc.dart';
import 'package:unleash_your_brave/features/chat/presentation/cubit/chat_unread_cubit.dart';

/// Bootstraps chat and push notification services based on auth state.
class ChatBootstrap extends StatefulWidget {
  const ChatBootstrap({super.key, required this.child});

  final Widget child;

  @override
  State<ChatBootstrap> createState() => _ChatBootstrapState();
}

class _ChatBootstrapState extends State<ChatBootstrap>
    with WidgetsBindingObserver {
  bool _chatStarted = false;
  bool _pushInitialized = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    // BlocListener only fires on *changes* — catch already-logged-in startup.
    WidgetsBinding.instance.addPostFrameCallback((_) => _syncFromAuth());
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed && _pushInitialized) {
      sl<PushNotificationService>().registerTokenWithBackend();
    }
  }

  @override
  Widget build(BuildContext context) {
    return BlocListener<AuthBloc, AuthState>(
      listener: (context, state) {
        if (state is AuthAuthenticated) {
          _startChatServices();
        } else if (state is AuthUnauthenticated || state is AuthInitial) {
          _stopChatServices();
        }
      },
      child: widget.child,
    );
  }

  void _syncFromAuth() {
    if (!mounted) return;
    final state = context.read<AuthBloc>().state;
    if (state is AuthAuthenticated) {
      _startChatServices();
    }
  }

  void _startChatServices() {
    if (!_chatStarted) {
      _chatStarted = true;
      sl<ChatUnreadCubit>().start();
    }

    if (!_pushInitialized) {
      _pushInitialized = true;
      sl<PushNotificationService>().initialize();
    } else {
      sl<PushNotificationService>().registerTokenWithBackend();
    }
  }

  void _stopChatServices() {
    if (_chatStarted) {
      _chatStarted = false;
      sl<ChatUnreadCubit>().stop();
    }

    if (_pushInitialized) {
      _pushInitialized = false;
      sl<PushNotificationService>().unregisterCurrentToken();
    }
  }
}
