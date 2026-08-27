import 'dart:async';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'package:go_router/go_router.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:unleash_your_brave/app/di/injection.dart';
import 'package:unleash_your_brave/core/error/exceptions.dart';
import 'package:unleash_your_brave/core/theme/app_colors.dart';
import 'package:unleash_your_brave/core/theme/app_typography.dart';
import 'package:unleash_your_brave/core/widgets/load_error_view.dart';
import 'package:unleash_your_brave/features/home/data/datasources/events_remote_datasource.dart';
import 'package:unleash_your_brave/features/home/domain/entities/event_entity.dart';

class MapPage extends StatefulWidget {
  const MapPage({super.key, this.focusEventId});

  /// When set (from `/map?eventId=`), show that edition’s venue.
  /// Back-to-current appears only if this differs from the preferred current event.
  final String? focusEventId;

  @override
  State<MapPage> createState() => _MapPageState();
}

class _MapPageState extends State<MapPage> {
  EventEntity? _event;
  EventEntity? _currentEvent;
  String? _errorMessage;
  bool _loading = true;
  bool _refreshing = false;
  bool _offline = false;

  /// Native GoogleMap is mounted only after data load + a short delay.
  bool _mountMap = false;
  bool _mapReady = false;
  bool _mapFailed = false;
  Timer? _mapWatchdog;
  int _mapGeneration = 0;

  bool get _viewingOtherEdition {
    final focus = widget.focusEventId?.trim();
    final currentId = _currentEvent?.id;
    if (focus == null || focus.isEmpty || currentId == null) return false;
    return focus != currentId;
  }

