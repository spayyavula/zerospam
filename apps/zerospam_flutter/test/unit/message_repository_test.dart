import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:openapi/openapi.dart' as api;
import 'package:zerospam_flutter/core/app_error.dart';
import 'package:zerospam_flutter/data/repositories/message_repository.dart';

class _MockMobileApi extends Mock implements api.MobileApi {}

void main() {
  test('listInbox maps a 404 to AppError.notFound', () async {
    final mobileApi = _MockMobileApi();
    final repo = MessageRepository(mobileApi);
    when(() => mobileApi.listMessages(mailboxId: 1, folder: 'inbox')).thenThrow(
      DioException(
        requestOptions: RequestOptions(path: '/api/messages'),
        response: Response(
          requestOptions: RequestOptions(path: '/api/messages'),
          statusCode: 404,
          data: {'error': 'mailbox not found'},
        ),
      ),
    );
    expect(
      () => repo.listInbox(1),
      throwsA(isA<AppError>().having((e) => e.kind, 'kind', AppErrorKind.notFound)),
    );
  });
}
