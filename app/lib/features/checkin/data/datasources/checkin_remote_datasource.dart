import 'package:dio/dio.dart';
import 'package:unleash_your_brave/core/constants/app_constants.dart';
import 'package:unleash_your_brave/core/network/dio_client.dart';
import 'package:unleash_your_brave/features/checkin/domain/entities/checkin_qr_entity.dart';

class CheckInRemoteDataSource {
  CheckInRemoteDataSource(this._dioClient);

  final DioClient _dioClient;

  Future<CheckInQrEntity> getMyQr({String? eventId}) async {
    try {
      final response = await _dioClient.client.get(
        ApiConstants.checkInMyQr,
        queryParameters: {
          if (eventId != null && eventId.isNotEmpty) 'eventId': eventId,
        },
      );
      final data =
          (response.data as Map<String, dynamic>)['data'] as Map<String, dynamic>;
      final checkedInAtRaw = data['checkedInAt'] as String?;
      return CheckInQrEntity(
        eventId: data['eventId'] as String? ?? '',
        eventName: data['eventName'] as String? ?? 'Event',
        eventStatus: data['eventStatus'] as String? ?? 'upcoming',
        userId: data['userId'] as String? ?? '',
        token: data['token'] as String? ?? '',
        checkedIn: data['checkedIn'] as bool? ?? false,
        checkedInAt: checkedInAtRaw != null && checkedInAtRaw.isNotEmpty
            ? DateTime.tryParse(checkedInAtRaw)?.toLocal()
            : null,
      );
    } on DioException catch (error) {
      throwMappedDioError(error);
    }
  }
}
