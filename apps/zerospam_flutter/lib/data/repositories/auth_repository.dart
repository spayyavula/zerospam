import 'package:dio/dio.dart';
import 'package:openapi/openapi.dart' as api;
import '../../core/app_error.dart';

/// Wraps the generated MobileApi for auth calls; never leaks Dio/generated types.
class AuthRepository {
  AuthRepository(this._api);
  final api.MobileApi _api;

  /// Returns the login outcome: true => logged in, false => TOTP required.
  Future<bool> login({required String email, required String password, String? totp}) async {
    try {
      final body = api.LoginRequestBuilder()
        ..email = email
        ..password = password;
      if (totp != null) body.totp = totp;
      final res = await _api.login(loginRequest: body.build());
      // LoginResponse exposes both optional fields; ok == true means logged in.
      final data = res.data;
      return data?.ok == true;
    } on DioException catch (e) {
      throw AppError.fromDio(e);
    }
  }

  /// Registers this device and returns the bearer token.
  Future<String> registerDevice({required String name, String? platform}) async {
    try {
      final body = api.DeviceRegisterRequestBuilder()..name = name;
      if (platform != null) {
        body.platform = api.DeviceRegisterRequestPlatformEnum.valueOf(platform);
      }
      final res = await _api.registerDevice(deviceRegisterRequest: body.build());
      final token = res.data?.token;
      if (token == null) throw AppError(AppErrorKind.unknown, 'No token returned');
      return token;
    } on DioException catch (e) {
      throw AppError.fromDio(e);
    }
  }

  Future<api.AuthMe> me() async {
    try {
      final res = await _api.getMe();
      return res.data!;
    } on DioException catch (e) {
      throw AppError.fromDio(e);
    }
  }
}
