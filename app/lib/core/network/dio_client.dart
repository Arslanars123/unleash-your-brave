import 'package:dio/dio.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'package:unleash_your_brave/core/constants/app_constants.dart';
import 'package:unleash_your_brave/core/error/exceptions.dart';
import 'package:unleash_your_brave/core/network/token_storage.dart';

class DioClient {
  DioClient(this._tokenStorage) {
    _dio = Dio(
      BaseOptions(
        baseUrl: dotenv.env['API_BASE_URL'] ?? 'http://localhost:4000/api/v1',
        connectTimeout: const Duration(seconds: 15),
        receiveTimeout: const Duration(seconds: 15),
        headers: {'Content-Type': 'application/json', 'Accept': 'application/json'},
      ),
    );

    _dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) async {
          final token = await _tokenStorage.readAccessToken();
          if (token != null && token.isNotEmpty) {
            options.headers['Authorization'] = 'Bearer $token';
          }
          handler.next(options);
        },
        onError: (error, handler) async {
          if (error.response?.statusCode == 401 &&
              error.requestOptions.extra['retried'] != true) {
            final refreshed = await _tryRefresh();
            if (refreshed) {
              final request = error.requestOptions;
              request.extra['retried'] = true;
              final token = await _tokenStorage.readAccessToken();
              request.headers['Authorization'] = 'Bearer $token';
              try {
                final response = await _dio.fetch(request);
                handler.resolve(response);
                return;
              } catch (_) {
                // Fall through to original error handling.
              }
            }
          }
          handler.next(error);
        },
      ),
    );
  }

  late final Dio _dio;
  final TokenStorage _tokenStorage;

  Dio get client => _dio;

  Future<bool> _tryRefresh() async {
    final refresh = await _tokenStorage.readRefreshToken();
    if (refresh == null || refresh.isEmpty) return false;

    try {
      final response = await Dio(
        BaseOptions(baseUrl: _dio.options.baseUrl),
      ).post(ApiConstants.refresh, data: {'refreshToken': refresh});

      final data = (response.data as Map<String, dynamic>)['data'] as Map<String, dynamic>;
      await _tokenStorage.saveTokens(
        accessToken: data['accessToken'] as String,
        refreshToken: data['refreshToken'] as String,
      );
      return true;
    } catch (_) {
      await _tokenStorage.clear();
      return false;
    }
  }
}

/// Maps Dio errors into domain-friendly exceptions.
Never throwMappedDioError(DioException error) {
  if (_isNetworkFailure(error)) {
    throw const NetworkException();
  }

  final status = error.response?.statusCode;
  final payload = error.response?.data;

  String message = 'Request failed';
  if (payload is Map<String, dynamic>) {
    final err = payload['error'];
    if (err is Map<String, dynamic> && err['message'] is String) {
      message = err['message'] as String;
    }
  }

  throw ServerException(message, statusCode: status);
}

bool _isNetworkFailure(DioException error) {
  switch (error.type) {
    case DioExceptionType.connectionError:
    case DioExceptionType.connectionTimeout:
    case DioExceptionType.receiveTimeout:
    case DioExceptionType.sendTimeout:
      return true;
    case DioExceptionType.unknown:
      final detail = error.error?.toString().toLowerCase() ?? '';
      return detail.contains('socket') ||
          detail.contains('network') ||
          detail.contains('connection') ||
          detail.contains('failed host lookup');
    case DioExceptionType.badResponse:
    case DioExceptionType.cancel:
    case DioExceptionType.badCertificate:
    case DioExceptionType.transformTimeout:
      return false;
  }
}
