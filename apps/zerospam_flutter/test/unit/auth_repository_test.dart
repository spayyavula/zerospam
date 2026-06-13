import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:openapi/openapi.dart' as api;
import 'package:zerospam_flutter/core/app_error.dart';
import 'package:zerospam_flutter/data/repositories/auth_repository.dart';

class _MockMobileApi extends Mock implements api.MobileApi {}

void main() {
  late _MockMobileApi mobileApi;
  late AuthRepository repo;

  setUp(() {
    mobileApi = _MockMobileApi();
    repo = AuthRepository(mobileApi);
  });

  test('registerDevice returns the token on success', () async {
    // built_value has value equality, so the concrete request matches the one
    // the repository builds internally — no need for any()/registerFallbackValue.
    final expectedReq = (api.DeviceRegisterRequestBuilder()
          ..name = 'ZeroSpam Flutter'
          ..platform = api.DeviceRegisterRequestPlatformEnum.android)
        .build();
    final resp = Response<api.DeviceRegisterResponse>(
      requestOptions: RequestOptions(path: '/api/auth/devices'),
      data: (api.DeviceRegisterResponseBuilder()..token = 'tok_123').build(),
      statusCode: 200,
    );
    when(() => mobileApi.registerDevice(deviceRegisterRequest: expectedReq))
        .thenAnswer((_) async => resp);

    final token = await repo.registerDevice(name: 'ZeroSpam Flutter', platform: 'android');
    expect(token, 'tok_123');
  });

  test('maps a 401 DioException to AppError.unauthorized', () async {
    when(() => mobileApi.getMe()).thenThrow(DioException(
      requestOptions: RequestOptions(path: '/api/auth/me'),
      response: Response(
        requestOptions: RequestOptions(path: '/api/auth/me'),
        statusCode: 401,
        data: {'error': 'unauthorized'},
      ),
    ));

    expect(
      () => repo.me(),
      throwsA(isA<AppError>().having((e) => e.kind, 'kind', AppErrorKind.unauthorized)),
    );
  });
}
