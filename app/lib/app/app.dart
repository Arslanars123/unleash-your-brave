import 'package:flutter/material.dart';
import 'package:unleash_your_brave/app/router/app_router.dart';
import 'package:unleash_your_brave/core/theme/app_theme.dart';

class UnleashYourBraveApp extends StatelessWidget {
  const UnleashYourBraveApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp.router(
      title: 'Unleash Your Brave',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.light,
      routerConfig: AppRouter.router,
    );
  }
}
