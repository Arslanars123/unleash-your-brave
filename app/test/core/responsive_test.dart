import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:unleash_your_brave/core/responsive/responsive.dart';
import 'package:unleash_your_brave/core/widgets/adaptive_page.dart';

/// Representative viewports we support, in logical pixels.
const devices = <String, Size>{
  'iPhone SE': Size(320, 568),
  'iPhone 15': Size(393, 852),
  'iPhone 15 landscape': Size(852, 393),
  'Pixel 7': Size(412, 915),
  'iPad mini': Size(744, 1133),
  'iPad Pro': Size(1024, 1366),
  'Desktop': Size(1440, 900),
};

Widget wrap(Widget child, {TextScaler textScaler = TextScaler.noScaling}) {
  return MediaQuery(
    data: MediaQueryData(textScaler: textScaler),
    child: MaterialApp(home: Scaffold(body: child)),
  );
}

void main() {
  group('ResponsiveContext', () {
    testWidgets('maps widths to the expected size class', (tester) async {
      final results = <double, ScreenSize>{};

      for (final width in [320.0, 599.0, 600.0, 839.0, 840.0, 1199.0, 1200.0]) {
        late ScreenSize captured;
        await tester.pumpWidget(
          MediaQuery(
            data: MediaQueryData(size: Size(width, 800)),
            child: MaterialApp(
              home: Builder(
                builder: (context) {
                  captured = context.sizeClass;
                  return const SizedBox.shrink();
                },
              ),
            ),
          ),
        );
        results[width] = captured;
      }

      expect(results[320], ScreenSize.compact);
      expect(results[599], ScreenSize.compact);
      expect(results[600], ScreenSize.medium);
      expect(results[839], ScreenSize.medium);
      expect(results[840], ScreenSize.expanded);
      expect(results[1199], ScreenSize.expanded);
      expect(results[1200], ScreenSize.large);
    });
  });

  group('AdaptiveCenteredBody', () {
    for (final entry in devices.entries) {
      testWidgets('renders without overflow on ${entry.key}', (tester) async {
        tester.view.physicalSize = entry.value;
        tester.view.devicePixelRatio = 1.0;
        addTearDown(tester.view.reset);

        await tester.pumpWidget(
          wrap(
            AdaptiveCenteredBody(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: List.generate(
                  8,
                  (index) => Container(
                    height: 80,
                    margin: const EdgeInsets.only(bottom: 12),
                    color: Colors.pink,
                  ),
                ),
              ),
            ),
          ),
        );

        expect(tester.takeException(), isNull);
        expect(find.byType(SingleChildScrollView), findsOneWidget);
      });
    }

    testWidgets('scrolls when content exceeds a short viewport', (tester) async {
      tester.view.physicalSize = const Size(852, 393);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.reset);

      await tester.pumpWidget(
        wrap(
          AdaptiveCenteredBody(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: List.generate(
                10,
                (index) => Container(height: 100, color: Colors.pink),
              ),
            ),
          ),
        ),
      );

      await tester.drag(find.byType(SingleChildScrollView), const Offset(0, -200));
      await tester.pump();

      expect(tester.takeException(), isNull);
    });

    testWidgets('survives large accessibility text scaling', (tester) async {
      tester.view.physicalSize = const Size(320, 568);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.reset);

      await tester.pumpWidget(
        wrap(
          const AdaptiveCenteredBody(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text('Welcome back to Unleash Your Brave'),
                TextField(),
              ],
            ),
          ),
          textScaler: const TextScaler.linear(1.3),
        ),
      );

      expect(tester.takeException(), isNull);
    });
  });
}
