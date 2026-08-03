class ApiConstants {
  const ApiConstants._();

  static const login = '/auth/login';
  static const register = '/auth/register';
  static const me = '/auth/me';
  static const refresh = '/auth/refresh';
  static const changePassword = '/auth/change-password';
  static const currentEvent = '/events/current';
  static const sessions = '/sessions';
}

class StorageKeys {
  const StorageKeys._();

  static const accessToken = 'access_token';
  static const refreshToken = 'refresh_token';
  static const cachedUser = 'cached_user';
  static const cachedAgendaEvent = 'cached_agenda_event';
  static const cachedAgendaSessionsPrefix = 'cached_agenda_sessions_';
  static const cachedAgendaDayIndexPrefix = 'cached_agenda_day_index_';
}
