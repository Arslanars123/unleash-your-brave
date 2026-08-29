import 'dart:async';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import 'package:unleash_your_brave/app/di/injection.dart';
import 'package:unleash_your_brave/core/constants/app_constants.dart';
import 'package:unleash_your_brave/core/error/exceptions.dart';
import 'package:unleash_your_brave/core/responsive/responsive.dart';
import 'package:unleash_your_brave/core/theme/app_colors.dart';
import 'package:unleash_your_brave/core/theme/app_theme.dart';
import 'package:unleash_your_brave/core/theme/app_typography.dart';
import 'package:unleash_your_brave/core/utils/app_toast.dart';
import 'package:unleash_your_brave/core/utils/media_url.dart';
import 'package:unleash_your_brave/core/widgets/load_error_view.dart';
import 'package:unleash_your_brave/features/auth/presentation/bloc/auth_bloc.dart';
import 'package:unleash_your_brave/features/store/data/datasources/store_remote_datasource.dart';
import 'package:unleash_your_brave/features/store/domain/entities/store_entity.dart';
import 'package:unleash_your_brave/features/store/presentation/widgets/store_product_card.dart';
import 'package:url_launcher/url_launcher.dart';

class StoreCheckoutPage extends StatefulWidget {
  const StoreCheckoutPage({
    super.key,
    required this.productId,
    this.initialProduct,
  });

  final String productId;
  final StoreProductEntity? initialProduct;

  @override
  State<StoreCheckoutPage> createState() => _StoreCheckoutPageState();
}

class _StoreCheckoutPageState extends State<StoreCheckoutPage> {
  StoreProductEntity? _product;
  bool _loading = true;
  bool _paying = false;
  String? _errorMessage;
  bool _isOffline = false;
  int _quantity = 1;
  final _deliveryAddressController = TextEditingController();
  final _contactPhoneController = TextEditingController();

  static const _maxQuantityPerCheckout = 20;

  @override
  void initState() {
    super.initState();
    _product = widget.initialProduct;
    unawaited(_load());
  }

