import 'package:get_it/get_it.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:unleash_your_brave/core/network/dio_client.dart';
import 'package:unleash_your_brave/core/network/token_storage.dart';
import 'package:unleash_your_brave/core/notifications/push_notification_service.dart';
import 'package:unleash_your_brave/features/auth/data/datasources/auth_local_datasource.dart';
import 'package:unleash_your_brave/features/auth/data/datasources/auth_remote_datasource.dart';
import 'package:unleash_your_brave/features/auth/data/datasources/uploads_remote_datasource.dart';
import 'package:unleash_your_brave/features/auth/data/repositories/auth_repository_impl.dart';
import 'package:unleash_your_brave/features/auth/domain/repositories/auth_repository.dart';
import 'package:unleash_your_brave/features/auth/domain/usecases/change_password_usecase.dart';
import 'package:unleash_your_brave/features/auth/domain/usecases/get_current_user_usecase.dart';
import 'package:unleash_your_brave/features/auth/domain/usecases/login_usecase.dart';
import 'package:unleash_your_brave/features/auth/domain/usecases/logout_usecase.dart';
import 'package:unleash_your_brave/features/auth/domain/usecases/register_usecase.dart';
import 'package:unleash_your_brave/features/auth/domain/usecases/update_my_profile_usecase.dart';
import 'package:unleash_your_brave/features/auth/presentation/bloc/auth_bloc.dart';
import 'package:unleash_your_brave/features/agenda/data/datasources/agenda_local_datasource.dart';
import 'package:unleash_your_brave/features/agenda/data/datasources/sessions_remote_datasource.dart';
import 'package:unleash_your_brave/features/chat/data/datasources/chat_local_datasource.dart';
import 'package:unleash_your_brave/features/chat/data/datasources/chat_remote_datasource.dart';
import 'package:unleash_your_brave/features/chat/data/repositories/chat_repository_impl.dart';
import 'package:unleash_your_brave/features/chat/domain/repositories/chat_repository.dart';
import 'package:unleash_your_brave/features/chat/presentation/cubit/chat_unread_cubit.dart';
import 'package:unleash_your_brave/features/home/data/datasources/events_remote_datasource.dart';

final sl = GetIt.instance;

Future<void> configureDependencies() async {
  final prefs = await SharedPreferences.getInstance();

  // Core
  sl.registerLazySingleton(() => TokenStorage(prefs));
  sl.registerLazySingleton(() => DioClient(sl()));

  // Auth data
  sl.registerLazySingleton(() => AuthRemoteDataSource(sl()));
  sl.registerLazySingleton(() => AuthLocalDataSource(sl()));
  sl.registerLazySingleton(() => UploadsRemoteDataSource(sl()));
  sl.registerLazySingleton<AuthRepository>(
    () => AuthRepositoryImpl(remote: sl(), local: sl()),
  );

  // Auth domain
  sl.registerLazySingleton(() => LoginUseCase(sl()));
  sl.registerLazySingleton(() => RegisterUseCase(sl()));
  sl.registerLazySingleton(() => GetCurrentUserUseCase(sl()));
  sl.registerLazySingleton(() => LogoutUseCase(sl()));
  sl.registerLazySingleton(() => ChangePasswordUseCase(sl()));
  sl.registerLazySingleton(() => UpdateMyProfileUseCase(sl()));

  // Chat data
  sl.registerLazySingleton(() => ChatRemoteDataSource(sl(), sl()));
  sl.registerLazySingleton(() => ChatLocalDataSource(prefs));
  sl.registerLazySingleton<ChatRepository>(
    () => ChatRepositoryImpl(remote: sl(), local: sl()),
  );

  // Chat presentation
  sl.registerLazySingleton(() => ChatUnreadCubit(sl()));

  // Push notifications
  sl.registerLazySingleton(() => PushNotificationService(sl()));

  // Home / events / agenda
  sl.registerLazySingleton(() => EventsRemoteDataSource(sl()));
  sl.registerLazySingleton(() => SessionsRemoteDataSource(sl()));
  sl.registerLazySingleton(() => AgendaLocalDataSource(prefs));

  // Auth presentation — singleton so GoRouter and the widget tree share state
  sl.registerLazySingleton(
    () => AuthBloc(
      loginUseCase: sl(),
      registerUseCase: sl(),
      getCurrentUserUseCase: sl(),
      logoutUseCase: sl(),
      changePasswordUseCase: sl(),
    ),
  );
}