  @override
  void initState() {
    super.initState();
    // Defer so the first frame (and bottom nav) paint before any network work.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _load(isRefresh: false);
    });
  }

  @override
  void didUpdateWidget(covariant MapPage oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.focusEventId != widget.focusEventId) {
      unawaited(_load(isRefresh: false));
    }
  }

  @override
  void dispose() {
    _mapWatchdog?.cancel();
    super.dispose();
  }

  bool get _hasMapsKey {
    final key = dotenv.env['GOOGLE_MAPS_API_KEY']?.trim() ?? '';
    return key.isNotEmpty;
  }

  Future<void> _load({required bool isRefresh}) async {
    if (_refreshing) return;

    setState(() {
      if (isRefresh && _event != null) {
        _refreshing = true;
      } else {
        _loading = true;
        _mountMap = false;
        _mapReady = false;
        _mapFailed = false;
      }
      _errorMessage = null;
      _offline = false;
    });

    try {
      EventEntity? current;
      try {
        current = await sl<EventsRemoteDataSource>()
            .getCurrent()
            .timeout(const Duration(seconds: 12));
      } catch (_) {
        current = null;
      }

      final focusId = widget.focusEventId?.trim();
      EventEntity event;
      if (focusId != null && focusId.isNotEmpty) {
        event = await sl<EventsRemoteDataSource>()
            .getById(focusId)
            .timeout(const Duration(seconds: 12));
      } else if (current != null) {
        event = current;
      } else {
        throw const ServerException('No event available');
      }

      if (!mounted) return;

      setState(() {
        _event = event;
        _currentEvent = current;
        _loading = false;
        _refreshing = false;
        _errorMessage = null;
      });

      if (event.hasMapPin && _hasMapsKey) {
        // Let the venue card paint first; then mount the PlatformView.
        await Future<void>.delayed(const Duration(milliseconds: 250));
        if (!mounted) return;
        setState(() {
          _mapGeneration += 1;
          _mountMap = true;
          _mapReady = false;
          _mapFailed = false;
        });
        _startMapWatchdog();
      }
    } on NetworkException catch (error) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _refreshing = false;
        _offline = true;
        if (_event == null) _errorMessage = error.message;
      });
    } on ServerException catch (error) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _refreshing = false;
        if (_event == null) _errorMessage = error.message;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _refreshing = false;
        if (_event == null) {
          _errorMessage = 'Unable to load venue map';
        }
      });
    }
  }

  void _startMapWatchdog() {
    _mapWatchdog?.cancel();
    _mapWatchdog = Timer(const Duration(seconds: 8), () {
      if (!mounted || _mapReady) return;
      // Native map failed to become ready — keep the rest of the UI usable.
      setState(() {
        _mountMap = false;
        _mapReady = false;
        _mapFailed = true;
      });
    });
  }

  Future<void> _openExternalMaps(EventEntity event) async {
    final lat = event.latitude;
    final lng = event.longitude;
    if (lat == null || lng == null) return;

    final apple = Uri.parse(
      'https://maps.apple.com/?ll=$lat,$lng&q=${Uri.encodeComponent(event.venueName.isNotEmpty ? event.venueName : event.name)}',
    );
    final google = Uri.parse(
      'https://www.google.com/maps/search/?api=1&query=$lat,$lng',
    );
    final uri = Platform.isIOS ? apple : google;
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
  }

  @override
  Widget build(BuildContext context) {
    final tabActive = TickerMode.of(context);

    if (!tabActive) {
      // Drop native map while this tab is offstage.
      if (_mountMap) {
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (!mounted || TickerMode.of(context)) return;
          _mapWatchdog?.cancel();
          setState(() {
            _mountMap = false;
            _mapReady = false;
            _mapFailed = false;
            _mapGeneration += 1;
          });
        });
      }
      return const ColoredBox(color: AppColors.bgBase);
    }

    // Tab became active again — remount the native map if we have a pin.
    if (!_mountMap &&
        !_mapFailed &&
        !_loading &&
        _event != null &&
        _event!.hasMapPin &&
        _hasMapsKey) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted || !TickerMode.of(context)) return;
        if (_mountMap || _mapFailed) return;
        setState(() {
          _mapGeneration += 1;
          _mountMap = true;
          _mapReady = false;
        });
        _startMapWatchdog();
      });
    }

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
          retrying: _refreshing || _loading,
          onRetry: () => _load(isRefresh: false),
        ),
      );
    }

    final event = _event!;
    return Scaffold(
      backgroundColor: AppColors.bgBase,
      body: Column(
        children: [
          if (_viewingOtherEdition)
            SafeArea(
              bottom: false,
              child: Align(
                alignment: Alignment.centerLeft,
                child: TextButton.icon(
                  onPressed: () => context.go('/map'),
                  icon: const Icon(Icons.arrow_back, size: 18),
                  label: const Text('Back to current event'),
                  style: TextButton.styleFrom(
                    foregroundColor: AppColors.accentPink,
                  ),
                ),
              ),
            ),
          Expanded(child: _buildMapArea(event)),
          _VenueFooter(
            event: event,
            refreshing: _refreshing,
            onRefresh: () => _load(isRefresh: true),
            onOpenExternal: event.hasMapPin
                ? () => _openExternalMaps(event)
                : null,
          ),
        ],
      ),
    );
  }

  Widget _buildMapArea(EventEntity event) {
    if (!event.hasMapPin) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Text(
            event.venueLabel.isNotEmpty
                ? '${event.venueLabel}\n\nA map pin has not been set for this edition yet. Edit the event in the admin dashboard and pick a place.'
                : 'Venue location has not been set for this edition yet.',
            textAlign: TextAlign.center,
            style: AppTypography.body.copyWith(color: AppColors.textSecondary),
          ),
        ),
      );
    }

    if (!_hasMapsKey) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Text(
            Platform.isIOS
                ? 'Google Maps key missing for iOS. Add GOOGLE_MAPS_API_KEY to ios/Flutter/MapsSecrets.xcconfig, then fully restart the app.'
                : 'Google Maps key missing. Add GOOGLE_MAPS_API_KEY to app/.env, then fully restart the app.',
            textAlign: TextAlign.center,
            style: AppTypography.body.copyWith(color: AppColors.textSecondary),
          ),
        ),
      );
    }

    if (_mapFailed) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Text(
            'Could not load the in-app map. Use Open in Maps below, or check that Maps SDK for ${Platform.isIOS ? 'iOS' : 'Android'} is enabled for your API key.',
            textAlign: TextAlign.center,
            style: AppTypography.body.copyWith(color: AppColors.textSecondary),
          ),
        ),
      );
    }

    if (!_mountMap) {
      return const Center(
        child: CircularProgressIndicator(color: AppColors.accentPink),
      );
    }

    final target = LatLng(event.latitude!, event.longitude!);
    return Stack(
      children: [
        GoogleMap(
          key: ValueKey('venue-map-$_mapGeneration'),
          initialCameraPosition: CameraPosition(target: target, zoom: 15),
          markers: {
            Marker(
              markerId: MarkerId(event.id),
              position: target,
              icon: BitmapDescriptor.defaultMarkerWithHue(
                BitmapDescriptor.hueRose,
              ),
              infoWindow: InfoWindow(
                title: event.venueName.isNotEmpty ? event.venueName : event.name,
                snippet: event.venueAddress.isNotEmpty
                    ? event.venueAddress
                    : event.venueCity,
              ),
            ),
          },
          myLocationButtonEnabled: false,
          compassEnabled: false,
          mapToolbarEnabled: false,
          zoomControlsEnabled: false,
          onMapCreated: (_) {
            _mapWatchdog?.cancel();
            if (mounted) setState(() => _mapReady = true);
          },
        ),
        if (!_mapReady)
          const ColoredBox(
            color: AppColors.bgBase,
            child: Center(
              child: CircularProgressIndicator(color: AppColors.accentPink),
            ),
          ),
      ],
    );
  }
}

class _VenueFooter extends StatelessWidget {
  const _VenueFooter({
    required this.event,
    required this.refreshing,
    required this.onRefresh,
    this.onOpenExternal,
  });

  final EventEntity event;
  final bool refreshing;
  final VoidCallback onRefresh;
  final VoidCallback? onOpenExternal;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: AppColors.bgCard,
      child: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
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
              if (event.venueAddress.isNotEmpty || event.venueCity.isNotEmpty) ...[
                const SizedBox(height: 4),
                Text(
                  [
                    if (event.venueAddress.isNotEmpty) event.venueAddress,
                    if (event.venueCity.isNotEmpty) event.venueCity,
                  ].join('\n'),
                  style: AppTypography.caption,
                ),
              ],
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton(
                      onPressed: refreshing ? null : onRefresh,
                      child: refreshing
                          ? const SizedBox(
                              width: 18,
                              height: 18,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            )
                          : const Text('Refresh'),
                    ),
                  ),
                  if (onOpenExternal != null) ...[
                    const SizedBox(width: 12),
                    Expanded(
                      child: ElevatedButton(
                        onPressed: onOpenExternal,
                        child: const Text('Open in Maps'),
                      ),
                    ),
                  ],
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
