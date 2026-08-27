import 'dart:async';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:unleash_your_brave/app/di/injection.dart';
import 'package:unleash_your_brave/core/error/exceptions.dart';
import 'package:unleash_your_brave/core/responsive/responsive.dart';
import 'package:unleash_your_brave/core/theme/app_colors.dart';
import 'package:unleash_your_brave/core/theme/app_theme.dart';
import 'package:unleash_your_brave/core/theme/app_typography.dart';
import 'package:unleash_your_brave/core/utils/app_toast.dart';
import 'package:unleash_your_brave/core/utils/media_url.dart';
import 'package:unleash_your_brave/core/widgets/load_error_view.dart';
import 'package:unleash_your_brave/features/store/data/datasources/store_remote_datasource.dart';
import 'package:unleash_your_brave/features/store/domain/entities/store_entity.dart';
import 'package:unleash_your_brave/features/store/presentation/widgets/store_product_card.dart';

class StoreProductDetailPage extends StatefulWidget {
  const StoreProductDetailPage({
    super.key,
    required this.productId,
    this.initialProduct,
  });

  final String productId;
  final StoreProductEntity? initialProduct;

  @override
  State<StoreProductDetailPage> createState() => _StoreProductDetailPageState();
}

class _StoreProductDetailPageState extends State<StoreProductDetailPage> {
  StoreProductEntity? _product;
  bool _loading = true;
  bool _refreshing = false;
  String? _errorMessage;
  bool _isOffline = false;
  int _imageIndex = 0;

  @override
  void initState() {
    super.initState();
    _product = widget.initialProduct;
    unawaited(_load(isRefresh: _product != null));
  }

  Future<void> _load({required bool isRefresh}) async {
    setState(() {
      if (isRefresh && _product != null) {
        _refreshing = true;
      } else {
        _loading = true;
        _errorMessage = null;
      }
    });

    try {
      final product =
          await sl<StoreRemoteDataSource>().getProductById(widget.productId);
      if (!mounted) return;
      setState(() {
        _product = product;
        _loading = false;
        _refreshing = false;
        _errorMessage = null;
        _isOffline = false;
      });
    } on NetworkException catch (error) {
      if (!mounted) return;
      _handleFailure(isOffline: true, message: error.message);
    } on ServerException catch (error) {
      if (!mounted) return;
      _handleFailure(isOffline: false, message: error.message);
    } catch (_) {
      if (!mounted) return;
      _handleFailure(isOffline: false, message: 'Unexpected error');
    }
  }

