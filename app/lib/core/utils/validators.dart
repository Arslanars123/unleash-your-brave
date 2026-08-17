/// Reusable form validators shared by the auth screens.
/// Messages are user-facing and match a "big app" tone.
abstract final class Validators {
  static final RegExp _emailRegExp = RegExp(
    r"^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$",
  );

  static const int minPasswordLength = 8;
  static const int maxPasswordLength = 128;

  static String? email(String? value) {
    final email = value?.trim() ?? '';
    if (email.isEmpty) return 'Email is required';
    if (!_emailRegExp.hasMatch(email)) return 'Enter a valid email address';
    return null;
  }

  static String? name(String? value) {
    final name = value?.trim() ?? '';
    if (name.isEmpty) return 'Name is required';
    if (name.length < 2) return 'Name must be at least 2 characters';
    if (name.length > 80) return 'Name is too long';
    return null;
  }

  /// Login secret — password or invite code (server decides which).
  static String? loginPassword(String? value) {
    if (value == null || value.isEmpty) {
      return 'Password or invite code is required';
    }
    return null;
  }

  /// Server message when an invite code is entered after password setup.
  static bool isInviteAlreadyUsedMessage(String message) {
    final lower = message.toLowerCase();
    return lower.contains('already used your invite') ||
        lower.contains('invite_already_used');
  }

  /// Signup password — enforces the backend policy client-side.
  static String? signupPassword(String? value) {
    final password = value ?? '';
    if (password.isEmpty) return 'Password is required';
    if (password.length < minPasswordLength) {
      return 'Password must be at least $minPasswordLength characters';
    }
    if (password.length > maxPasswordLength) {
      return 'Password is too long';
    }
    return null;
  }

  static String? confirmPassword(String? value, String original) {
    if (value == null || value.isEmpty) return 'Confirm your password';
    if (value != original) return 'Passwords do not match';
    return null;
  }
}

enum PasswordStrength { empty, weak, fair, good, strong }

extension PasswordStrengthLabel on PasswordStrength {
  String get label => switch (this) {
        PasswordStrength.empty => '',
        PasswordStrength.weak => 'Weak',
        PasswordStrength.fair => 'Fair',
        PasswordStrength.good => 'Good',
        PasswordStrength.strong => 'Strong',
      };

  /// 0..4 filled segments for the strength meter.
  int get segments => switch (this) {
        PasswordStrength.empty => 0,
        PasswordStrength.weak => 1,
        PasswordStrength.fair => 2,
        PasswordStrength.good => 3,
        PasswordStrength.strong => 4,
      };
}

/// Advisory strength score used by the signup meter.
PasswordStrength estimatePasswordStrength(String password) {
  if (password.isEmpty) return PasswordStrength.empty;

  var score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (RegExp(r'[A-Z]').hasMatch(password) && RegExp(r'[a-z]').hasMatch(password)) {
    score++;
  }
  if (RegExp(r'\d').hasMatch(password)) score++;
  if (RegExp(r'[^A-Za-z0-9]').hasMatch(password)) score++;

  return switch (score) {
    <= 1 => PasswordStrength.weak,
    2 => PasswordStrength.fair,
    3 => PasswordStrength.good,
    _ => PasswordStrength.strong,
  };
}
