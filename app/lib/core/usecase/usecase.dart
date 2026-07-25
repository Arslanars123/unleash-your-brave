import 'package:dartz/dartz.dart';
import 'package:equatable/equatable.dart';
import 'package:unleash_your_brave/core/error/failures.dart';

/// Contract every use case implements. Keeps the presentation layer thin.
abstract class UseCase<Output, Params> {
  Future<Either<Failure, Output>> call(Params params);
}

class NoParams extends Equatable {
  const NoParams();

  @override
  List<Object?> get props => [];
}
