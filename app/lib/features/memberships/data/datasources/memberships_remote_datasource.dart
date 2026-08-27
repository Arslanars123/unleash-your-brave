import 'package:dio/dio.dart';
import 'package:unleash_your_brave/core/constants/app_constants.dart';
import 'package:unleash_your_brave/core/network/dio_client.dart';
import 'package:unleash_your_brave/features/memberships/domain/entities/membership_entity.dart';

class MembershipsRemoteDataSource {
  MembershipsRemoteDataSource(this._dioClient);

  final DioClient _dioClient;

  Future<List<MembershipEntity>> list({String? eventId}) async {
    try {
      final response = await _dioClient.client.get(
        ApiConstants.memberships,
        queryParameters: {
          'perPage': 100,
          if (eventId != null && eventId.isNotEmpty) 'eventId': eventId,
        },
      );
      final raw = (response.data as Map<String, dynamic>)['data'];
      final list = raw is List ? raw : const [];
      return list
          .whereType<Map<String, dynamic>>()
          .map(_fromJson)
          .toList(growable: false);
    } on DioException catch (error) {
      throwMappedDioError(error);
    }
  }

  /// Public catalog for the current (or specified) event.
  Future<List<MembershipEntity>> catalog({String? eventId}) async {
    try {
      final response = await _dioClient.client.get(
        ApiConstants.checkoutCatalog,
        queryParameters: {
          if (eventId != null && eventId.isNotEmpty) 'eventId': eventId,
        },
      );
      final data =
          (response.data as Map<String, dynamic>)['data'] as Map<String, dynamic>;
      final list = data['memberships'];
      final items = list is List ? list : const [];
      return items
          .whereType<Map<String, dynamic>>()
          .map(_fromJson)
          .toList(growable: false);
    } on DioException catch (error) {
      throwMappedDioError(error);
    }
  }

  Future<MembershipEntity> getById(String id) async {
    try {
      final response = await _dioClient.client.get('${ApiConstants.memberships}/$id');
      final data =
          (response.data as Map<String, dynamic>)['data'] as Map<String, dynamic>;
      return _fromJson(data);
    } on DioException catch (error) {
      throwMappedDioError(error);
    }
  }

  Future<CheckoutEligibility> checkEligibility({
    required String email,
    required String membershipId,
    String? eventId,
  }) async {
    try {
      final response = await _dioClient.client.get(
        ApiConstants.checkoutEligibility,
        queryParameters: {
          'email': email,
          'membershipId': membershipId,
          if (eventId != null && eventId.isNotEmpty) 'eventId': eventId,
        },
      );
      final data =
          (response.data as Map<String, dynamic>)['data'] as Map<String, dynamic>;
      return CheckoutEligibility(
        allowed: data['allowed'] as bool? ?? false,
        reason: data['reason'] as String?,
        kind: data['kind'] as String?,
        currentMembershipId: data['currentMembershipId'] as String?,
        currentMembershipName: data['currentMembershipName'] as String?,
        currentMembershipPrice: (data['currentMembershipPrice'] as num?)?.toDouble(),
        targetMembershipId: data['targetMembershipId'] as String? ?? membershipId,
        targetMembershipName: data['targetMembershipName'] as String? ?? '',
        targetMembershipPrice:
            (data['targetMembershipPrice'] as num?)?.toDouble() ?? 0,
        eventId: data['eventId'] as String? ?? '',
      );
    } on DioException catch (error) {
      throwMappedDioError(error);
    }
  }

  Future<CouponPreview> previewCoupon({
    required String code,
    required String membershipId,
  }) async {
    try {
      final response = await _dioClient.client.post(
        ApiConstants.couponsPreview,
        data: {
          'code': code.trim(),
          'membershipId': membershipId,
        },
      );
      final data =
          (response.data as Map<String, dynamic>)['data'] as Map<String, dynamic>;
      return CouponPreview(
        valid: data['valid'] as bool? ?? false,
        reason: data['reason'] as String?,
        code: data['code'] as String? ?? code.trim().toUpperCase(),
        couponId: data['couponId'] as String?,
        membershipId: data['membershipId'] as String? ?? membershipId,
        originalPrice: (data['originalPrice'] as num?)?.toDouble() ?? 0,
        percentOff: (data['percentOff'] as num?)?.toDouble() ?? 0,
        discountAmount: (data['discountAmount'] as num?)?.toDouble() ?? 0,
        finalPrice: (data['finalPrice'] as num?)?.toDouble() ?? 0,
      );
    } on DioException catch (error) {
      throwMappedDioError(error);
    }
  }

