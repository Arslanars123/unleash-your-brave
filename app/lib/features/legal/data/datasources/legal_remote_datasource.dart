import 'package:dio/dio.dart';
import 'package:unleash_your_brave/core/error/exceptions.dart';
import 'package:unleash_your_brave/core/network/dio_client.dart';
import 'package:unleash_your_brave/features/legal/domain/entities/legal_document_entity.dart';

enum LegalDocumentKind { privacy, terms }

class LegalRemoteDataSource {
  LegalRemoteDataSource()
      : _dio = Dio(
          BaseOptions(
            baseUrl: 'https://fittoprofit.com',
            connectTimeout: const Duration(seconds: 15),
            receiveTimeout: const Duration(seconds: 20),
            headers: {
              'Accept': 'application/json',
              'Content-Type': 'application/json',
            },
          ),
        );

  final Dio _dio;

  Future<LegalDocumentEntity> fetch(LegalDocumentKind kind) async {
    final path = switch (kind) {
      LegalDocumentKind.privacy => '/api/privacy-policy',
      LegalDocumentKind.terms => '/api/terms',
    };

    try {
      final response = await _dio.get<dynamic>(path);
      final payload = response.data;
      if (payload is! Map<String, dynamic>) {
        throw const ServerException('Invalid response from server');
      }

      if (payload['success'] != true) {
        final err = payload['error'];
        final message = err is Map && err['message'] is String
            ? err['message'] as String
            : 'Unable to load document';
        throw ServerException(message, statusCode: response.statusCode);
      }

      final data = payload['data'];
      if (data is! Map<String, dynamic>) {
        throw const ServerException('No content available');
      }

      final title = (data['title'] as String?)?.trim() ?? '';
      final body = (data['body'] as String?)?.trim() ?? '';
      final updated = (data['updated'] as String?)?.trim() ?? '';
      final subtitle = (data['subtitle'] as String?)?.trim();
      final eyebrow = (data['eyebrow'] as String?)?.trim();

      if (title.isEmpty && body.isEmpty) {
        throw const ServerException('No content available');
      }

      return LegalDocumentEntity(
        title: title.isEmpty
            ? (kind == LegalDocumentKind.privacy
                ? 'Privacy Policy'
                : 'Terms & Conditions')
            : title,
        subtitleHtml: (subtitle == null || subtitle.isEmpty) ? null : subtitle,
        updated: updated,
        bodyHtml: body,
        eyebrow: (eyebrow == null || eyebrow.isEmpty) ? null : eyebrow,
      );
    } on DioException catch (error) {
      throwMappedDioError(error);
    }
  }
}
