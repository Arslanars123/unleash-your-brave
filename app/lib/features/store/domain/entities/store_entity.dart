class StoreCategoryEntity {
  const StoreCategoryEntity({
    required this.id,
    required this.name,
    required this.description,
    required this.image,
    required this.sortOrder,
    required this.isActive,
    required this.productCount,
  });

  final String id;
  final String name;
  final String description;
  final String image;
  final int sortOrder;
  final bool isActive;
  final int productCount;
}

class StoreProductEntity {
  const StoreProductEntity({
    required this.id,
    this.categoryId,
    this.categoryName,
    required this.name,
    required this.description,
    required this.sku,
    required this.price,
    this.compareAtPrice,
    required this.currency,
    required this.images,
    required this.trackInventory,
    required this.stockQty,
    required this.lowStockThreshold,
    required this.inStock,
    required this.isLowStock,
    required this.isActive,
    required this.featured,
    required this.sortOrder,
  });

  final String id;
  final String? categoryId;
  final String? categoryName;
  final String name;
  final String description;
  final String sku;
  final double price;
  final double? compareAtPrice;
  final String currency;
  final List<String> images;
  final bool trackInventory;
  final int stockQty;
  final int lowStockThreshold;
  final bool inStock;
  final bool isLowStock;
  final bool isActive;
  final bool featured;
  final int sortOrder;

  String get primaryImage => images.isEmpty ? '' : images.first;

  bool matchesSearch(String rawQuery) {
    final query = rawQuery.trim().toLowerCase();
    if (query.isEmpty) return true;
    if (name.toLowerCase().contains(query)) return true;
    if (description.toLowerCase().contains(query)) return true;
    if (sku.toLowerCase().contains(query)) return true;
    if ((categoryName ?? '').toLowerCase().contains(query)) return true;
    return false;
  }
}

class StoreCheckoutSessionResult {
  const StoreCheckoutSessionResult({
    required this.sessionId,
    required this.checkoutUrl,
    required this.productId,
    required this.productName,
    required this.quantity,
    required this.unitPrice,
    required this.totalPrice,
    required this.currency,
  });

  final String sessionId;
  final String checkoutUrl;
  final String productId;
  final String productName;
  final int quantity;
  final double unitPrice;
  final double totalPrice;
  final String currency;
}

class StoreOrderEntity {
  const StoreOrderEntity({
    required this.id,
    required this.productName,
    required this.quantity,
    required this.totalPrice,
    required this.currency,
    required this.purchasedAt,
    required this.fulfillmentStatus,
    required this.deliveryAddress,
    required this.contactPhone,
  });

  final String id;
  final String productName;
  final int quantity;
  final double totalPrice;
  final String currency;
  final DateTime purchasedAt;
  final String fulfillmentStatus;
  final String deliveryAddress;
  final String contactPhone;

  bool get isDelivered => fulfillmentStatus == 'completed';

  String get statusLabel => isDelivered ? 'Delivered' : 'Pending';
}