  @override
  void dispose() {
    _deliveryAddressController.dispose();
    _contactPhoneController.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = _product == null;
      _errorMessage = null;
    });

    try {
      final product =
          await sl<StoreRemoteDataSource>().getProductById(widget.productId);
      if (!mounted) return;
      setState(() {
        _product = product;
        _loading = false;
        _errorMessage = null;
        _isOffline = false;
        _quantity = _clampQuantity(_quantity, product);
      });
    } on NetworkException catch (error) {
      if (!mounted) return;
      _handleLoadFailure(isOffline: true, message: error.message);
    } on ServerException catch (error) {
      if (!mounted) return;
      _handleLoadFailure(isOffline: false, message: error.message);
    } catch (_) {
      if (!mounted) return;
      _handleLoadFailure(isOffline: false, message: 'Unexpected error');
    }
  }

  void _handleLoadFailure({required bool isOffline, required String message}) {
    if (_product != null) {
      setState(() {
        _loading = false;
        _isOffline = isOffline;
      });
      AppToast.info('Couldn\'t refresh product details.');
      return;
    }
    setState(() {
      _loading = false;
      _isOffline = isOffline;
      _errorMessage = message;
    });
  }

  int _maxSelectableQuantity(StoreProductEntity product) {
    if (!product.inStock) return 1;
    if (product.trackInventory) {
      return product.stockQty.clamp(1, _maxQuantityPerCheckout);
    }
    return _maxQuantityPerCheckout;
  }

  int _clampQuantity(int value, StoreProductEntity product) {
    final max = _maxSelectableQuantity(product);
    return value.clamp(1, max);
  }

  double get _lineTotal {
    final product = _product;
    if (product == null) return 0;
    return product.price * _quantity;
  }

  Future<void> _payWithStripe() async {
    final product = _product;
    if (product == null || _paying) return;

    if (!product.inStock) {
      AppToast.error('This product is out of stock');
      return;
    }

    final authState = context.read<AuthBloc>().state;
    if (authState is! AuthAuthenticated) {
      AppToast.error('Sign in to complete your purchase');
      context.push('/login');
      return;
    }

    final deliveryAddress = _deliveryAddressController.text.trim();
    final contactPhone = _contactPhoneController.text.trim();
    if (deliveryAddress.isEmpty) {
      AppToast.error('Enter your delivery address');
      return;
    }
    if (contactPhone.length < 6) {
      AppToast.error('Enter a contact phone number');
      return;
    }

    setState(() => _paying = true);
    try {
      final session = await sl<StoreRemoteDataSource>().createCheckoutSession(
        productId: product.id,
        quantity: _quantity,
        deliveryAddress: deliveryAddress,
        contactPhone: contactPhone,
        successUrl: ApiConstants.checkoutSuccessUrl,
        cancelUrl: ApiConstants.checkoutCancelUrl,
        expectedPrice: product.price,
      );

      final uri = Uri.tryParse(session.checkoutUrl);
      if (uri == null) {
        AppToast.error('Invalid checkout link');
        return;
      }

      final opened = await launchUrl(uri, mode: LaunchMode.externalApplication);
      if (!opened) {
        AppToast.error('Unable to open Stripe checkout');
        return;
      }

      if (!mounted) return;
      AppToast.success('Complete payment in your browser, then return to the app.');
    } on NetworkException catch (error) {
      AppToast.error(error.message);
    } on ServerException catch (error) {
      AppToast.error(error.message);
    } catch (_) {
      AppToast.error('Unable to start checkout');
    } finally {
      if (mounted) setState(() => _paying = false);
    }
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
              context.go('/store/products/${widget.productId}');
            }
          },
        ),
        title: Text(
          'Checkout',
          style: AppTypography.body.copyWith(
            fontWeight: FontWeight.w600,
            fontSize: 17,
          ),
        ),
      ),
      body: _buildBody(),
      bottomNavigationBar: _buildPayBar(),
    );
  }

  Widget? _buildPayBar() {
    final product = _product;
    if (_loading || product == null || _errorMessage != null) return null;

    final canPay = product.inStock && !_paying;

    return SafeArea(
      minimum: const EdgeInsets.fromLTRB(20, 0, 20, 16),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('Total', style: AppTypography.body),
              Text(
                formatStoreMoney(_lineTotal, product.currency),
                style: AppTypography.body.copyWith(
                  fontWeight: FontWeight.w700,
                  color: AppColors.accentPink,
                  fontSize: 18,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          FilledButton(
            onPressed: canPay ? _payWithStripe : null,
            style: FilledButton.styleFrom(
              backgroundColor: AppColors.accentPink,
              foregroundColor: AppColors.bgBase,
              disabledBackgroundColor: AppColors.bgCard,
              disabledForegroundColor: AppColors.textTertiary,
              padding: const EdgeInsets.symmetric(vertical: 14),
            ),
            child: _paying
                ? const SizedBox(
                    height: 20,
                    width: 20,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      color: AppColors.bgBase,
                    ),
                  )
                : Text(
                    product.inStock ? 'Pay with Stripe' : 'Out of stock',
                    style: AppTypography.button,
                  ),
          ),
        ],
      ),
    );
  }

  Widget _buildBody() {
    if (_loading) {
      return const Center(
        child: CircularProgressIndicator(color: AppColors.accentPink),
      );
    }

    final product = _product;
    if (product == null) {
      return LoadErrorView(
        kind: _isOffline ? LoadErrorKind.offline : LoadErrorKind.generic,
        message: _errorMessage,
        onRetry: _load,
      );
    }

    final sidePad = context.pagePadding.left;
    final description = product.description.trim();
    final images = product.images
        .where(isLoadableMediaUrl)
        .map(resolveMediaUrl)
        .toList(growable: false);
    final maxQty = _maxSelectableQuantity(product);

    return ListView(
      physics: const BouncingScrollPhysics(
        parent: AlwaysScrollableScrollPhysics(),
      ),
      padding: EdgeInsets.fromLTRB(sidePad, 8, sidePad, 120),
      children: [
        Center(
          child: ConstrainedBox(
            constraints: BoxConstraints(maxWidth: context.maxContentWidth),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(
                  'REVIEW YOUR ORDER',
                  style: AppTypography.microLabel.copyWith(
                    color: AppColors.accentPink,
                    letterSpacing: 1.6,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  'Confirm product details before payment',
                  style: AppTypography.caption.copyWith(fontSize: 14),
                ),
                const SizedBox(height: 20),
                _ReviewCard(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      if (images.isNotEmpty)
                        ClipRRect(
                          borderRadius:
                              BorderRadius.circular(AppTheme.radiusCard),
                          child: AspectRatio(
                            aspectRatio: 1.4,
                            child: CachedNetworkImage(
                              imageUrl: images.first,
                              fit: BoxFit.cover,
                              errorWidget: (_, __, ___) => Container(
                                color: AppColors.bgMaroon,
                              ),
                            ),
                          ),
                        )
                      else
                        Container(
                          height: 160,
                          decoration: BoxDecoration(
                            color: AppColors.bgMaroon,
                            borderRadius:
                                BorderRadius.circular(AppTheme.radiusCard),
                          ),
                        ),
                      const SizedBox(height: 16),
                      if (product.categoryName?.trim().isNotEmpty == true)
                        Text(
                          product.categoryName!.toUpperCase(),
                          style: AppTypography.microLabel.copyWith(
                            letterSpacing: 1.2,
                            color: AppColors.accentPink,
                          ),
                        ),
                      if (product.categoryName?.trim().isNotEmpty == true)
                        const SizedBox(height: 6),
                      Text(
                        product.name,
                        style: AppTypography.headline.copyWith(fontSize: 24),
                      ),
                      const SizedBox(height: 10),
                      Row(
                        children: [
                          Text(
                            formatStoreMoney(product.price, product.currency),
                            style: AppTypography.body.copyWith(
                              fontSize: 18,
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
                      if (product.sku.trim().isNotEmpty) ...[
                        const SizedBox(height: 8),
                        Text('SKU ${product.sku}', style: AppTypography.caption),
                      ],
                      const SizedBox(height: 16),
                      Text(
                        'ABOUT',
                        style: AppTypography.microLabel.copyWith(
                          letterSpacing: 1.4,
                        ),
                      ),
                      const SizedBox(height: 8),
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
                    ],
                  ),
                ),
                const SizedBox(height: 16),
                _ReviewCard(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Text(
                        'DELIVERY DETAILS',
                        style: AppTypography.microLabel.copyWith(
                          letterSpacing: 1.4,
                        ),
                      ),
                      const SizedBox(height: 12),
                      Text(
                        'Delivery address',
                        style: AppTypography.caption.copyWith(
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      const SizedBox(height: 8),
                      TextField(
                        controller: _deliveryAddressController,
                        minLines: 2,
                        maxLines: 4,
                        textCapitalization: TextCapitalization.sentences,
                        decoration: InputDecoration(
                          hintText: 'Street, city, postcode',
                          filled: true,
                          fillColor: AppColors.bgMaroon,
                          border: OutlineInputBorder(
                            borderRadius:
                                BorderRadius.circular(AppTheme.radiusChip),
                            borderSide:
                                const BorderSide(color: AppColors.borderSubtle),
                          ),
                          enabledBorder: OutlineInputBorder(
                            borderRadius:
                                BorderRadius.circular(AppTheme.radiusChip),
                            borderSide:
                                const BorderSide(color: AppColors.borderSubtle),
                          ),
                        ),
                        style: AppTypography.body,
                      ),
                      const SizedBox(height: 14),
                      Text(
                        'Contact phone',
                        style: AppTypography.caption.copyWith(
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      const SizedBox(height: 8),
                      TextField(
                        controller: _contactPhoneController,
                        keyboardType: TextInputType.phone,
                        textCapitalization: TextCapitalization.none,
                        decoration: InputDecoration(
                          hintText: 'Mobile number for delivery',
                          filled: true,
                          fillColor: AppColors.bgMaroon,
                          border: OutlineInputBorder(
                            borderRadius:
                                BorderRadius.circular(AppTheme.radiusChip),
                            borderSide:
                                const BorderSide(color: AppColors.borderSubtle),
                          ),
                          enabledBorder: OutlineInputBorder(
                            borderRadius:
                                BorderRadius.circular(AppTheme.radiusChip),
                            borderSide:
                                const BorderSide(color: AppColors.borderSubtle),
                          ),
                        ),
                        style: AppTypography.body,
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 16),
                _ReviewCard(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Text(
                        'QUANTITY',
                        style: AppTypography.microLabel.copyWith(
                          letterSpacing: 1.4,
                        ),
                      ),
                      const SizedBox(height: 12),
                      Row(
                        children: [
                          _QuantityButton(
                            icon: Icons.remove,
                            enabled: _quantity > 1 && product.inStock,
                            onTap: () {
                              setState(() {
                                _quantity = _clampQuantity(
                                  _quantity - 1,
                                  product,
                                );
                              });
                            },
                          ),
                          Expanded(
                            child: Text(
                              '$_quantity',
                              textAlign: TextAlign.center,
                              style: AppTypography.body.copyWith(
                                fontSize: 18,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                          ),
                          _QuantityButton(
                            icon: Icons.add,
                            enabled: _quantity < maxQty && product.inStock,
                            onTap: () {
                              setState(() {
                                _quantity = _clampQuantity(
                                  _quantity + 1,
                                  product,
                                );
                              });
                            },
                          ),
                        ],
                      ),
                      if (product.trackInventory && maxQty < _maxQuantityPerCheckout)
                        Padding(
                          padding: const EdgeInsets.only(top: 8),
                          child: Text(
                            'Maximum $maxQty per order',
                            style: AppTypography.caption,
                          ),
                        ),
                    ],
                  ),
                ),
                const SizedBox(height: 16),
                _ReviewCard(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Text(
                        'ORDER SUMMARY',
                        style: AppTypography.microLabel.copyWith(
                          letterSpacing: 1.4,
                        ),
                      ),
                      const SizedBox(height: 12),
                      _SummaryRow(
                        label: 'Unit price',
                        value: formatStoreMoney(product.price, product.currency),
                      ),
                      const SizedBox(height: 8),
                      _SummaryRow(label: 'Quantity', value: '$_quantity'),
                      const Padding(
                        padding: EdgeInsets.symmetric(vertical: 12),
                        child: Divider(color: AppColors.borderSubtle, height: 1),
                      ),
                      _SummaryRow(
                        label: 'Total',
                        value: formatStoreMoney(_lineTotal, product.currency),
                        emphasized: true,
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

class _ReviewCard extends StatelessWidget {
  const _ReviewCard({required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.bgCard,
        borderRadius: BorderRadius.circular(AppTheme.radiusCard),
        border: Border.all(color: AppColors.borderSubtle),
      ),
      child: child,
    );
  }
}

class _SummaryRow extends StatelessWidget {
  const _SummaryRow({
    required this.label,
    required this.value,
    this.emphasized = false,
  });

  final String label;
  final String value;
  final bool emphasized;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(label, style: AppTypography.caption),
        Text(
          value,
          style: (emphasized ? AppTypography.body : AppTypography.caption)
              .copyWith(
            fontWeight: emphasized ? FontWeight.w700 : FontWeight.w500,
            color: emphasized ? AppColors.accentPink : AppColors.textPrimary,
          ),
        ),
      ],
    );
  }
}

class _QuantityButton extends StatelessWidget {
  const _QuantityButton({
    required this.icon,
    required this.enabled,
    required this.onTap,
  });

  final IconData icon;
  final bool enabled;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: enabled ? AppColors.bgMaroon : AppColors.bgCard,
      borderRadius: BorderRadius.circular(AppTheme.radiusChip),
      child: InkWell(
        onTap: enabled ? onTap : null,
        borderRadius: BorderRadius.circular(AppTheme.radiusChip),
        child: SizedBox(
          width: 44,
          height: 44,
          child: Icon(
            icon,
            color: enabled ? AppColors.textPrimary : AppColors.textTertiary,
          ),
        ),
      ),
    );
  }
}
