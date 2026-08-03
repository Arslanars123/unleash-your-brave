import 'package:dartz/dartz.dart';
import 'package:unleash_your_brave/core/error/failures.dart';
import 'package:unleash_your_brave/core/usecase/usecase.dart';
import 'package:unleash_your_brave/features/auth/domain/entities/user_entity.dart';
import 'package:unleash_your_brave/features/auth/domain/repositories/auth_repository.dart';

class ChangePasswordParams {
  const ChangePasswordParams({
    this.currentPassword,
    required this.newPassword,
  });

  final String? currentPassword;
  final String newPassword;
}

class ChangePasswordUseCase
    implements UseCase<UserEntity, ChangePasswordParams> {
  ChangePasswordUseCase(this._repository);

  final AuthRepository _repository;

  @override
  Future<Either<Failure, UserEntity>> call(ChangePasswordParams params) {
    return _repository.changePassword(
      currentPassword: params.currentPassword,
      newPassword: params.newPassword,
    );
  }
}
