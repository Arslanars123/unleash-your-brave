import 'dart:io';

import 'package:dio/dio.dart';
import 'package:unleash_your_brave/core/constants/app_constants.dart';
import 'package:unleash_your_brave/core/network/dio_client.dart';

class UploadsRemoteDataSource {
  UploadsRemoteDataSource(this._dioClient);

  final DioClient _dioClient;

  Future<String> uploadImage(File file) async {
    try {
      final formData = FormData.fromMap({
        'file': await MultipartFile.fromFile(
          file.path,
          filename: file.uri.pathSegments.last,
        ),
      });
      final response = await _dioClient.client.post(
        ApiConstants.uploadImage,
        data: formData,
        options: Options(
          // Let Dio set multipart boundary — forcing contentType breaks Multer.
          sendTimeout: const Duration(seconds: 60),
          receiveTimeout: const Duration(seconds: 60),
        ),
      );
      final data =
          (response.data as Map<String, dynamic>)['data'] as Map<String, dynamic>;
      return data['url'] as String;
    } on DioException catch (error) {
      throwMappedDioError(error);
    }
  }
}
