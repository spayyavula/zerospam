import 'package:cookie_jar/cookie_jar.dart';
import 'package:dio/dio.dart';
import 'package:dio_cookie_manager/dio_cookie_manager.dart';
import 'package:flutter/foundation.dart' show kIsWeb;
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
    // Web: ask the browser XHR to attach the session cookie that /api/auth/login
    // sets, so the follow-up /api/auth/devices call (which requires that session)
    // is authenticated. The server must also include the app origin in
    // ALLOWED_ORIGINS for credentialed CORS. CookieManager is a no-op on web.
    extra: kIsWeb ? const {'withCredentials': true} : const {},
  ));
  if (!kIsWeb) {
    // Mobile/desktop: persist the login session cookie in memory and resend it
    // so device registration succeeds before we hold a bearer token. Must run
    // before the bearer AuthInterceptor.
    dio.interceptors.add(CookieManager(CookieJar()));
  }
  dio.interceptors.add(AuthInterceptor(tokenStore, onUnauthorized: onUnauthorized));
  return dio;
}
