import 'package:dio/dio.dart';
import 'package:unleash_your_brave/core/constants/app_constants.dart';
import 'package:unleash_your_brave/core/network/dio_client.dart';
import 'package:unleash_your_brave/features/auth/data/models/user_model.dart';
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

  Future<UserModel> upgradeMyMembership(String membershipId) async {
    try {
      final response = await _dioClient.client.patch(
        ApiConstants.upgradeMyMembership,
        data: {'membershipId': membershipId},
      );
      final data =
          (response.data as Map<String, dynamic>)['data'] as Map<String, dynamic>;
      return UserModel.fromJson(data);
    } on DioException catch (error) {
      throwMappedDioError(error);
    }
  }

  MembershipEntity _fromJson(Map<String, dynamic> json) {
    return MembershipEntity(
      id: json['id'] as String? ?? '',
      eventId: json['eventId'] as String? ?? '',
      name: json['name'] as String? ?? '',
      valueLink: json['valueLink'] as String? ?? '',
      price: (json['price'] as num?)?.toDouble() ?? 0,
      description: json['description'] as String? ?? '',
    );
  }
}
