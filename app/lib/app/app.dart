import 'package:flutter/material.dart';
import 'package:unleash_your_brave/app/router/app_router.dart';
import 'package:unleash_your_brave/core/theme/app_theme.dart';
import 'package:unleash_your_brave/core/utils/app_toast.dart';

class UnleashYourBraveApp extends StatelessWidget {
  const UnleashYourBraveApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp.router(
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
          // Honour the user's font-size preference without letting extreme
          // values break the layout.
          data: mediaQuery.copyWith(
            textScaler: mediaQuery.textScaler.clamp(
              minScaleFactor: 0.85,
              maxScaleFactor: 1.3,
            ),
          ),
          child: child ?? const SizedBox.shrink(),
        );
      },
    );
  }
}
