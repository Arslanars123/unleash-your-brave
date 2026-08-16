class MembershipEntity {
  const MembershipEntity({
    required this.id,
    required this.eventId,
    required this.name,
    required this.valueLink,
    required this.price,
    required this.description,
    this.features = const [],
    this.paymentPlanNote = '',
    this.featured = false,
    this.tierRank = 0,
    this.sortOrder = 0,
  });

  final String id;
  final String eventId;
  final String name;
  final String valueLink;
  final double price;
  final String description;
  final List<String> features;
  final String paymentPlanNote;
  final bool featured;
  final int tierRank;
  final int sortOrder;

  /// Rank used for upgrade rules (tierRank when set, otherwise price).
  double get upgradeRank => tierRank > 0 ? tierRank.toDouble() : price;

  String get priceLabel {
    if (price <= 0) return 'Free';
    final whole = price == price.roundToDouble();
    return whole ? '\$${price.toStringAsFixed(0)}' : '\$${price.toStringAsFixed(2)}';
  }
}

class CheckoutEligibility {
  const CheckoutEligibility({
    required this.allowed,
    required this.kind,
    required this.targetMembershipId,
    required this.targetMembershipName,
    required this.targetMembershipPrice,
    required this.eventId,
    this.reason,
    this.currentMembershipId,
    this.currentMembershipName,
    this.currentMembershipPrice,
  });

  final bool allowed;
  final String? reason;
  final String? kind;
  final String? currentMembershipId;
  final String? currentMembershipName;
  final double? currentMembershipPrice;
  final String targetMembershipId;
  final String targetMembershipName;
  final double targetMembershipPrice;
  final String eventId;
}

class CheckoutSessionResult {
  const CheckoutSessionResult({
    required this.sessionId,
    required this.checkoutUrl,
    required this.kind,
    required this.membershipId,
    required this.membershipName,
    required this.price,
    required this.currency,
    required this.eventId,
  });

  final String sessionId;
  final String checkoutUrl;
  final String kind;
  final String membershipId;
  final String membershipName;
  final double price;
  final String currency;
  final String eventId;
}
