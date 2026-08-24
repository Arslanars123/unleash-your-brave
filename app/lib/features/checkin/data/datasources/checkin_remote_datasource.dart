import 'package:dio/dio.dart';
import 'package:unleash_your_brave/core/constants/app_constants.dart';
import 'package:unleash_your_brave/core/network/dio_client.dart';
import 'package:unleash_your_brave/features/checkin/domain/entities/checkin_qr_entity.dart';
import 'package:unleash_your_brave/features/checkin/domain/entities/event_booking_entity.dart';
import 'package:unleash_your_brave/features/home/data/models/event_model.dart';

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

  Future<List<EventBookingEntity>> getMyBookings() async {
    try {
      final response =
          await _dioClient.client.get(ApiConstants.checkInMyBookings);
      final data =
          (response.data as Map<String, dynamic>)['data'] as List<dynamic>? ??
              const [];
      return data.whereType<Map<String, dynamic>>().map((row) {
        final eventJson = row['event'] as Map<String, dynamic>? ?? const {};
        final checkedInAtRaw = row['checkedInAt'] as String?;
        return EventBookingEntity(
          event: EventModel.fromJson(eventJson),
          entitled: row['entitled'] as bool? ?? false,
          qrEntitled: row['qrEntitled'] as bool? ?? false,
          effectiveMembershipName: row['effectiveMembershipName'] as String?,
          checkedIn: row['checkedIn'] as bool? ?? false,
          checkedInAt: checkedInAtRaw != null && checkedInAtRaw.isNotEmpty
              ? DateTime.tryParse(checkedInAtRaw)?.toLocal()
              : null,
          carriedFromPrevious: row['carriedFromPrevious'] as bool? ?? false,
        );
      }).toList(growable: false);
    } on DioException catch (error) {
      throwMappedDioError(error);
    }
  }
}
