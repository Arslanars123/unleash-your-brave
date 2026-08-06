import 'package:flutter/material.dart';
import 'package:qr_flutter/qr_flutter.dart';
import 'package:unleash_your_brave/app/di/injection.dart';
import 'package:unleash_your_brave/core/error/exceptions.dart';
import 'package:unleash_your_brave/core/responsive/responsive.dart';
import 'package:unleash_your_brave/core/theme/app_colors.dart';
import 'package:unleash_your_brave/core/theme/app_theme.dart';
import 'package:unleash_your_brave/core/theme/app_typography.dart';
import 'package:unleash_your_brave/core/widgets/adaptive_page.dart';
import 'package:unleash_your_brave/core/widgets/load_error_view.dart';
import 'package:unleash_your_brave/features/checkin/data/datasources/checkin_remote_datasource.dart';
import 'package:unleash_your_brave/features/checkin/domain/entities/checkin_qr_entity.dart';

class CheckInQrPage extends StatefulWidget {
  const CheckInQrPage({super.key});

  @override
  State<CheckInQrPage> createState() => _CheckInQrPageState();
}

class _CheckInQrPageState extends State<CheckInQrPage> {
  bool _loading = true;
  String? _error;
  CheckInQrEntity? _qr;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final qr = await sl<CheckInRemoteDataSource>().getMyQr();
      if (!mounted) return;
      setState(() {
        _qr = qr;
        _loading = false;
      });
    } on NetworkException catch (error) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = error.message;
      });
    } on ServerException catch (error) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = error.message;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = 'Unable to load your check-in QR';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final qr = _qr;

    return Scaffold(
      backgroundColor: AppColors.bgBase,
      body: RefreshIndicator(
        color: AppColors.accentPink,
        onRefresh: _load,
        child: AdaptiveScrollBody(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Check-in QR',
                style: AppTypography.headline.copyWith(
                  fontSize: context.headlineSize,
                ),
              ),
              SizedBox(height: context.sectionGap * 0.5),
              Text(
                'Show this code at the door. It only works for the current event — a new edition gets a new QR.',
                style: AppTypography.body.copyWith(
                  color: AppColors.textSecondary,
                ),
              ),
              SizedBox(height: context.sectionGap),
              if (_loading)
                const Padding(
                  padding: EdgeInsets.symmetric(vertical: 48),
                  child: Center(child: CircularProgressIndicator()),
                )
              else if (_error != null)
                LoadErrorView(message: _error, onRetry: _load)
              else if (qr == null || qr.token.isEmpty)
                Text(
                  'No event QR available yet.',
                  style: AppTypography.body.copyWith(
                    color: AppColors.textSecondary,
                  ),
                )
              else
                _QrCard(qr: qr),
            ],
          ),
        ),
      ),
    );
  }
}

class _QrCard extends StatelessWidget {
  const _QrCard({required this.qr});

  final CheckInQrEntity qr;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: context.cardPadding,
      decoration: BoxDecoration(
        color: AppColors.bgCard,
        borderRadius: BorderRadius.circular(AppTheme.radiusCard),
        border: Border.all(color: AppColors.borderSubtle),
      ),
      child: Column(
        children: [
          Text(
            qr.eventName,
            style: AppTypography.body.copyWith(fontWeight: FontWeight.w700),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 6),
          Text(
            qr.eventStatus.toUpperCase(),
            style: AppTypography.caption.copyWith(
              color: AppColors.accentPink,
              letterSpacing: 1.2,
            ),
          ),
          const SizedBox(height: 20),
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(16),
            ),
            child: QrImageView(
              data: qr.token,
              version: QrVersions.auto,
              size: 220,
              backgroundColor: Colors.white,
              eyeStyle: const QrEyeStyle(
                eyeShape: QrEyeShape.square,
                color: Color(0xFF120F0F),
              ),
              dataModuleStyle: const QrDataModuleStyle(
                dataModuleShape: QrDataModuleShape.square,
                color: Color(0xFF120F0F),
              ),
            ),
          ),
          const SizedBox(height: 16),
          if (qr.checkedIn)
            Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              decoration: BoxDecoration(
                color: AppColors.accentPink.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Text(
                qr.checkedInAt != null
                    ? 'Checked in · ${_format(qr.checkedInAt!)}'
                    : 'Checked in',
                style: AppTypography.body.copyWith(
                  color: AppColors.accentPink,
                  fontWeight: FontWeight.w700,
                ),
                textAlign: TextAlign.center,
              ),
            )
          else
            Text(
              'Not checked in yet',
              style: AppTypography.caption.copyWith(
                color: AppColors.textSecondary,
              ),
            ),
        ],
      ),
    );
  }

  String _format(DateTime when) {
    final local = when.toLocal();
    final hour = local.hour % 12 == 0 ? 12 : local.hour % 12;
    final minute = local.minute.toString().padLeft(2, '0');
    final period = local.hour >= 12 ? 'PM' : 'AM';
    return '${local.day}/${local.month}/${local.year}, $hour:$minute $period';
  }
}
