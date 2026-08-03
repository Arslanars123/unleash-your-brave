import 'package:dartz/dartz.dart';
import 'package:unleash_your_brave/core/error/failures.dart';
import 'package:unleash_your_brave/core/usecase/usecase.dart';
import 'package:unleash_your_brave/features/auth/domain/entities/user_entity.dart';
import 'package:unleash_your_brave/features/auth/domain/repositories/auth_repository.dart';

class UpdateMyProfileParams {
  const UpdateMyProfileParams(this.payload);

  final Map<String, dynamic> payload;
}

class UpdateMyProfileUseCase
    implements UseCase<UserEntity, UpdateMyProfileParams> {
  UpdateMyProfileUseCase(this._repository);

  final AuthRepository _repository;

  @override
  Future<Either<Failure, UserEntity>> call(UpdateMyProfileParams params) {
    return _repository.updateMyProfile(params.payload);
  }
}
