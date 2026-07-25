import 'package:dartz/dartz.dart';
import 'package:unleash_your_brave/core/error/failures.dart';
import 'package:unleash_your_brave/features/auth/domain/entities/user_entity.dart';

abstract class AuthRepository {
  Future<Either<Failure, UserEntity>> login({
    required String email,
    required String password,
  });

  Future<Either<Failure, UserEntity>> register({
    required String email,
    required String name,
    required String password,
  });

  Future<Either<Failure, UserEntity>> getCurrentUser();

  Future<Either<Failure, void>> logout();

  Future<bool> hasSession();
}
