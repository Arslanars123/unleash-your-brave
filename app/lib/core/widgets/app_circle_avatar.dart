import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:unleash_your_brave/core/theme/app_colors.dart';
import 'package:unleash_your_brave/core/utils/media_url.dart';

/// Circle avatar that soft-fails when a remote photo 404s / is offline.
/// Uses [CachedNetworkImage] so missing files do not dump Image Resource exceptions.
class AppCircleAvatar extends StatelessWidget {
  const AppCircleAvatar({
    super.key,
    required this.radius,
    this.photoUrl,
    this.fallback,
    this.backgroundColor,
    this.cacheBust,
  });

  final double radius;
  final String? photoUrl;
  final Widget? fallback;
  final Color? backgroundColor;

  /// Extra cache key segment so a newly uploaded photo reloads immediately.
  final String? cacheBust;

  @override
  Widget build(BuildContext context) {
    final bg = backgroundColor ?? AppColors.accentPink.withValues(alpha: 0.15);
    final size = radius * 2;
    final canLoad = isLoadableMediaUrl(photoUrl);
    final resolved = resolveMediaUrl(photoUrl);
    final bust = (cacheBust ?? photoUrl ?? '').trim();
    final cacheKey = bust.isEmpty ? resolved : '$resolved#$bust';

    Widget placeholder() => Container(
          width: size,
          height: size,
          color: bg,
          alignment: Alignment.center,
          child: fallback,
        );

    return ClipOval(
      child: SizedBox(
        width: size,
        height: size,
        child: canLoad
            ? CachedNetworkImage(
                imageUrl: resolved,
                width: size,
                height: size,
                fit: BoxFit.cover,
                cacheKey: cacheKey,
                fadeInDuration: const Duration(milliseconds: 120),
                placeholder: (_, __) => placeholder(),
                errorWidget: (_, __, ___) => placeholder(),
              )
            : placeholder(),
      ),
    );
  }
}
