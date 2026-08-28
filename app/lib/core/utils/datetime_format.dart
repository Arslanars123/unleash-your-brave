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

const _shortMonths = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

String _shortMonth(int month) => _shortMonths[month - 1];

/// Calendar date in US style, e.g. `Sep 10, 2026`.
String formatUsDate(DateTime date, {bool utc = false}) {
  final d = utc ? date.toUtc() : date.toLocal();
  return '${_shortMonth(d.month)} ${d.day}, ${d.year}';
}

/// Date + time in US style, e.g. `Sep 10, 2026, 9:00 AM`.
String formatUsDateTime(DateTime date) {
  final local = date.toLocal();
  final hour = local.hour % 12 == 0 ? 12 : local.hour % 12;
  final minute = local.minute.toString().padLeft(2, '0');
  final period = local.hour >= 12 ? 'PM' : 'AM';
  return '${formatUsDate(local)}, $hour:$minute $period';
}

/// Short month + day for compact labels, e.g. `Sep 10`.
String formatUsShortDate(DateTime date, {bool utc = false}) {
  final d = utc ? date.toUtc() : date.toLocal();
  return '${_shortMonth(d.month)} ${d.day}';
}
