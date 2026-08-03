/// Formats a 24h `HH:mm` string as `9:00 AM`. Returns '' for empty/invalid.
String formatTimeHm(String? value) {
  if (value == null || value.trim().isEmpty) return '';
  final match = RegExp(r'^([01]\d|2[0-3]):([0-5]\d)$').firstMatch(value.trim());
  if (match == null) return value.trim();

  var hours = int.parse(match.group(1)!);
  final minutes = match.group(2)!;
  final period = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  if (hours == 0) hours = 12;
  return '$hours:$minutes $period';
}

/// e.g. `9:00 AM – 10:00 AM`, or '' if times are missing.
String formatSessionTimeRange(String? startTime, String? endTime) {
  final start = formatTimeHm(startTime);
  final end = formatTimeHm(endTime);
  if (start.isEmpty && end.isEmpty) return '';
  if (start.isNotEmpty && end.isNotEmpty) return '$start – $end';
  return start.isNotEmpty ? start : end;
}
