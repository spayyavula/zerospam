import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:openapi/openapi.dart' as api;
import 'package:zerospam_flutter/core/app_error.dart';
import 'package:zerospam_flutter/data/repositories/mailbox_repository.dart';

class _MockMobileApi extends Mock implements api.MobileApi {}

void main() {
  test('counts returns mailbox counts', () async {
    final mobileApi = _MockMobileApi();
    final repo = MailboxRepository(mobileApi);
    api.MailboxCountsInbox count(int total, int unread) =>
        (api.MailboxCountsInboxBuilder()
              ..total = total
              ..unread = unread)
            .build();
    final counts =
        (api.MailboxCountsBuilder()
              ..inbox = count(10, 2).toBuilder()
              ..screener = count(0, 0).toBuilder()
              ..quarantine = count(3, 1).toBuilder()
              ..sent = count(4, 0).toBuilder()
              ..trash = count(5, 1).toBuilder()
              ..drafts = count(0, 0).toBuilder())
            .build();
    when(() => mobileApi.getMailboxCounts(id: 1)).thenAnswer(
      (_) async => Response<api.MailboxCounts>(
        requestOptions: RequestOptions(path: '/api/mailboxes/1/counts'),
        statusCode: 200,
        data: counts,
      ),
    );

    final result = await repo.counts(1);

    expect(result, counts);
  });

  test('counts maps a 404 to AppError.notFound', () async {
    final mobileApi = _MockMobileApi();
    final repo = MailboxRepository(mobileApi);
    when(() => mobileApi.getMailboxCounts(id: 1)).thenThrow(
      DioException(
        requestOptions: RequestOptions(path: '/api/mailboxes/1/counts'),
        response: Response(
          requestOptions: RequestOptions(path: '/api/mailboxes/1/counts'),
          statusCode: 404,
          data: {'error': 'mailbox not found'},
        ),
      ),
    );

    expect(
      () => repo.counts(1),
      throwsA(
        isA<AppError>().having((e) => e.kind, 'kind', AppErrorKind.notFound),
      ),
    );
  });
}
