import 'package:flutter_dotenv/flutter_dotenv.dart';

/// Resolves a stored media path (absolute URL or `/uploads/...`) into a
/// loadable URL. Mirrors the dashboard `resolveMediaUrl` helper.
String resolveMediaUrl(String? value) {
  if (value == null || value.trim().isEmpty) return '';
  final trimmed = value.trim();
  if (RegExp(r'^https?:\/\/', caseSensitive: false).hasMatch(trimmed) ||
      trimmed.startsWith('blob:')) {
    return trimmed;
  }
  if (trimmed.startsWith('/')) {
    return '$apiOrigin$trimmed';
  }
  return trimmed;
}

/// True when [resolveMediaUrl] yields a URL safe for network image widgets.
bool isLoadableMediaUrl(String? value) {
  final resolved = resolveMediaUrl(value);
  if (resolved.isEmpty) return false;
  final uri = Uri.tryParse(resolved);
  return uri != null && uri.hasScheme && uri.host.isNotEmpty;
}

/// API origin without the `/api/v1` suffix — used for static `/uploads` URLs.
String get apiOrigin {
  final base =
      dotenv.env['API_BASE_URL'] ?? 'http://localhost:4000/api/v1';
  return base.replaceFirst(RegExp(r'/api/v1/?$'), '');
}
