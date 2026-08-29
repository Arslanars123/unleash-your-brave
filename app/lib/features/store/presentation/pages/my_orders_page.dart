import 'dart:async';

import 'package:flutter/material.dart';
import 'package:unleash_your_brave/app/di/injection.dart';
import 'package:unleash_your_brave/core/error/exceptions.dart';
import 'package:unleash_your_brave/core/responsive/responsive.dart';
import 'package:unleash_your_brave/core/theme/app_colors.dart';
import 'package:unleash_your_brave/core/theme/app_theme.dart';
import 'package:unleash_your_brave/core/theme/app_typography.dart';
import 'package:unleash_your_brave/core/widgets/load_error_view.dart';
import 'package:unleash_your_brave/core/widgets/subpage_app_bar.dart';
import 'package:unleash_your_brave/features/store/data/datasources/store_remote_datasource.dart';
import 'package:unleash_your_brave/features/store/domain/entities/store_entity.dart';
import 'package:unleash_your_brave/features/store/presentation/widgets/store_product_card.dart';

class MyOrdersPage extends StatefulWidget {
  const MyOrdersPage({super.key});

  @override
  State<MyOrdersPage> createState() => _MyOrdersPageState();
}

class _MyOrdersPageState extends State<MyOrdersPage> {
  bool _loading = true;
  bool _isOffline = false;
  String? _errorMessage;
  List<StoreOrderEntity> _orders = const [];

  @override
  void initState() {
    super.initState();
    unawaited(_load());
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _errorMessage = null;
    });
    try {
      final orders = await sl<StoreRemoteDataSource>().listMyOrders();
      if (!mounted) return;
      setState(() {
        _orders = orders;
        _loading = false;
        _isOffline = false;
      });
    } on NetworkException catch (error) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _isOffline = true;
        _errorMessage = error.message;
      });
    } on ServerException catch (error) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _isOffline = false;
        _errorMessage = error.message;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _errorMessage = 'Unable to load orders';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final sidePad = context.pagePadding.left;

    return Scaffold(
      backgroundColor: AppColors.bgBase,
      appBar: buildSubpageAppBar(
        context,
        title: 'My orders',
        fallbackLocation: '/',
      ),
      body: _loading
          ? const Center(
              child: CircularProgressIndicator(color: AppColors.accentPink),
            )
          : _errorMessage != null
              ? LoadErrorView(
                  kind: _isOffline ? LoadErrorKind.offline : LoadErrorKind.generic,
                  message: _errorMessage,
                  onRetry: _load,
                )
              : RefreshIndicator(
                  color: AppColors.accentPink,
                  onRefresh: _load,
                  child: _orders.isEmpty
                      ? ListView(
                          physics: const AlwaysScrollableScrollPhysics(),
                          padding: EdgeInsets.fromLTRB(sidePad, 48, sidePad, 48),
                          children: [
                            Text(
                              'No orders yet',
                              textAlign: TextAlign.center,
                              style: AppTypography.headline.copyWith(fontSize: 22),
                            ),
                            const SizedBox(height: 8),
                            Text(
                              'Products you buy from the store will appear here.',
                              textAlign: TextAlign.center,
                              style: AppTypography.caption,
                            ),
                          ],
                        )
                      : ListView.separated(
                          physics: const AlwaysScrollableScrollPhysics(
                            parent: BouncingScrollPhysics(),
                          ),
                          padding: EdgeInsets.fromLTRB(sidePad, 16, sidePad, 32),
                          itemCount: _orders.length,
                          separatorBuilder: (_, __) => const SizedBox(height: 12),
                          itemBuilder: (context, index) {
                            final order = _orders[index];
                            return _OrderCard(order: order);
                          },
                        ),
                ),
    );
  }
}

class _OrderCard extends StatelessWidget {
  const _OrderCard({required this.order});

  final StoreOrderEntity order;

  @override
  Widget build(BuildContext context) {
    final date = order.purchasedAt.toLocal();
    final months = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
    ];
    final dateLabel =
        '${months[date.month - 1]} ${date.day}, ${date.year}';
    final delivered = order.isDelivered;

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.bgCard,
        borderRadius: BorderRadius.circular(AppTheme.radiusCard),
        border: Border.all(color: AppColors.borderSubtle),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Text(
                  order.productName,
                  style: AppTypography.body.copyWith(
                    fontWeight: FontWeight.w700,
                    fontSize: 17,
                  ),
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: delivered
                      ? AppColors.accentPink.withValues(alpha: 0.15)
                      : AppColors.bgMaroon,
                  borderRadius: BorderRadius.circular(AppTheme.radiusChip),
                ),
                child: Text(
                  order.statusLabel,
                  style: AppTypography.microLabel.copyWith(
                    color: delivered ? AppColors.accentPink : AppColors.textSecondary,
                    letterSpacing: 0.8,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            '${formatStoreMoney(order.totalPrice, order.currency)} · Qty ${order.quantity}',
            style: AppTypography.caption,
          ),
          const SizedBox(height: 4),
          Text('Ordered $dateLabel', style: AppTypography.caption),
          if (order.deliveryAddress.trim().isNotEmpty) ...[
            const SizedBox(height: 10),
            Text(
              order.deliveryAddress,
              style: AppTypography.caption.copyWith(color: AppColors.textSecondary),
            ),
          ],
        ],
      ),
    );
  }
}