  void _handleFailure({required bool isOffline, required String message}) {
    if (_product != null) {
      setState(() {
        _loading = false;
        _refreshing = false;
        _isOffline = isOffline;
      });
      AppToast.info(
        isOffline
            ? 'You’re offline. Showing saved product details.'
            : 'Couldn’t refresh. Showing saved product details.',
      );
      return;
    }
    setState(() {
      _loading = false;
      _refreshing = false;
      _isOffline = isOffline;
      _errorMessage = message;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bgBase,
      appBar: AppBar(
        backgroundColor: AppColors.bgBase,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_rounded),
          onPressed: () {
            if (context.canPop()) {
              context.pop();
            } else {
              context.go('/store');
            }
          },
        ),
        title: Text(
          'Product',
          style: AppTypography.body.copyWith(
            fontWeight: FontWeight.w600,
            fontSize: 17,
          ),
        ),
      ),
      body: RefreshIndicator(
        color: AppColors.accentPink,
        onRefresh: () => _load(isRefresh: true),
        child: _buildBody(),
      ),
    );
  }

  Widget _buildBody() {
    final product = _product;
    if (_loading && product == null) {
      return ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        children: const [
          SizedBox(height: 160),
          Center(child: CircularProgressIndicator(color: AppColors.accentPink)),
        ],
      );
    }

    if (product == null) {
      return ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        children: [
          SizedBox(
            height: MediaQuery.sizeOf(context).height * 0.7,
            child: LoadErrorView(
              kind: _isOffline ? LoadErrorKind.offline : LoadErrorKind.generic,
              message: _errorMessage,
              onRetry: () => _load(isRefresh: false),
            ),
          ),
        ],
      );
    }

    final sidePad = context.pagePadding.left;
    final description = product.description.trim();
    final images = product.images
        .where(isLoadableMediaUrl)
        .map(resolveMediaUrl)
        .toList(growable: false);

    return CustomScrollView(
      physics: const AlwaysScrollableScrollPhysics(
        parent: BouncingScrollPhysics(),
      ),
      slivers: [
        SliverToBoxAdapter(
          child: Padding(
            padding: EdgeInsets.fromLTRB(sidePad, 8, sidePad, 28),
            child: Center(
              child: ConstrainedBox(
                constraints: BoxConstraints(maxWidth: context.maxContentWidth),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    if (_refreshing)
                      const Padding(
                        padding: EdgeInsets.only(bottom: 12),
                        child: LinearProgressIndicator(
                          color: AppColors.accentPink,
                          backgroundColor: AppColors.bgMaroon,
                          minHeight: 2,
                        ),
                      ),
                    if (images.isNotEmpty)
                      Column(
                        children: [
                          ClipRRect(
                            borderRadius:
                                BorderRadius.circular(AppTheme.radiusCard),
                            child: AspectRatio(
                              aspectRatio: 1,
                              child: PageView.builder(
                                itemCount: images.length,
                                onPageChanged: (index) =>
                                    setState(() => _imageIndex = index),
                                itemBuilder: (context, index) {
                                  return CachedNetworkImage(
                                    imageUrl: images[index],
                                    fit: BoxFit.cover,
                                    errorWidget: (_, __, ___) => Container(
                                      color: AppColors.bgMaroon,
                                    ),
                                  );
                                },
                              ),
                            ),
                          ),
                          if (images.length > 1) ...[
                            const SizedBox(height: 10),
                            Text(
                              '${_imageIndex + 1} / ${images.length}',
                              style: AppTypography.caption,
                            ),
                          ],
                        ],
                      )
                    else
                      Container(
                        height: 220,
                        decoration: BoxDecoration(
                          color: AppColors.bgMaroon,
                          borderRadius:
                              BorderRadius.circular(AppTheme.radiusCard),
                        ),
                      ),
                    const SizedBox(height: 20),
                    if (product.categoryName?.trim().isNotEmpty == true)
                      Text(
                        product.categoryName!.toUpperCase(),
                        style: AppTypography.microLabel.copyWith(
                          letterSpacing: 1.2,
                          color: AppColors.accentPink,
                        ),
                      ),
                    const SizedBox(height: 8),
                    Text(
                      product.name,
                      style: AppTypography.headline.copyWith(fontSize: 28),
                    ),
                    const SizedBox(height: 10),
                    Row(
                      children: [
                        Text(
                          formatStoreMoney(product.price, product.currency),
                          style: AppTypography.body.copyWith(
                            fontSize: 20,
                            fontWeight: FontWeight.w700,
                            color: AppColors.accentPink,
                          ),
                        ),
                        if (product.compareAtPrice != null) ...[
                          const SizedBox(width: 10),
                          Text(
                            formatStoreMoney(
                              product.compareAtPrice!,
                              product.currency,
                            ),
                            style: AppTypography.caption.copyWith(
                              decoration: TextDecoration.lineThrough,
                            ),
                          ),
                        ],
                      ],
                    ),
                    const SizedBox(height: 8),
                    Text(
                      product.inStock
                          ? product.isLowStock
                              ? 'Low stock · ${product.stockQty} left'
                              : 'In stock · ${product.stockQty} left'
                          : 'Out of stock',
                      style: AppTypography.caption,
                    ),
                    const SizedBox(height: 24),
                    Text(
                      'ABOUT',
                      style: AppTypography.microLabel.copyWith(letterSpacing: 1.4),
                    ),
                    const SizedBox(height: 10),
                    Text(
                      description.isEmpty
                          ? 'No description available for this product.'
                          : description,
                      style: AppTypography.body.copyWith(
                        fontSize: 15,
                        height: 1.55,
                        color: description.isEmpty
                            ? AppColors.textSecondary
                            : AppColors.textPrimary,
                      ),
                    ),
                    if (product.sku.trim().isNotEmpty) ...[
                      const SizedBox(height: 20),
                      Text(
                        'SKU ${product.sku}',
                        style: AppTypography.caption,
                      ),
                    ],
                    const SizedBox(height: 28),
                    FilledButton(
                      onPressed: product.inStock
                          ? () => context.push(
                                '/store/products/${product.id}/checkout',
                                extra: product,
                              )
                          : null,
                      style: FilledButton.styleFrom(
                        backgroundColor: AppColors.accentPink,
                        foregroundColor: AppColors.bgBase,
                        disabledBackgroundColor: AppColors.bgCard,
                        disabledForegroundColor: AppColors.textTertiary,
                        padding: const EdgeInsets.symmetric(vertical: 14),
                      ),
                      child: Text(
                        product.inStock
                            ? 'Review & purchase'
                            : 'Out of stock',
                        style: AppTypography.button,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }
}
