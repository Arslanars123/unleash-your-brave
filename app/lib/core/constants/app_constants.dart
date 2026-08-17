class ApiConstants {
  const ApiConstants._();

  static const login = '/auth/login';
  static const register = '/auth/register';
  static const me = '/auth/me';
  static const refresh = '/auth/refresh';
  static const changePassword = '/auth/change-password';
  static const forgotPassword = '/auth/forgot-password';
  static const verifyResetOtp = '/auth/verify-reset-otp';
  static const resetPassword = '/auth/reset-password';
  static const updateMyProfile = '/users/me';
  static const uploadImage = '/uploads/images';
  static const currentEvent = '/events/current';
  static const sessions = '/sessions';
  static const announcements = '/announcements';
  static const announcementsFeed = '/announcements/feed';
  static const announcementsUnreadCount = '/announcements/unread-count';
  static const checkInMyQr = '/checkins/my-qr';
  static const posts = '/posts';
  static const memberships = '/memberships';
  static const accessMe = '/access/me';
  static const upgradeMyMembership = '/users/me/membership';
  static const checkoutCatalog = '/checkout/catalog';
  static const checkoutEligibility = '/checkout/eligibility';
  static const checkoutSessions = '/checkout/sessions';
  static const couponsPreview = '/coupons/preview';

  /// Stripe success / cancel pages on the marketing site.
  static const checkoutSuccessUrl =
      'https://www.fittoprofit.com/checkout/success?session_id={CHECKOUT_SESSION_ID}';
  static const checkoutCancelUrl = 'https://www.fittoprofit.com/checkout';

  // Chat endpoints
  static const chatGroup = '/chat/group';
  static const chatMembers = '/chat/members';
  static const chatMessages = '/chat/messages';
  static const chatDelivered = '/chat/delivered';
  static const chatRead = '/chat/read';
  static const chatSync = '/chat/sync';
  static const chatStream = '/chat/stream';
  static const chatWs = '/chat/ws';
  static const chatDevices = '/chat/devices';
}

class StorageKeys {
  const StorageKeys._();

  static const accessToken = 'access_token';
  static const refreshToken = 'refresh_token';
  static const cachedUser = 'cached_user';
  static const cachedAgendaEvent = 'cached_agenda_event';
  static const cachedAgendaSessionsPrefix = 'cached_agenda_sessions_';
  static const cachedAgendaDayIndexPrefix = 'cached_agenda_day_index_';
  
  // Chat storage keys
  static const cachedChatGroup = 'cached_chat_group';
  static const chatUnreadCount = 'chat_unread_count';
  static const chatLastSync = 'chat_last_sync';
  static const fcmToken = 'fcm_token';
  static const pushNotificationsEnabled = 'push_notifications_enabled';
  static const onboardingCompleted = 'onboarding_completed';
}