  Future<CheckoutSessionResult> createCheckoutSession({
    required String membershipId,
    required String email,
    required String firstName,
    required String lastName,
    String? eventId,
    String? successUrl,
    String? cancelUrl,
    String? couponCode,
    double? expectedPrice,
    String? expectedUpdatedAt,
  }) async {
    try {
      final response = await _dioClient.client.post(
        ApiConstants.checkoutSessions,
        data: {
          'membershipId': membershipId,
          'email': email,
          'firstName': firstName,
          'lastName': lastName,
          if (eventId != null && eventId.isNotEmpty) 'eventId': eventId,
          if (successUrl != null) 'successUrl': successUrl,
          if (cancelUrl != null) 'cancelUrl': cancelUrl,
          if (couponCode != null && couponCode.trim().isNotEmpty)
            'couponCode': couponCode.trim(),
          if (expectedPrice != null) 'expectedPrice': expectedPrice,
          if (expectedUpdatedAt != null && expectedUpdatedAt.isNotEmpty)
            'expectedUpdatedAt': expectedUpdatedAt,
        },
      );
      final data =
          (response.data as Map<String, dynamic>)['data'] as Map<String, dynamic>;
      return CheckoutSessionResult(
        sessionId: data['sessionId'] as String? ?? '',
        checkoutUrl: data['checkoutUrl'] as String? ?? '',
        kind: data['kind'] as String? ?? 'purchase',
        membershipId: data['membershipId'] as String? ?? membershipId,
        membershipName: data['membershipName'] as String? ?? '',
        price: (data['price'] as num?)?.toDouble() ?? 0,
        currency: data['currency'] as String? ?? 'usd',
        eventId: data['eventId'] as String? ?? '',
      );
    } on DioException catch (error) {
      throwMappedDioError(error);
    }
  }

  Future<EffectiveEventAccess> myAccess({String? eventId}) async {
    try {
      final response = await _dioClient.client.get(
        ApiConstants.accessMe,
        queryParameters: {
          if (eventId != null && eventId.isNotEmpty) 'eventId': eventId,
        },
      );
      final data =
          (response.data as Map<String, dynamic>)['data'] as Map<String, dynamic>;
      final upgradeIds = data['upgradeMembershipIds'];
      final accessibleIds = data['accessibleMembershipIds'];
      return EffectiveEventAccess(
        eventId: data['eventId'] as String? ?? '',
        allowPreviousAttendeesAccess:
            data['allowPreviousAttendeesAccess'] as bool? ?? false,
        entitled: data['entitled'] as bool? ?? false,
        qrEntitled: data['qrEntitled'] as bool? ?? false,
        carriedFromPrevious: data['carriedFromPrevious'] as bool? ?? false,
        accessibleMembershipIds: accessibleIds is List
            ? accessibleIds.map((e) => e.toString()).toList()
            : const [],
        effectiveMembershipId: data['effectiveMembershipId'] as String?,
        effectiveMembershipName: data['effectiveMembershipName'] as String?,
        sourceMembershipId: data['sourceMembershipId'] as String?,
        sourceMembershipName: data['sourceMembershipName'] as String?,
        validForFutureEvents: data['validForFutureEvents'] as bool? ?? false,
        validForFutureQr: data['validForFutureQr'] as bool? ?? false,
        upgradeMembershipIds: upgradeIds is List
            ? upgradeIds.map((e) => e.toString()).toList()
            : const [],
        viewAgenda: data['viewAgenda'] as bool? ?? true,
        viewMaterials: data['viewMaterials'] as bool? ?? true,
        submitReviews: data['submitReviews'] as bool? ?? true,
        eventStarted: data['eventStarted'] as bool? ?? false,
      );
    } on DioException catch (error) {
      throwMappedDioError(error);
    }
  }

  MembershipEntity _fromJson(Map<String, dynamic> json) {
    final featuresRaw = json['features'];
    final features = featuresRaw is List
        ? featuresRaw.map((e) => e.toString()).where((e) => e.isNotEmpty).toList()
        : const <String>[];

    return MembershipEntity(
      id: json['id'] as String? ?? '',
      eventId: json['eventId'] as String? ?? '',
      name: json['name'] as String? ?? '',
      valueLink: json['valueLink'] as String? ?? '',
      price: (json['price'] as num?)?.toDouble() ?? 0,
      description: json['description'] as String? ?? '',
      features: features,
      paymentPlanNote: json['paymentPlanNote'] as String? ?? '',
      featured: json['featured'] as bool? ?? false,
      tierRank: (json['tierRank'] as num?)?.toInt() ?? 0,
      sortOrder: (json['sortOrder'] as num?)?.toInt() ?? 0,
      validForFutureEvents: json['validForFutureEvents'] as bool? ?? false,
      upgradeToMembershipId: json['upgradeToMembershipId'] as String?,
      billingKind: json['billingKind'] as String? ?? 'one_time',
      durationDays: (json['durationDays'] as num?)?.toInt() ?? 0,
      updatedAt: json['updatedAt'] as String?,
    );
  }
}
