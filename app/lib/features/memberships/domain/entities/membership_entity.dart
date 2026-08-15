class MembershipEntity {
  const MembershipEntity({
    required this.id,
    required this.eventId,
    required this.name,
    required this.valueLink,
    required this.price,
    required this.description,
  });

  final String id;
  final String eventId;
  final String name;
  final String valueLink;
  final double price;
  final String description;

  String get priceLabel {
    if (price <= 0) return 'Free';
    final whole = price == price.roundToDouble();
    return whole ? '\$${price.toStringAsFixed(0)}' : '\$${price.toStringAsFixed(2)}';
  }
}
