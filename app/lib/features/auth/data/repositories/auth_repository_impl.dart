import 'package:dartz/dartz.dart';
import 'package:unleash_your_brave/core/error/exceptions.dart';
import 'package:unleash_your_brave/core/error/failures.dart';
import 'package:unleash_your_brave/features/auth/data/datasources/auth_local_datasource.dart';
import 'package:unleash_your_brave/features/auth/data/datasources/auth_remote_datasource.dart';
import 'package:unleash_your_brave/features/auth/domain/entities/user_entity.dart';
import 'package:unleash_your_brave/features/auth/domain/repositories/auth_repository.dart';

class AuthRepositoryImpl implements AuthRepository {
  AuthRepositoryImpl({
    required AuthRemoteDataSource remote,
    required AuthLocalDataSource local,
  }) : _remote = remote,
       _local = local;

  final AuthRemoteDataSource _remote;
  final AuthLocalDataSource _local;

  @override
  Future<Either<Failure, UserEntity>> login({
    required String email,
    required String password,
  }) async {
    try {
      final result = await _remote.login(email: email, password: password);
      await _local.cacheSession(
        user: result.user,
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
      );
      return Right(result.user);
    } on ServerException catch (error) {
      return Left(AuthFailure(error.message));
    } on NetworkException catch (error) {
      return Left(NetworkFailure(error.message));
    } catch (_) {
      return const Left(UnexpectedFailure());
    }
  }

  @override
  Future<Either<Failure, UserEntity>> register({
    required String email,
    required String name,
    required String password,
  }) async {
    try {
      final result = await _remote.register(
        email: email,
        name: name,
        password: password,
      );
      await _local.cacheSession(
        user: result.user,
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
      );
      return Right(result.user);
    } on ServerException catch (error) {
      return Left(AuthFailure(error.message));
    } on NetworkException catch (error) {
      return Left(NetworkFailure(error.message));
    } catch (_) {
      return const Left(UnexpectedFailure());
    }
  }

  @override
  Future<Either<Failure, UserEntity>> getCurrentUser() async {
    try {
      if (!await _local.hasTokens()) {
        return const Left(AuthFailure('Not signed in'));
      }

      try {
        final user = await _remote.me();
        await _local.cacheUser(user);
        return Right(user);
      } on ServerException {
        final cached = await _local.readCachedUser();
        if (cached != null) return Right(cached);
        rethrow;
      }
    } on ServerException catch (error) {
      return Left(AuthFailure(error.message));
    } on NetworkException catch (error) {
      final cached = await _local.readCachedUser();
      if (cached != null) return Right(cached);
      return Left(NetworkFailure(error.message));
    } on CacheException catch (error) {
      return Left(CacheFailure(error.message));
    } catch (_) {
      return const Left(UnexpectedFailure());
    }
  }

  @override
  Future<Either<Failure, UserEntity>> changePassword({
    String? currentPassword,
    required String newPassword,
  }) async {
    try {
      final user = await _remote.changePassword(
        currentPassword: currentPassword,
        newPassword: newPassword,
      );
      await _local.cacheUser(user);
      return Right(user);
    } on ServerException catch (error) {
      return Left(AuthFailure(error.message));
    } on NetworkException catch (error) {
      return Left(NetworkFailure(error.message));
    } catch (_) {
      return const Left(UnexpectedFailure());
    }
  }

  @override
  Future<Either<Failure, String>> forgotPassword({required String email}) async {
    try {
      final message = await _remote.forgotPassword(email: email);
      return Right(message);
    } on ServerException catch (error) {
      return Left(AuthFailure(error.message));
    } on NetworkException catch (error) {
      return Left(NetworkFailure(error.message));
    } catch (_) {
      return const Left(UnexpectedFailure());
    }
  }

  @override
  Future<Either<Failure, String>> verifyResetOtp({
    required String email,
    required String otp,
  }) async {
    try {
      final token = await _remote.verifyResetOtp(email: email, otp: otp);
      return Right(token);
    } on ServerException catch (error) {
      return Left(AuthFailure(error.message));
    } on NetworkException catch (error) {
      return Left(NetworkFailure(error.message));
    } catch (_) {
      return const Left(UnexpectedFailure());
    }
  }

  @override
  Future<Either<Failure, void>> resetPassword({
    required String resetToken,
    required String newPassword,
  }) async {
    try {
      await _remote.resetPassword(
        resetToken: resetToken,
        newPassword: newPassword,
      );
      return const Right(null);
    } on ServerException catch (error) {
      return Left(AuthFailure(error.message));
    } on NetworkException catch (error) {
      return Left(NetworkFailure(error.message));
    } catch (_) {
      return const Left(UnexpectedFailure());
    }
  }

  @override
  Future<Either<Failure, UserEntity>> updateMyProfile(
    Map<String, dynamic> payload,
  ) async {
    try {
      final user = await _remote.updateMyProfile(payload);
      await _local.cacheUser(user);
      return Right(user);
    } on ServerException catch (error) {
      return Left(AuthFailure(error.message));
    } on NetworkException catch (error) {
      return Left(NetworkFailure(error.message));
    } catch (_) {
      return const Left(UnexpectedFailure());
    }
  }

  @override
  Future<Either<Failure, void>> logout() async {
    try {
      await _local.clear();
      return const Right(null);
    } catch (_) {
      return const Left(CacheFailure('Unable to clear session'));
    }
  }

  @override
  Future<bool> hasSession() => _local.hasTokens();
}
