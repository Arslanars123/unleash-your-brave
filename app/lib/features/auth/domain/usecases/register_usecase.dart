import 'package:dartz/dartz.dart';
import 'package:equatable/equatable.dart';
import 'package:unleash_your_brave/core/error/failures.dart';
import 'package:unleash_your_brave/core/usecase/usecase.dart';
import 'package:unleash_your_brave/features/auth/domain/entities/user_entity.dart';
import 'package:unleash_your_brave/features/auth/domain/repositories/auth_repository.dart';

class RegisterUseCase implements UseCase<UserEntity, RegisterParams> {
  RegisterUseCase(this._repository);

  final AuthRepository _repository;

  @override
  Future<Either<Failure, UserEntity>> call(RegisterParams params) {
    return _repository.register(
      email: params.email,
      name: params.name,
      password: params.password,
    );
  }
}

class RegisterParams extends Equatable {
  const RegisterParams({
    required this.email,
    required this.name,
    required this.password,
  });

  final String email;
  final String name;
  final String password;

  @override
  List<Object?> get props => [email, name, password];
}
