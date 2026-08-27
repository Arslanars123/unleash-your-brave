class CheckInFormFieldEntity {
  const CheckInFormFieldEntity({
    required this.id,
    required this.label,
    required this.type,
    required this.required,
    required this.sortOrder,
  });

  final String id;
  final String label;

  /// text | textarea | checkbox | yes_no
  final String type;
  final bool required;
  final int sortOrder;
}

class CheckInFormEntity {
  const CheckInFormEntity({
    required this.id,
    required this.eventId,
    required this.title,
    required this.description,
    required this.fields,
    required this.requireSignature,
    required this.isActive,
  });

  final String id;
  final String eventId;
  final String title;
  final String description;
  final List<CheckInFormFieldEntity> fields;
  final bool requireSignature;
  final bool isActive;

  List<CheckInFormFieldEntity> get sortedFields {
    final copy = [...fields];
    copy.sort((a, b) => a.sortOrder.compareTo(b.sortOrder));
    return copy;
  }
}

class CheckInFormSubmissionEntity {
  const CheckInFormSubmissionEntity({
    required this.id,
    required this.formId,
    required this.eventId,
    required this.userId,
    this.checkInId,
    required this.signedName,
    required this.submittedAt,
  });

  final String id;
  final String formId;
  final String eventId;
  final String userId;
  final String? checkInId;
  final String signedName;
  final DateTime? submittedAt;
}
