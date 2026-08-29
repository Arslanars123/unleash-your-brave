import 'package:dio/dio.dart';
import 'package:unleash_your_brave/core/constants/app_constants.dart';
import 'package:unleash_your_brave/core/network/dio_client.dart';
import 'package:unleash_your_brave/features/store/data/models/store_model.dart';
import 'package:unleash_your_brave/features/store/domain/entities/store_entity.dart';

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

  Future<StoreCheckoutSessionResult> createCheckoutSession({
    required String productId,
    required String deliveryAddress,
    required String contactPhone,
    int quantity = 1,
    String? successUrl,
    String? cancelUrl,
    double? expectedPrice,
  }) async {
    try {
      final response = await _dioClient.client.post(
        ApiConstants.storeCheckoutSessions,
        data: {
          'productId': productId,
          'quantity': quantity,
          'deliveryAddress': deliveryAddress,
          'contactPhone': contactPhone,
          if (successUrl != null) 'successUrl': successUrl,
          if (cancelUrl != null) 'cancelUrl': cancelUrl,
          if (expectedPrice != null) 'expectedPrice': expectedPrice,
        },
      );
      final data =
          (response.data as Map<String, dynamic>)['data'] as Map<String, dynamic>;
      return StoreCheckoutSessionResult(
        sessionId: data['sessionId'] as String? ?? '',
        checkoutUrl: data['checkoutUrl'] as String? ?? '',
        productId: data['productId'] as String? ?? productId,
        productName: data['productName'] as String? ?? '',
        quantity: (data['quantity'] as num?)?.toInt() ?? quantity,
        unitPrice: (data['unitPrice'] as num?)?.toDouble() ?? 0,
        totalPrice: (data['totalPrice'] as num?)?.toDouble() ?? 0,
        currency: data['currency'] as String? ?? 'usd',
        eventId: data['eventId'] as String? ?? '',
      );
    } on DioException catch (error) {
      throwMappedDioError(error);
    }
  }

  Future<List<StoreOrderEntity>> listMyOrders() async {
    try {
      final response = await _dioClient.client.get(ApiConstants.storeMyOrders);
      final data =
          (response.data as Map<String, dynamic>)['data'] as List<dynamic>? ??
              const [];
      return data
          .whereType<Map<String, dynamic>>()
          .map(_parseOrder)
          .toList(growable: false);
    } on DioException catch (error) {
      throwMappedDioError(error);
    }
  }

  StoreOrderEntity _parseOrder(Map<String, dynamic> data) {
    final purchasedRaw = data['purchasedAt'] as String? ?? '';
    final purchasedAt = DateTime.tryParse(purchasedRaw) ?? DateTime.fromMillisecondsSinceEpoch(0);
    return StoreOrderEntity(
      id: data['id'] as String? ?? '',
      productName: data['productName'] as String? ?? 'Product',
      quantity: (data['quantity'] as num?)?.toInt() ?? 1,
      totalPrice: (data['totalPrice'] as num?)?.toDouble() ?? 0,
      currency: data['currency'] as String? ?? 'usd',
      purchasedAt: purchasedAt,
      fulfillmentStatus: data['fulfillmentStatus'] as String? ?? 'pending',
      deliveryAddress: data['deliveryAddress'] as String? ?? '',
      contactPhone: data['contactPhone'] as String? ?? '',
    );
  }
}
