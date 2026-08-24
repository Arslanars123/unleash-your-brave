import 'package:unleash_your_brave/features/store/domain/entities/store_entity.dart';

class StoreCategoryModel extends StoreCategoryEntity {
  const StoreCategoryModel({
    required super.id,
    required super.eventId,
    required super.name,
    required super.description,
    required super.image,
    required super.sortOrder,
    required super.isActive,
    required super.productCount,
  });

  factory StoreCategoryModel.fromJson(Map<String, dynamic> json) {
    return StoreCategoryModel(
      id: json['id'] as String,
      eventId: json['eventId'] as String? ?? '',
      name: json['name'] as String? ?? '',
      description: json['description'] as String? ?? '',
      image: json['image'] as String? ?? '',
      sortOrder: (json['sortOrder'] as num?)?.toInt() ?? 0,
      isActive: json['isActive'] as bool? ?? true,
      productCount: (json['productCount'] as num?)?.toInt() ?? 0,
    );
  }
}

class StoreProductModel extends StoreProductEntity {
  const StoreProductModel({
    required super.id,
    required super.eventId,
    super.categoryId,
    super.categoryName,
    required super.name,
    required super.description,
    required super.sku,
    required super.price,
    super.compareAtPrice,
    required super.currency,
    required super.images,
    required super.trackInventory,
    required super.stockQty,
    required super.lowStockThreshold,
    required super.inStock,
    required super.isLowStock,
    required super.isActive,
    required super.featured,
    required super.sortOrder,
  });

  factory StoreProductModel.fromJson(Map<String, dynamic> json) {
    final imagesJson = json['images'];
    final stockQty = (json['stockQty'] as num?)?.toInt() ?? 0;
    final inStock = json['inStock'] as bool? ?? stockQty > 0;
    return StoreProductModel(
      id: json['id'] as String,
      eventId: json['eventId'] as String? ?? '',
      categoryId: json['categoryId'] as String?,
      categoryName: json['categoryName'] as String?,
      name: json['name'] as String? ?? '',
      description: json['description'] as String? ?? '',
      sku: json['sku'] as String? ?? '',
      price: (json['price'] as num?)?.toDouble() ?? 0,
      compareAtPrice: (json['compareAtPrice'] as num?)?.toDouble(),
      currency: json['currency'] as String? ?? 'USD',
      images: imagesJson is List
          ? imagesJson.whereType<String>().toList(growable: false)
          : const [],
      trackInventory: json['trackInventory'] as bool? ?? true,
      stockQty: stockQty,
      lowStockThreshold: (json['lowStockThreshold'] as num?)?.toInt() ?? 5,
      inStock: inStock,
      isLowStock: json['isLowStock'] as bool? ?? false,
      isActive: json['isActive'] as bool? ?? true,
      featured: json['featured'] as bool? ?? false,
      sortOrder: (json['sortOrder'] as num?)?.toInt() ?? 0,
    );
  }
}
