import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';
import 'package:unleash_your_brave/app/di/injection.dart';
import 'package:unleash_your_brave/core/error/exceptions.dart';
import 'package:unleash_your_brave/core/theme/app_colors.dart';
import 'package:unleash_your_brave/core/theme/app_typography.dart';
import 'package:unleash_your_brave/core/widgets/load_error_view.dart';
import 'package:unleash_your_brave/features/home/data/datasources/events_remote_datasource.dart';
import 'package:unleash_your_brave/features/home/domain/entities/event_entity.dart';

class MapPage extends StatefulWidget {
  const MapPage({super.key});

  @override
  State<MapPage> createState() => _MapPageState();
}

class _MapPageState extends State<MapPage> {
  EventEntity? _event;
  String? _errorMessage;
  bool _loading = true;
  bool _offline = false;
  BitmapDescriptor? _markerIcon;
  GoogleMapController? _controller;

  @override
  void initState() {
    super.initState();
    _bootstrap();
  }

  Future<void> _bootstrap() async {
    final icon = await _buildMarkerIcon();
    if (mounted) setState(() => _markerIcon = icon);
    await _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _errorMessage = null;
      _offline = false;
    });

    try {
      final event = await sl<EventsRemoteDataSource>().getCurrent();
      if (!mounted) return;
      setState(() {
        _event = event;
        _loading = false;
      });
      if (event.hasMapPin && _controller != null) {
        await _controller!.animateCamera(
          CameraUpdate.newLatLngZoom(
            LatLng(event.latitude!, event.longitude!),
            15,
          ),
        );
      }
    } on NetworkException catch (error) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _offline = true;
        _errorMessage = error.message;
      });
    } on ServerException catch (error) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _errorMessage = error.message;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _errorMessage = 'Unable to load venue map';
      });
    }
  }

  Future<BitmapDescriptor> _buildMarkerIcon() async {
    const size = 96.0;
    final recorder = ui.PictureRecorder();
    final canvas = Canvas(recorder);
    final paint = Paint()..color = AppColors.accentPink;
    final center = const Offset(size / 2, size / 2 - 4);

    canvas.drawCircle(center, 22, paint);
    canvas.drawCircle(
      center,
      22,
      Paint()
        ..color = Colors.white
        ..style = PaintingStyle.stroke
        ..strokeWidth = 4,
    );

    final path = Path()
      ..moveTo(size / 2 - 14, size / 2 + 10)
      ..lineTo(size / 2, size - 8)
      ..lineTo(size / 2 + 14, size / 2 + 10)
      ..close();
    canvas.drawPath(path, paint);

    final picture = recorder.endRecording();
    final image = await picture.toImage(size.toInt(), size.toInt());
    final bytes = await image.toByteData(format: ui.ImageByteFormat.png);
    return BitmapDescriptor.bytes(bytes!.buffer.asUint8List());
  }

  @override
  Widget build(BuildContext context) {
    if (_loading && _event == null) {
      return const Scaffold(
        backgroundColor: AppColors.bgBase,
        body: Center(
          child: CircularProgressIndicator(color: AppColors.accentPink),
        ),
      );
    }

    if (_errorMessage != null && _event == null) {
      return Scaffold(
        backgroundColor: AppColors.bgBase,
        body: LoadErrorView(
          message: _errorMessage,
          kind: _offline ? LoadErrorKind.offline : LoadErrorKind.generic,
          onRetry: _load,
        ),
      );
    }

    final event = _event!;
    if (!event.hasMapPin) {
      return Scaffold(
        backgroundColor: AppColors.bgBase,
        body: SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Map',
                  style: AppTypography.headline.copyWith(fontSize: 28),
                ),
                const SizedBox(height: 12),
                Text(
                  event.venueLabel.isNotEmpty
                      ? '${event.venueLabel}\n\nA map pin has not been set for this edition yet.'
                      : 'Venue location has not been set for this edition yet.',
                  style: AppTypography.body.copyWith(
                    color: AppColors.textSecondary,
                  ),
                ),
                const Spacer(),
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton(
                    onPressed: _load,
                    child: const Text('Refresh'),
                  ),
                ),
              ],
            ),
          ),
        ),
      );
    }

    final target = LatLng(event.latitude!, event.longitude!);
    final marker = Marker(
      markerId: MarkerId(event.id),
      position: target,
      icon: _markerIcon ??
          BitmapDescriptor.defaultMarkerWithHue(BitmapDescriptor.hueRose),
      infoWindow: InfoWindow(
        title: event.venueName.isNotEmpty ? event.venueName : event.name,
        snippet: event.venueAddress.isNotEmpty
            ? event.venueAddress
            : event.venueCity,
      ),
    );

    return Scaffold(
      backgroundColor: AppColors.bgBase,
      body: Stack(
        children: [
          GoogleMap(
            initialCameraPosition: CameraPosition(target: target, zoom: 15),
            markers: {marker},
            myLocationButtonEnabled: false,
            compassEnabled: false,
            mapToolbarEnabled: false,
            zoomControlsEnabled: false,
            onMapCreated: (controller) => _controller = controller,
          ),
          SafeArea(
            child: Align(
              alignment: Alignment.bottomCenter,
              child: Container(
                width: double.infinity,
                margin: const EdgeInsets.fromLTRB(16, 0, 16, 16),
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: AppColors.bgCard.withValues(alpha: 0.94),
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: AppColors.borderSubtle),
                ),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      event.venueName.isNotEmpty ? event.venueName : event.name,
                      style: AppTypography.body.copyWith(
                        fontWeight: FontWeight.w600,
                        fontSize: 17,
                      ),
                    ),
                    if (event.venueAddress.isNotEmpty ||
                        event.venueCity.isNotEmpty) ...[
                      const SizedBox(height: 4),
                      Text(
                        [
                          if (event.venueAddress.isNotEmpty) event.venueAddress,
                          if (event.venueCity.isNotEmpty) event.venueCity,
                        ].join('\n'),
                        style: AppTypography.caption,
                      ),
                    ],
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
