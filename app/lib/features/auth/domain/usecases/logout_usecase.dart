import 'package:dartz/dartz.dart';
import 'package:unleash_your_brave/core/error/failures.dart';
import 'package:unleash_your_brave/core/usecase/usecase.dart';
import 'package:unleash_your_brave/features/auth/domain/repositories/auth_repository.dart';

class LogoutUseCase implements UseCase<void, NoParams> {
  LogoutUseCase(this._repository);

  final AuthRepository _repository;

  @override
  Future<Either<Failure, void>> call(NoParams params) {
    return _repository.logout();
  }
}
