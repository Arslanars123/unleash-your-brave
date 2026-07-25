import 'package:dartz/dartz.dart';
import 'package:unleash_your_brave/core/error/failures.dart';
import 'package:unleash_your_brave/core/usecase/usecase.dart';
import 'package:unleash_your_brave/features/auth/domain/entities/user_entity.dart';
import 'package:unleash_your_brave/features/auth/domain/repositories/auth_repository.dart';

class GetCurrentUserUseCase implements UseCase<UserEntity, NoParams> {
  GetCurrentUserUseCase(this._repository);

  final AuthRepository _repository;

  @override
  Future<Either<Failure, UserEntity>> call(NoParams params) {
    return _repository.getCurrentUser();
  }
}
