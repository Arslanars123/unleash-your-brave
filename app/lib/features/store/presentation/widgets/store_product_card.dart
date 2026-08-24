import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:unleash_your_brave/core/theme/app_colors.dart';
import 'package:unleash_your_brave/core/theme/app_theme.dart';
import 'package:unleash_your_brave/core/theme/app_typography.dart';
import 'package:unleash_your_brave/core/utils/media_url.dart';
import 'package:unleash_your_brave/features/store/domain/entities/store_entity.dart';

String formatStoreMoney(double amount, String currency) {
  try {
    return '${currency.toUpperCase()} ${amount.toStringAsFixed(2)}';
  } catch (_) {
    return '$amount $currency';
  }
}

class StoreProductCard extends StatelessWidget {
  const StoreProductCard({
    super.key,
    required this.product,
    this.onTap,
  });

  final StoreProductEntity product;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final imageUrl = resolveMediaUrl(product.primaryImage);
    final hasImage = isLoadableMediaUrl(product.primaryImage);

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(AppTheme.radiusCard),
        child: Ink(
          decoration: BoxDecoration(
            color: AppColors.bgCard,
            borderRadius: BorderRadius.circular(AppTheme.radiusCard),
            border: Border.all(color: AppColors.borderSubtle),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              ClipRRect(
                borderRadius: const BorderRadius.vertical(
                  top: Radius.circular(AppTheme.radiusCard),
                ),
                child: AspectRatio(
                  aspectRatio: 1,
                  child: hasImage
                      ? CachedNetworkImage(
                          imageUrl: imageUrl,
                          fit: BoxFit.cover,
                          errorWidget: (_, __, ___) => _placeholder(),
                        )
                      : _placeholder(),
                ),
              ),
              Padding(
                padding: const EdgeInsets.all(12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      product.name,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: AppTypography.body.copyWith(
                        fontWeight: FontWeight.w600,
                        fontSize: 14,
                      ),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      formatStoreMoney(product.price, product.currency),
                      style: AppTypography.caption.copyWith(
                        color: AppColors.accentPink,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    if (!product.inStock) ...[
                      const SizedBox(height: 4),
                      Text(
                        'Out of stock',
                        style: AppTypography.caption.copyWith(
                          fontSize: 11,
                          color: AppColors.textTertiary,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _placeholder() {
    return Container(
      color: AppColors.bgMaroon,
      alignment: Alignment.center,
      child: const Icon(
        Icons.shopping_bag_outlined,
        color: AppColors.accentPink,
      ),
    );
  }
}
