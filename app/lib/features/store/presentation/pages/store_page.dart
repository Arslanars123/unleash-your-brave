import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import 'package:unleash_your_brave/app/di/injection.dart';
import 'package:unleash_your_brave/core/error/exceptions.dart';
import 'package:unleash_your_brave/core/responsive/responsive.dart';
import 'package:unleash_your_brave/core/theme/app_colors.dart';
import 'package:unleash_your_brave/core/theme/app_theme.dart';
import 'package:unleash_your_brave/core/theme/app_typography.dart';
import 'package:unleash_your_brave/core/widgets/load_error_view.dart';
import 'package:unleash_your_brave/core/widgets/suggest_search_field.dart';
import 'package:unleash_your_brave/features/home/data/datasources/events_remote_datasource.dart';
import 'package:unleash_your_brave/features/home/domain/entities/event_entity.dart';
import 'package:unleash_your_brave/features/home/presentation/cubit/selected_event_cubit.dart';
import 'package:unleash_your_brave/features/store/data/datasources/store_remote_datasource.dart';
import 'package:unleash_your_brave/features/store/domain/entities/store_entity.dart';
import 'package:unleash_your_brave/features/store/presentation/widgets/store_product_card.dart';

enum _LoadStatus { loading, refreshing, success, offline, error }

class StorePage extends StatefulWidget {
  const StorePage({super.key});

  @override
  State<StorePage> createState() => _StorePageState();
}

class _StorePageState extends State<StorePage> {
  final _searchController = TextEditingController();

  _LoadStatus _status = _LoadStatus.loading;
  EventEntity? _event;
  List<StoreCategoryEntity> _categories = const [];
  List<StoreProductEntity> _products = const [];
  String? _errorMessage;
  String _searchQuery = '';
  String? _selectedCategoryId;
  String? _boundEventId;

