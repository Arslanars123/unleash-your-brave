import 'package:flutter_dotenv/flutter_dotenv.dart';

/// Resolves a stored media path (absolute URL or `/uploads/...`) into a
/// loadable URL. Mirrors the dashboard `resolveMediaUrl` helper.
String resolveMediaUrl(String? value) {
  if (value == null || value.isEmpty) return '';
  if (RegExp(r'^https?:\/\/', caseSensitive: false).hasMatch(value) ||
      value.startsWith('blob:')) {
    return value;
  }
  if (value.startsWith('/')) {
    return '$apiOrigin$value';
  }
  return value;
}

/// API origin without the `/api/v1` suffix — used for static `/uploads` URLs.
String get apiOrigin {
  final base =
      dotenv.env['API_BASE_URL'] ?? 'http://localhost:4000/api/v1';
  return base.replaceFirst(RegExp(r'/api/v1/?$'), '');
}
