import 'package:flutter_test/flutter_test.dart';
import 'package:unleash_your_brave/core/error/failures.dart';

void main() {
  test('ServerFailure carries its message', () {
    const failure = ServerFailure('boom');
    expect(failure.message, 'boom');
    expect(failure, equals(const ServerFailure('boom')));
  });
}
