import 'package:dio/dio.dart';
import 'package:unleash_your_brave/core/constants/app_constants.dart';
import 'package:unleash_your_brave/core/network/dio_client.dart';
import 'package:unleash_your_brave/features/store/data/models/store_model.dart';

class StoreRemoteDataSource {
  StoreRemoteDataSource(this._dioClient);

  final DioClient _dioClient;

  Future<List<StoreCategoryModel>> listCategories({
    required String eventId,
    int perPage = 100,
  }) async {
    try {
      final response = await _dioClient.client.get(
        ApiConstants.storeCategories,
        queryParameters: {
          'eventId': eventId,
          'perPage': perPage,
          'activeOnly': 'true',
        },
      );
      final data =
          (response.data as Map<String, dynamic>)['data'] as List<dynamic>? ??
              const [];
      return data
          .whereType<Map<String, dynamic>>()
          .map(StoreCategoryModel.fromJson)
          .toList(growable: false);
    } on DioException catch (error) {
      throwMappedDioError(error);
    }
  }

  Future<List<StoreProductModel>> listProducts({
    required String eventId,
    String? categoryId,
    String? search,
    bool? featured,
    int perPage = 100,
  }) async {
    try {
      final response = await _dioClient.client.get(
        ApiConstants.storeProducts,
        queryParameters: {
          'eventId': eventId,
          'perPage': perPage,
          'activeOnly': 'true',
          if (categoryId != null && categoryId.isNotEmpty) 'categoryId': categoryId,
          if (search != null && search.trim().isNotEmpty) 'search': search.trim(),
          if (featured != null) 'featured': featured ? 'true' : 'false',
        },
      );
      final data =
          (response.data as Map<String, dynamic>)['data'] as List<dynamic>? ??
              const [];
      return data
          .whereType<Map<String, dynamic>>()
          .map(StoreProductModel.fromJson)
          .toList(growable: false);
    } on DioException catch (error) {
      throwMappedDioError(error);
    }
  }

  Future<StoreProductModel> getProductById(String id) async {
    try {
      final response =
          await _dioClient.client.get('${ApiConstants.storeProducts}/$id');
      final data =
          (response.data as Map<String, dynamic>)['data'] as Map<String, dynamic>;
      return StoreProductModel.fromJson(data);
    } on DioException catch (error) {
      throwMappedDioError(error);
    }
  }
}
