import 'package:get_it/get_it.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:unleash_your_brave/core/network/dio_client.dart';
import 'package:unleash_your_brave/core/network/token_storage.dart';
import 'package:unleash_your_brave/features/auth/data/datasources/auth_local_datasource.dart';
import 'package:unleash_your_brave/features/auth/data/datasources/auth_remote_datasource.dart';
import 'package:unleash_your_brave/features/auth/data/repositories/auth_repository_impl.dart';
import 'package:unleash_your_brave/features/auth/domain/repositories/auth_repository.dart';
import 'package:unleash_your_brave/features/auth/domain/usecases/get_current_user_usecase.dart';
import 'package:unleash_your_brave/features/auth/domain/usecases/login_usecase.dart';
import 'package:unleash_your_brave/features/auth/domain/usecases/logout_usecase.dart';
import 'package:unleash_your_brave/features/auth/domain/usecases/register_usecase.dart';
import 'package:unleash_your_brave/features/auth/presentation/bloc/auth_bloc.dart';

final sl = GetIt.instance;

Future<void> configureDependencies() async {
  final prefs = await SharedPreferences.getInstance();

  // Core
  sl.registerLazySingleton(() => TokenStorage(prefs));
  sl.registerLazySingleton(() => DioClient(sl()));

  // Auth data
  sl.registerLazySingleton(() => AuthRemoteDataSource(sl()));
  sl.registerLazySingleton(() => AuthLocalDataSource(sl()));
  sl.registerLazySingleton<AuthRepository>(
    () => AuthRepositoryImpl(remote: sl(), local: sl()),
  );

  // Auth domain
  sl.registerLazySingleton(() => LoginUseCase(sl()));
  sl.registerLazySingleton(() => RegisterUseCase(sl()));
  sl.registerLazySingleton(() => GetCurrentUserUseCase(sl()));
  sl.registerLazySingleton(() => LogoutUseCase(sl()));

  // Auth presentation — singleton so GoRouter and the widget tree share state
  sl.registerLazySingleton(
    () => AuthBloc(
      loginUseCase: sl(),
      registerUseCase: sl(),
      getCurrentUserUseCase: sl(),
      logoutUseCase: sl(),
    ),
  );
}
