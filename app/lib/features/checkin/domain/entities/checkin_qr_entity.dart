class CheckInQrEntity {
  const CheckInQrEntity({
    required this.eventId,
    required this.eventName,
    required this.eventStatus,
    required this.userId,
    required this.token,
    required this.checkedIn,
    required this.checkedInAt,
  });

  final String eventId;
  final String eventName;
  final String eventStatus;
  final String userId;
  final String token;
  final bool checkedIn;
  final DateTime? checkedInAt;
}
