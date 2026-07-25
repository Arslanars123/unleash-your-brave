import 'package:shared_preferences/shared_preferences.dart';
import 'package:unleash_your_brave/core/constants/app_constants.dart';

class TokenStorage {
  TokenStorage(this._prefs);

  final SharedPreferences _prefs;

  Future<void> saveTokens({
    required String accessToken,
    required String refreshToken,
  }) async {
    await _prefs.setString(StorageKeys.accessToken, accessToken);
    await _prefs.setString(StorageKeys.refreshToken, refreshToken);
  }

  Future<String?> readAccessToken() async {
    return _prefs.getString(StorageKeys.accessToken);
  }

  Future<String?> readRefreshToken() async {
    return _prefs.getString(StorageKeys.refreshToken);
  }

  Future<void> saveCachedUser(String json) async {
    await _prefs.setString(StorageKeys.cachedUser, json);
  }

  Future<String?> readCachedUser() async {
    return _prefs.getString(StorageKeys.cachedUser);
  }

  Future<void> clear() async {
    await _prefs.remove(StorageKeys.accessToken);
    await _prefs.remove(StorageKeys.refreshToken);
    await _prefs.remove(StorageKeys.cachedUser);
  }
}
