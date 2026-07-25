class ServerException implements Exception {
  const ServerException(this.message, {this.statusCode});

  final String message;
  final int? statusCode;

  @override
  String toString() => 'ServerException($statusCode): $message';
}

class CacheException implements Exception {
  const CacheException([this.message = 'Cache miss']);

  final String message;
}

class NetworkException implements Exception {
  const NetworkException([this.message = 'Network unavailable']);

  final String message;
}
