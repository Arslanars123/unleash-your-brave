import 'package:unleash_your_brave/core/error/exceptions.dart';
import 'package:unleash_your_brave/core/network/token_storage.dart';
import 'package:unleash_your_brave/features/auth/data/models/user_model.dart';

class AuthLocalDataSource {
  AuthLocalDataSource(this._tokenStorage);

  final TokenStorage _tokenStorage;

  Future<void> cacheSession({
    required UserModel user,
    required String accessToken,
    required String refreshToken,
  }) async {
    await _tokenStorage.saveTokens(accessToken: accessToken, refreshToken: refreshToken);
    await cacheUser(user);
  }

  Future<void> cacheUser(UserModel user) async {
    await _tokenStorage.saveCachedUser(user.encode());
  }

  Future<UserModel?> readCachedUser() async {
    final raw = await _tokenStorage.readCachedUser();
    if (raw == null) return null;
    try {
      return UserModel.decode(raw);
    } catch (_) {
      throw const CacheException('Corrupt cached user');
    }
  }

  Future<bool> hasTokens() async {
    final token = await _tokenStorage.readAccessToken();
    return token != null && token.isNotEmpty;
  }

  Future<void> clear() => _tokenStorage.clear();
}
