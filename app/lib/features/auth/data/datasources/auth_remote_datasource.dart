import 'package:dio/dio.dart';
import 'package:unleash_your_brave/core/constants/app_constants.dart';
import 'package:unleash_your_brave/core/network/dio_client.dart';
import 'package:unleash_your_brave/features/auth/data/models/user_model.dart';

class AuthRemoteDataSource {
  AuthRemoteDataSource(this._dioClient);

  final DioClient _dioClient;

  Future<({UserModel user, String accessToken, String refreshToken})> login({
    required String email,
    required String password,
  }) async {
    try {
      final response = await _dioClient.client.post(
        ApiConstants.login,
        data: {'email': email, 'password': password},
      );
      return _parseAuthResult(response.data as Map<String, dynamic>);
    } on DioException catch (error) {
      throwMappedDioError(error);
    }
  }

  Future<({UserModel user, String accessToken, String refreshToken})> register({
    required String email,
    required String name,
    required String password,
  }) async {
    try {
      final response = await _dioClient.client.post(
        ApiConstants.register,
        data: {'email': email, 'name': name, 'password': password},
      );
      return _parseAuthResult(response.data as Map<String, dynamic>);
    } on DioException catch (error) {
      throwMappedDioError(error);
    }
  }

  Future<UserModel> me() async {
    try {
      final response = await _dioClient.client.get(ApiConstants.me);
      final data = (response.data as Map<String, dynamic>)['data'] as Map<String, dynamic>;
      return UserModel.fromJson(data);
    } on DioException catch (error) {
      throwMappedDioError(error);
    }
  }

  Future<UserModel> changePassword({
    String? currentPassword,
    required String newPassword,
  }) async {
    try {
      final response = await _dioClient.client.post(
        ApiConstants.changePassword,
        data: {
          if (currentPassword != null && currentPassword.isNotEmpty)
            'currentPassword': currentPassword,
          'newPassword': newPassword,
        },
      );
      final data = (response.data as Map<String, dynamic>)['data'] as Map<String, dynamic>;
      return UserModel.fromJson(data);
    } on DioException catch (error) {
      throwMappedDioError(error);
    }
  }

  Future<UserModel> updateMyProfile(Map<String, dynamic> payload) async {
    try {
      final response = await _dioClient.client.patch(
        ApiConstants.updateMyProfile,
        data: payload,
      );
      final data =
          (response.data as Map<String, dynamic>)['data'] as Map<String, dynamic>;
      return UserModel.fromJson(data);
    } on DioException catch (error) {
      throwMappedDioError(error);
    }
  }

  ({UserModel user, String accessToken, String refreshToken}) _parseAuthResult(
    Map<String, dynamic> body,
  ) {
    final data = body['data'] as Map<String, dynamic>;
    final user = UserModel.fromJson(data['user'] as Map<String, dynamic>);
    final tokens = data['tokens'] as Map<String, dynamic>;
    return (
      user: user,
      accessToken: tokens['accessToken'] as String,
      refreshToken: tokens['refreshToken'] as String,
    );
  }
}
