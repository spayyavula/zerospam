import 'package:dio/dio.dart';
import 'auth_interceptor.dart';
import 'token_store.dart';

/// Base URL: override with --dart-define=API_BASE_URL=...
/// Defaults to localhost:8025; Android emulators must use 10.0.2.2.
const _defaultBaseUrl = String.fromEnvironment(
  'API_BASE_URL',
  defaultValue: 'http://localhost:8025',
);

Dio buildDio(TokenStore tokenStore, {void Function()? onUnauthorized, String? baseUrl}) {
  final dio = Dio(BaseOptions(
    baseUrl: baseUrl ?? _defaultBaseUrl,
    connectTimeout: const Duration(seconds: 15),
    receiveTimeout: const Duration(seconds: 15),
    headers: {'Content-Type': 'application/json'},
  ));
  dio.interceptors.add(AuthInterceptor(tokenStore, onUnauthorized: onUnauthorized));
  return dio;
}
