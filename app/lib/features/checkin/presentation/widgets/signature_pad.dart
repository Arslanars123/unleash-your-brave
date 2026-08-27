import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:unleash_your_brave/core/theme/app_colors.dart';
import 'package:unleash_your_brave/core/theme/app_theme.dart';
import 'package:unleash_your_brave/core/theme/app_typography.dart';

/// Simple stroke signature pad that exports a PNG data URL.
class SignaturePad extends StatefulWidget {
  const SignaturePad({
    super.key,
    required this.controller,
    this.height = 160,
  });

  final SignaturePadController controller;
  final double height;

  @override
  State<SignaturePad> createState() => _SignaturePadState();
}

class SignaturePadController extends ChangeNotifier {
  final GlobalKey boundaryKey = GlobalKey();
  final List<List<Offset>> _strokes = [];
  List<Offset> _current = [];

  bool get hasStroke =>
      _strokes.any((s) => s.length > 1) || _current.length > 1;

  List<List<Offset>> get strokes =>
      [..._strokes, if (_current.isNotEmpty) List<Offset>.from(_current)];

  void start(Offset point) {
    _current = [point];
    notifyListeners();
  }

  void update(Offset point) {
    if (_current.isEmpty) return;
    _current.add(point);
    notifyListeners();
  }

  void end() {
    if (_current.length > 1) {
      _strokes.add(List<Offset>.from(_current));
    }
    _current = [];
    notifyListeners();
  }

  void clear() {
    _strokes.clear();
    _current = [];
    notifyListeners();
  }

  Future<String?> toPngDataUrl() async {
    if (!hasStroke) return null;
    final boundary =
        boundaryKey.currentContext?.findRenderObject() as RenderRepaintBoundary?;
    if (boundary == null) return null;
    final image = await boundary.toImage(pixelRatio: 2);
    final bytes = await image.toByteData(format: ui.ImageByteFormat.png);
    if (bytes == null) return null;
    final list = bytes.buffer.asUint8List();
    final b64 = UriData.fromBytes(list, mimeType: 'image/png').toString();
    return b64;
  }
}

class _SignaturePadState extends State<SignaturePad> {
  @override
  void initState() {
    super.initState();
    widget.controller.addListener(_onChanged);
  }

  @override
  void didUpdateWidget(covariant SignaturePad oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.controller != widget.controller) {
      oldWidget.controller.removeListener(_onChanged);
      widget.controller.addListener(_onChanged);
    }
  }

  @override
  void dispose() {
    widget.controller.removeListener(_onChanged);
    super.dispose();
  }

  void _onChanged() {
    if (mounted) setState(() {});
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          children: [
            Expanded(
              child: Text(
                'Signature',
                style: AppTypography.microLabel.copyWith(letterSpacing: 1.2),
              ),
            ),
            TextButton(
              onPressed: widget.controller.clear,
              child: Text(
                'Clear',
                style: AppTypography.caption.copyWith(color: AppColors.accentPink),
              ),
            ),
          ],
        ),
        const SizedBox(height: 6),
        RepaintBoundary(
          key: widget.controller.boundaryKey,
          child: Container(
            height: widget.height,
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(AppTheme.radiusCard),
              border: Border.all(color: AppColors.borderSubtle),
            ),
            child: GestureDetector(
              onPanStart: (details) =>
                  widget.controller.start(details.localPosition),
              onPanUpdate: (details) =>
                  widget.controller.update(details.localPosition),
              onPanEnd: (_) => widget.controller.end(),
              child: CustomPaint(
                painter: _SignaturePainter(widget.controller.strokes),
                child: const SizedBox.expand(),
              ),
            ),
          ),
        ),
      ],
    );
  }
}

class _SignaturePainter extends CustomPainter {
  _SignaturePainter(this.strokes);

  final List<List<Offset>> strokes;

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = const Color(0xFF111111)
      ..strokeWidth = 2.4
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round;

    for (final stroke in strokes) {
      if (stroke.length < 2) continue;
      final path = Path()..moveTo(stroke.first.dx, stroke.first.dy);
      for (var i = 1; i < stroke.length; i++) {
        path.lineTo(stroke[i].dx, stroke[i].dy);
      }
      canvas.drawPath(path, paint);
    }
  }

  @override
  bool shouldRepaint(covariant _SignaturePainter oldDelegate) => true;
}