  @override
  void initState() {
    super.initState();
    unawaited(_load(isRefresh: false));
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  List<StoreProductEntity> get _visibleProducts {
    var items = _products;
    if (_selectedCategoryId != null) {
      items = items
          .where((product) => product.categoryId == _selectedCategoryId)
          .toList(growable: false);
    }
    if (_searchQuery.trim().isNotEmpty) {
      items = items
          .where((product) => product.matchesSearch(_searchQuery))
          .toList(growable: false);
    }
    return items;
  }

  /// Prefer admin categories; fall back to categories present on products.
  List<StoreCategoryEntity> get _filterCategories {
    if (_categories.isNotEmpty) return _categories;
    final byId = <String, StoreCategoryEntity>{};
    for (final product in _products) {
      final id = product.categoryId?.trim() ?? '';
      final name = product.categoryName?.trim() ?? '';
      if (id.isEmpty || name.isEmpty || byId.containsKey(id)) continue;
      byId[id] = StoreCategoryEntity(
        id: id,
        eventId: product.eventId,
        name: name,
        description: '',
        image: '',
        sortOrder: byId.length,
        isActive: true,
        productCount: 0,
      );
    }
    return byId.values.toList(growable: false);
  }

  Future<String> _resolveEventId() async {
    final cubit = context.read<SelectedEventCubit>();
    await cubit.ensureReady();
    final id = cubit.state.eventId;
    if (id != null && id.isNotEmpty) return id;
    final event = await sl<EventsRemoteDataSource>().getCurrent();
    return event.id;
  }

  Future<void> _load({required bool isRefresh}) async {
    final hadContent = _event != null;
    setState(() {
      _status = isRefresh && hadContent
          ? _LoadStatus.refreshing
          : _LoadStatus.loading;
      if (!isRefresh || !hadContent) _errorMessage = null;
    });

    try {
      final eventId = await _resolveEventId();
      final event = await sl<EventsRemoteDataSource>().getById(eventId);
      final remote = sl<StoreRemoteDataSource>();
      final results = await Future.wait([
        remote.listCategories(eventId: event.id),
        remote.listProducts(eventId: event.id),
      ]);
      if (!mounted) return;
      setState(() {
        _boundEventId = event.id;
        _event = event;
        _categories = results[0] as List<StoreCategoryEntity>;
        _products = results[1] as List<StoreProductEntity>;
        _status = _LoadStatus.success;
        _errorMessage = null;
      });
    } on NetworkException catch (error) {
      if (!mounted) return;
      _handleFailure(isOffline: true, message: error.message, keepContent: hadContent);
    } on ServerException catch (error) {
      if (!mounted) return;
      _handleFailure(isOffline: false, message: error.message, keepContent: hadContent);
    } catch (_) {
      if (!mounted) return;
      _handleFailure(
        isOffline: false,
        message: 'Unexpected error',
        keepContent: hadContent,
      );
    }
  }

  void _handleFailure({
    required bool isOffline,
    required String message,
    required bool keepContent,
  }) {
    if (keepContent) {
      setState(() => _status = _LoadStatus.success);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(message),
          backgroundColor: AppColors.bgMaroon,
          behavior: SnackBarBehavior.floating,
        ),
      );
      return;
    }
    setState(() {
      _errorMessage = message;
      _status = isOffline ? _LoadStatus.offline : _LoadStatus.error;
    });
  }

  List<SearchSuggestionItem> _suggestionsFor(String draft) {
    return _products
        .where((product) => product.matchesSearch(draft))
        .map(
          (product) => SearchSuggestionItem(
            id: product.id,
            title: product.name,
            subtitle: formatStoreMoney(product.price, product.currency),
          ),
        )
        .toList(growable: false);
  }

  @override
  Widget build(BuildContext context) {
    final sidePad = context.pagePadding.left;

    return BlocListener<SelectedEventCubit, SelectedEventState>(
      listenWhen: (prev, next) =>
          next.eventId != null &&
          next.eventId!.isNotEmpty &&
          prev.eventId != next.eventId,
      listener: (context, state) {
        if (state.eventId == _boundEventId) return;
        unawaited(_load(isRefresh: false));
      },
      child: Scaffold(
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
              context.go('/');
            }
          },
        ),
        title: Text(
          'Store',
          style: AppTypography.body.copyWith(
            fontWeight: FontWeight.w600,
            fontSize: 17,
          ),
        ),
      ),
      body: RefreshIndicator(
        color: AppColors.accentPink,
        onRefresh: () => _load(isRefresh: true),
        child: switch (_status) {
          _LoadStatus.loading => const Center(
              child: CircularProgressIndicator(color: AppColors.accentPink),
            ),
          _LoadStatus.offline => LoadErrorView(
              kind: LoadErrorKind.offline,
              message: _errorMessage,
              onRetry: () => _load(isRefresh: false),
            ),
          _LoadStatus.error => LoadErrorView(
              kind: LoadErrorKind.generic,
              message: _errorMessage,
              onRetry: () => _load(isRefresh: false),
            ),
          _LoadStatus.refreshing || _LoadStatus.success => _buildBody(sidePad),
        },
      ),
    ),
    );
  }

  Widget _buildBody(double sidePad) {
    final visible = _visibleProducts;
    final refreshing = _status == _LoadStatus.refreshing;

    return CustomScrollView(
      physics: const AlwaysScrollableScrollPhysics(
        parent: BouncingScrollPhysics(),
      ),
      slivers: [
        SliverToBoxAdapter(
          child: Padding(
            padding: EdgeInsets.fromLTRB(sidePad, 8, sidePad, 0),
            child: Center(
              child: ConstrainedBox(
                constraints: BoxConstraints(maxWidth: context.maxContentWidth),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Text(
                      'SHOP',
                      style: AppTypography.microLabel.copyWith(
                        color: AppColors.accentPink,
                        letterSpacing: 2.2,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      'Store',
                      style: AppTypography.headline.copyWith(fontSize: 28),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      'Browse products by category',
                      style: AppTypography.caption.copyWith(fontSize: 14),
                    ),
                    if (refreshing) ...[
                      const SizedBox(height: 12),
                      const LinearProgressIndicator(
                        color: AppColors.accentPink,
                        backgroundColor: AppColors.bgMaroon,
                        minHeight: 2,
                      ),
                    ],
                    const SizedBox(height: 20),
                    SuggestSearchField(
                      controller: _searchController,
                      appliedQuery: _searchQuery,
                      onAppliedChanged: (value) =>
                          setState(() => _searchQuery = value.trim()),
                      suggestionsFor: _suggestionsFor,
                      hintText: 'Search products',
                    ),
                    if (_filterCategories.isNotEmpty) ...[
                      const SizedBox(height: 16),
                      SizedBox(
                        height: 40,
                        child: ListView(
                          scrollDirection: Axis.horizontal,
                          children: [
                            _CategoryChip(
                              label: 'All',
                              selected: _selectedCategoryId == null,
                              onTap: () => setState(() => _selectedCategoryId = null),
                            ),
                            ..._filterCategories.map(
                              (category) => Padding(
                                padding: const EdgeInsets.only(left: 8),
                                child: _CategoryChip(
                                  label: category.name,
                                  selected: _selectedCategoryId == category.id,
                                  onTap: () => setState(
                                    () => _selectedCategoryId = category.id,
                                  ),
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                    const SizedBox(height: 20),
                  ],
                ),
              ),
            ),
          ),
        ),
        if (visible.isEmpty)
          SliverFillRemaining(
            hasScrollBody: false,
            child: Center(
              child: Padding(
                padding: EdgeInsets.symmetric(horizontal: sidePad),
                child: Text(
                  _selectedCategoryId != null
                      ? 'No products in this category.'
                      : _searchQuery.isEmpty
                          ? 'No products in the store yet.'
                          : 'No products match your search.',
                  textAlign: TextAlign.center,
                  style: AppTypography.caption,
                ),
              ),
            ),
          )
        else
          SliverPadding(
            padding: EdgeInsets.fromLTRB(sidePad, 0, sidePad, 28),
            sliver: SliverGrid(
              gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: 2,
                mainAxisSpacing: 12,
                crossAxisSpacing: 12,
                childAspectRatio: 0.72,
              ),
              delegate: SliverChildBuilderDelegate(
                (context, index) {
                  final product = visible[index];
                  return StoreProductCard(
                    product: product,
                    onTap: () => context.push(
                      '/store/products/${product.id}',
                      extra: product,
                    ),
                  );
                },
                childCount: visible.length,
              ),
            ),
          ),
      ],
    );
  }
}

class _CategoryChip extends StatelessWidget {
  const _CategoryChip({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(AppTheme.radiusChip),
        child: Ink(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
          decoration: BoxDecoration(
            color: selected ? AppColors.accentPink : AppColors.bgCard,
            borderRadius: BorderRadius.circular(AppTheme.radiusChip),
            border: Border.all(
              color: selected ? AppColors.accentPink : AppColors.borderSubtle,
            ),
          ),
          child: Text(
            label,
            style: AppTypography.caption.copyWith(
              fontWeight: FontWeight.w600,
              color: selected ? AppColors.bgBase : AppColors.textPrimary,
            ),
          ),
        ),
      ),
    );
  }
}
