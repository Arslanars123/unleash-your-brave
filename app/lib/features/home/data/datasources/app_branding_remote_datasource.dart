import 'package:dio/dio.dart';
import 'package:unleash_your_brave/core/constants/app_constants.dart';
import 'package:unleash_your_brave/core/network/dio_client.dart';
import 'package:unleash_your_brave/features/home/domain/entities/app_branding_entity.dart';

class AppBrandingRemoteDataSource {
  AppBrandingRemoteDataSource(this._dioClient);

  final DioClient _dioClient;

  Future<AppBrandingEntity> get() async {
    try {
      final response = await _dioClient.client.get(ApiConstants.appBranding);
      final data =
          (response.data as Map<String, dynamic>)['data'] as Map<String, dynamic>? ??
              const {};
      return AppBrandingEntity(
        homeCoverImage: data['homeCoverImage'] as String? ?? '',
      );
    } on DioException catch (error) {
      throwMappedDioError(error);
    }
  }
}
