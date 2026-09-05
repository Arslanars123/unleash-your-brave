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

  Future<Either<Failure, UserEntity>> changePassword({
    String? currentPassword,
    required String newPassword,
  });

  Future<Either<Failure, String>> forgotPassword({required String email});

  Future<Either<Failure, String>> verifyResetOtp({
    required String email,
    required String otp,
  });

  Future<Either<Failure, void>> resetPassword({
    required String resetToken,
    required String newPassword,
  });

  Future<Either<Failure, UserEntity>> updateMyProfile(
    Map<String, dynamic> payload,
  );

  Future<Either<Failure, void>> deactivateMyAccount();

  Future<Either<Failure, void>> logout();

  Future<bool> hasSession();
}
