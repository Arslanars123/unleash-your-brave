class ApiConstants {
  const ApiConstants._();

  static const login = '/auth/login';
  static const register = '/auth/register';
  static const me = '/auth/me';
  static const refresh = '/auth/refresh';
}

class StorageKeys {
  const StorageKeys._();

  static const accessToken = 'access_token';
  static const refreshToken = 'refresh_token';
  static const cachedUser = 'cached_user';
}
