import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'package:unleash_your_brave/app/app.dart';
import 'package:unleash_your_brave/app/di/injection.dart';
import 'package:unleash_your_brave/features/auth/presentation/bloc/auth_bloc.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await dotenv.load(fileName: '.env');
  await configureDependencies();

  runApp(
    BlocProvider(
      create: (_) => sl<AuthBloc>()..add(const AuthStarted()),
      child: const UnleashYourBraveApp(),
    ),
  );
}
