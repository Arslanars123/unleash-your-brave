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
    this.validForFutureEvents = false,
    this.upgradeToMembershipId,
    this.billingKind = 'one_time',
    this.durationDays = 0,
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
  final bool validForFutureEvents;
  final String? upgradeToMembershipId;
  final String billingKind;
  final int durationDays;

  bool get isRenewable => billingKind == 'renewable';

  /// Rank used for upgrade rules (tierRank when set, otherwise price).
  double get upgradeRank => tierRank > 0 ? tierRank.toDouble() : price;

  String get priceLabel {
    if (price <= 0) return 'Free';
    final whole = price == price.roundToDouble();
    return whole ? '\$${price.toStringAsFixed(0)}' : '\$${price.toStringAsFixed(2)}';
  }
}

class EffectiveEventAccess {
  const EffectiveEventAccess({
    required this.eventId,
    required this.allowPreviousAttendeesAccess,
    required this.entitled,
    required this.qrEntitled,
    required this.carriedFromPrevious,
    required this.accessibleMembershipIds,
    required this.upgradeMembershipIds,
    this.effectiveMembershipId,
    this.effectiveMembershipName,
    this.sourceMembershipId,
    this.sourceMembershipName,
    this.validForFutureEvents = false,
    this.validForFutureQr = false,
  });

  final String eventId;
  final bool allowPreviousAttendeesAccess;
  final bool entitled;
  final bool qrEntitled;
  final bool carriedFromPrevious;
  final List<String> accessibleMembershipIds;
  final String? effectiveMembershipId;
  final String? effectiveMembershipName;
  final String? sourceMembershipId;
  final String? sourceMembershipName;
  final bool validForFutureEvents;
  final bool validForFutureQr;
  final List<String> upgradeMembershipIds;
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

class CouponPreview {
  const CouponPreview({
    required this.valid,
    required this.code,
    required this.membershipId,
    required this.originalPrice,
    required this.percentOff,
    required this.discountAmount,
    required this.finalPrice,
    this.reason,
    this.couponId,
  });

  final bool valid;
  final String? reason;
  final String code;
  final String? couponId;
  final String membershipId;
  final double originalPrice;
  final double percentOff;
  final double discountAmount;
  final double finalPrice;
}
