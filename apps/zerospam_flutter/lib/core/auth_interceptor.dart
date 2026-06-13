import 'package:dio/dio.dart';
import 'token_store.dart';

/// Injects the device bearer token on every request. On a 401 it clears the
/// token and invokes [onUnauthorized] so the app can return to the login screen.
class AuthInterceptor extends Interceptor {
  AuthInterceptor(this._tokenStore, {this.onUnauthorized});
  final TokenStore _tokenStore;
  final void Function()? onUnauthorized;

  @override
  Future<void> onRequest(RequestOptions options, RequestInterceptorHandler handler) async {
    final token = await _tokenStore.read();
    if (token != null && token.isNotEmpty) {
      options.headers['Authorization'] = 'Bearer $token';
    }
    handler.next(options);
  }

  @override
  Future<void> onError(DioException err, ErrorInterceptorHandler handler) async {
    if (err.response?.statusCode == 401) {
      await _tokenStore.clear();
      onUnauthorized?.call();
    }
    handler.next(err);
  }
}
