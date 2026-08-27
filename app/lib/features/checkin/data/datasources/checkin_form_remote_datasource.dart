import 'package:dio/dio.dart';
import 'package:unleash_your_brave/core/constants/app_constants.dart';
import 'package:unleash_your_brave/core/network/dio_client.dart';
import 'package:unleash_your_brave/features/checkin/domain/entities/checkin_form_entity.dart';

class CheckInFormRemoteDataSource {
  CheckInFormRemoteDataSource(this._dioClient);

  final DioClient _dioClient;

  Future<CheckInFormEntity?> getActiveByEvent(String eventId) async {
    try {
      final response = await _dioClient.client.get(
        '${ApiConstants.checkInFormsByEvent}/$eventId',
      );
      final data = (response.data as Map<String, dynamic>)['data'];
      if (data == null) return null;
      if (data is! Map<String, dynamic>) return null;
      return _formFromJson(data);
    } on DioException catch (error) {
      throwMappedDioError(error);
    }
  }

  Future<CheckInFormSubmissionEntity?> getMySubmission(String eventId) async {
    try {
      final response = await _dioClient.client.get(
        ApiConstants.checkInFormMySubmission,
        queryParameters: {'eventId': eventId},
      );
      final data = (response.data as Map<String, dynamic>)['data'];
      if (data == null) return null;
      if (data is! Map<String, dynamic>) return null;
      return _submissionFromJson(data);
    } on DioException catch (error) {
      throwMappedDioError(error);
    }
  }

  Future<CheckInFormSubmissionEntity> submit({
    required String eventId,
    required Map<String, dynamic> answers,
    required String signedName,
    String signatureDataUrl = '',
  }) async {
    try {
      final response = await _dioClient.client.post(
        ApiConstants.checkInFormSubmissions,
        data: {
          'eventId': eventId,
          'answers': answers,
          'signedName': signedName.trim(),
          'signatureDataUrl': signatureDataUrl,
        },
      );
      final data =
          (response.data as Map<String, dynamic>)['data'] as Map<String, dynamic>;
      return _submissionFromJson(data);
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

  CheckInFormSubmissionEntity _submissionFromJson(Map<String, dynamic> json) {
    final submittedAtRaw = json['submittedAt'] as String?;
    return CheckInFormSubmissionEntity(
      id: json['id'] as String? ?? '',
      formId: json['formId'] as String? ?? '',
      eventId: json['eventId'] as String? ?? '',
      userId: json['userId'] as String? ?? '',
      checkInId: json['checkInId'] as String?,
      signedName: json['signedName'] as String? ?? '',
      submittedAt: submittedAtRaw != null && submittedAtRaw.isNotEmpty
          ? DateTime.tryParse(submittedAtRaw)?.toLocal()
          : null,
    );
  }
}
