import 'package:flutter_test/flutter_test.dart';
import 'package:unleash_your_brave/core/utils/datetime_format.dart';

void main() {
  test('formatUsDate uses abbreviated US month', () {
    final value = formatUsDate(DateTime.utc(2026, 9, 10), utc: true);
    expect(value, 'Sep 10, 2026');
  });

  test('formatUsDateTime includes comma before time', () {
    final value = formatUsDateTime(DateTime(2026, 9, 10, 14, 30));
    expect(value, contains('Sep 10, 2026,'));
    expect(value, contains('PM'));
  });

  test('formatUsShortDate omits year', () {
    expect(formatUsShortDate(DateTime.utc(2026, 9, 10), utc: true), 'Sep 10');
  });
}
