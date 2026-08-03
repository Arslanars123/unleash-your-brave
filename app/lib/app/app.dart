import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:unleash_your_brave/app/di/injection.dart';
import 'package:unleash_your_brave/app/router/app_router.dart';
import 'package:unleash_your_brave/core/theme/app_theme.dart';
import 'package:unleash_your_brave/core/utils/app_toast.dart';
import 'package:unleash_your_brave/features/chat/presentation/cubit/chat_unread_cubit.dart';
import 'package:unleash_your_brave/features/chat/presentation/widgets/chat_bootstrap.dart';

class UnleashYourBraveApp extends StatelessWidget {
  const UnleashYourBraveApp({super.key});

  @override
  Widget build(BuildContext context) {
    return ChatBootstrap(
      child: BlocProvider.value(
        value: sl<ChatUnreadCubit>(),
        child: MaterialApp.router(
          title: 'Unleash Your Brave',
          debugShowCheckedModeBanner: false,
          scaffoldMessengerKey: AppToast.messengerKey,
          theme: AppTheme.dark,
          darkTheme: AppTheme.dark,
          themeMode: ThemeMode.dark,
          routerConfig: AppRouter.router,
          builder: (context, child) {
            final mediaQuery = MediaQuery.of(context);
            return MediaQuery(
              data: mediaQuery.copyWith(
                textScaler: mediaQuery.textScaler.clamp(
                  minScaleFactor: 0.85,
                  maxScaleFactor: 1.3,
                ),
              ),
              child: child ?? const SizedBox.shrink(),
            );
          },
        ),
      ),
    );
  }
}
