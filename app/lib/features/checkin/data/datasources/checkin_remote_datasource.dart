import 'package:dio/dio.dart';
import 'package:unleash_your_brave/core/constants/app_constants.dart';
import 'package:unleash_your_brave/core/network/dio_client.dart';
import 'package:unleash_your_brave/features/checkin/domain/entities/checkin_form_entity.dart';
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

  /// After staff scans the QR, this becomes pending until the attendee submits.
  Future<({CheckInFormEntity form, DateTime scannedAt})?> getMyPendingForm({
    String? eventId,
  }) async {
    try {
      final response = await _dioClient.client.get(
        ApiConstants.checkInMyPendingForm,
        queryParameters: {
          if (eventId != null && eventId.isNotEmpty) 'eventId': eventId,
        },
      );
      final data = (response.data as Map<String, dynamic>)['data'];
      if (data is! Map<String, dynamic>) return null;
      if (data['pending'] != true) return null;
      final form = data['form'];
      if (form is! Map<String, dynamic>) return null;
      final scannedAtRaw = data['scannedAt'] as String?;
      final scannedAt = scannedAtRaw != null && scannedAtRaw.isNotEmpty
          ? DateTime.tryParse(scannedAtRaw)?.toLocal()
          : null;
      if (scannedAt == null) return null;
      return (form: _formFromJson(form), scannedAt: scannedAt);
    } on DioException catch (error) {
      throwMappedDioError(error);
    }
  }

  /// Drop an unfinished door scan so Check-in shows the QR again.
  Future<void> cancelMyPendingForm({String? eventId}) async {
    try {
      await _dioClient.client.post(
        ApiConstants.checkInCancelMyPendingForm,
        data: {
          if (eventId != null && eventId.isNotEmpty) 'eventId': eventId,
        },
      );
    } on DioException catch (error) {
      throwMappedDioError(error);
    }
  }

  Future<CheckInQrEntity> completeMyForm({
    required String eventId,
    required Map<String, dynamic> answers,
    required String signedName,
    String signatureDataUrl = '',
  }) async {
    try {
      final response = await _dioClient.client.post(
        ApiConstants.checkInCompleteMyForm,
        data: {
          'eventId': eventId,
          'answers': answers,
          'signedName': signedName.trim(),
          'signatureDataUrl': signatureDataUrl,
        },
      );
      final data =
          (response.data as Map<String, dynamic>)['data'] as Map<String, dynamic>;
      final checkedInAtRaw = data['checkedInAt'] as String?;
      return CheckInQrEntity(
        eventId: data['eventId'] as String? ?? eventId,
        eventName: data['eventName'] as String? ?? 'Event',
        eventStatus: data['eventStatus'] as String? ?? 'upcoming',
        userId: data['userId'] as String? ?? '',
        token: data['token'] as String? ?? '',
        checkedIn: data['checkedIn'] as bool? ?? true,
        checkedInAt: checkedInAtRaw != null && checkedInAtRaw.isNotEmpty
            ? DateTime.tryParse(checkedInAtRaw)?.toLocal()
            : null,
      );
    } on DioException catch (error) {
      throwMappedDioError(error);
    }
  }

  CheckInFormEntity _formFromJson(Map<String, dynamic> json) {
    final rawFields = json['fields'] as List<dynamic>? ?? const [];
    final fields = rawFields.whereType<Map<String, dynamic>>().map((field) {
      return CheckInFormFieldEntity(
        id: field['id'] as String? ?? '',
        label: field['label'] as String? ?? '',
        type: field['type'] as String? ?? 'text',
        required: field['required'] as bool? ?? false,
        sortOrder: (field['sortOrder'] as num?)?.toInt() ?? 0,
      );
    }).toList(growable: false);

    return CheckInFormEntity(
      id: json['id'] as String? ?? '',
      eventId: json['eventId'] as String? ?? '',
      title: json['title'] as String? ?? 'Waiver',
      description: json['description'] as String? ?? '',
      fields: fields,
      requireSignature: json['requireSignature'] as bool? ?? true,
      isActive: json['isActive'] as bool? ?? true,
    );
  }
}
