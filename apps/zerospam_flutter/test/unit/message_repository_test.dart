import 'package:dio/dio.dart';
import 'package:built_collection/built_collection.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:openapi/openapi.dart' as api;
import 'package:zerospam_flutter/core/app_error.dart';
import 'package:zerospam_flutter/data/repositories/message_repository.dart';

class _MockMobileApi extends Mock implements api.MobileApi {}

void main() {
  test('markRead sends the requested read state', () async {
    final mobileApi = _MockMobileApi();
    final repo = MessageRepository(mobileApi);
    final expectedReq = (api.MarkReadRequestBuilder()..read = false).build();
    when(
      () => mobileApi.markRead(id: 'msg_1', markReadRequest: expectedReq),
    ).thenAnswer(
      (_) async => Response<api.OkResponse>(
        requestOptions: RequestOptions(path: '/api/messages/msg_1/read'),
        statusCode: 200,
        data: (api.OkResponseBuilder()..ok = true).build(),
      ),
    );

    await repo.markRead('msg_1', read: false);

    verify(
      () => mobileApi.markRead(id: 'msg_1', markReadRequest: expectedReq),
    ).called(1);
  });

  test('markRead maps a 401 to AppError.unauthorized', () async {
    final mobileApi = _MockMobileApi();
    final repo = MessageRepository(mobileApi);
    final expectedReq = (api.MarkReadRequestBuilder()..read = true).build();
    when(
      () => mobileApi.markRead(id: 'msg_1', markReadRequest: expectedReq),
    ).thenThrow(
      DioException(
        requestOptions: RequestOptions(path: '/api/messages/msg_1/read'),
        response: Response(
          requestOptions: RequestOptions(path: '/api/messages/msg_1/read'),
          statusCode: 401,
          data: {'error': 'unauthorized'},
        ),
      ),
    );

    expect(
      () => repo.markRead('msg_1'),
      throwsA(
        isA<AppError>().having(
          (e) => e.kind,
          'kind',
          AppErrorKind.unauthorized,
        ),
      ),
    );
  });

  test('setStarred sends the requested starred state', () async {
    final mobileApi = _MockMobileApi();
    final repo = MessageRepository(mobileApi);
    final expectedReq = (api.StarMessageRequestBuilder()..starred = true)
        .build();
    when(
      () => mobileApi.starMessage(id: 'msg_1', starMessageRequest: expectedReq),
    ).thenAnswer(
      (_) async => Response<api.OkResponse>(
        requestOptions: RequestOptions(path: '/api/messages/msg_1/star'),
        statusCode: 200,
        data: (api.OkResponseBuilder()..ok = true).build(),
      ),
    );

    await repo.setStarred('msg_1', starred: true);

    verify(
      () => mobileApi.starMessage(id: 'msg_1', starMessageRequest: expectedReq),
    ).called(1);
  });

  test('setStarred maps a 401 to AppError.unauthorized', () async {
    final mobileApi = _MockMobileApi();
    final repo = MessageRepository(mobileApi);
    final expectedReq = (api.StarMessageRequestBuilder()..starred = false)
        .build();
    when(
      () => mobileApi.starMessage(id: 'msg_1', starMessageRequest: expectedReq),
    ).thenThrow(
      DioException(
        requestOptions: RequestOptions(path: '/api/messages/msg_1/star'),
        response: Response(
          requestOptions: RequestOptions(path: '/api/messages/msg_1/star'),
          statusCode: 401,
          data: {'error': 'unauthorized'},
        ),
      ),
    );

    expect(
      () => repo.setStarred('msg_1', starred: false),
      throwsA(
        isA<AppError>().having(
          (e) => e.kind,
          'kind',
          AppErrorKind.unauthorized,
        ),
      ),
    );
  });

  test('move sends the requested folder', () async {
    final mobileApi = _MockMobileApi();
    final repo = MessageRepository(mobileApi);
    final expectedReq =
        (api.MoveMessageRequestBuilder()
              ..folder = api.MoveMessageRequestFolderEnum.trash)
            .build();
    when(
      () => mobileApi.moveMessage(id: 'msg_1', moveMessageRequest: expectedReq),
    ).thenAnswer(
      (_) async => Response<api.OkResponse>(
        requestOptions: RequestOptions(path: '/api/messages/msg_1/move'),
        statusCode: 200,
        data: (api.OkResponseBuilder()..ok = true).build(),
      ),
    );

    await repo.move('msg_1', folder: 'trash');

    verify(
      () => mobileApi.moveMessage(id: 'msg_1', moveMessageRequest: expectedReq),
    ).called(1);
  });

  test('move maps a 401 to AppError.unauthorized', () async {
    final mobileApi = _MockMobileApi();
    final repo = MessageRepository(mobileApi);
    final expectedReq =
        (api.MoveMessageRequestBuilder()
              ..folder = api.MoveMessageRequestFolderEnum.inbox)
            .build();
    when(
      () => mobileApi.moveMessage(id: 'msg_1', moveMessageRequest: expectedReq),
    ).thenThrow(
      DioException(
        requestOptions: RequestOptions(path: '/api/messages/msg_1/move'),
        response: Response(
          requestOptions: RequestOptions(path: '/api/messages/msg_1/move'),
          statusCode: 401,
          data: {'error': 'unauthorized'},
        ),
      ),
    );

    expect(
      () => repo.move('msg_1', folder: 'inbox'),
      throwsA(
        isA<AppError>().having(
          (e) => e.kind,
          'kind',
          AppErrorKind.unauthorized,
        ),
      ),
    );
  });

  test('delete calls deleteMessage', () async {
    final mobileApi = _MockMobileApi();
    final repo = MessageRepository(mobileApi);
    when(() => mobileApi.deleteMessage(id: 'msg_1')).thenAnswer(
      (_) async => Response<api.OkResponse>(
        requestOptions: RequestOptions(path: '/api/messages/msg_1'),
        statusCode: 200,
        data: (api.OkResponseBuilder()..ok = true).build(),
      ),
    );

    await repo.delete('msg_1');

    verify(() => mobileApi.deleteMessage(id: 'msg_1')).called(1);
  });

  test('delete maps a 401 to AppError.unauthorized', () async {
    final mobileApi = _MockMobileApi();
    final repo = MessageRepository(mobileApi);
    when(() => mobileApi.deleteMessage(id: 'msg_1')).thenThrow(
      DioException(
        requestOptions: RequestOptions(path: '/api/messages/msg_1'),
        response: Response(
          requestOptions: RequestOptions(path: '/api/messages/msg_1'),
          statusCode: 401,
          data: {'error': 'unauthorized'},
        ),
      ),
    );

    expect(
      () => repo.delete('msg_1'),
      throwsA(
        isA<AppError>().having(
          (e) => e.kind,
          'kind',
          AppErrorKind.unauthorized,
        ),
      ),
    );
  });

  test('search returns search messages', () async {
    final mobileApi = _MockMobileApi();
    final repo = MessageRepository(mobileApi);
    final result =
        (api.SearchMessageBuilder()
              ..id = 'msg_1'
              ..mailboxId = 1
              ..folder = api.SearchMessageFolderEnum.inbox
              ..fromAddress = 'sender@example.com'
              ..receivedAt = 123
              ..read = 0
              ..starred = 1
              ..attachmentCount = 0)
            .build();
    when(
      () => mobileApi.searchMessages(
        mailboxId: 1,
        q: 'boss',
        folder: 'inbox',
        limit: 50,
      ),
    ).thenAnswer(
      (_) async => Response<BuiltList<api.SearchMessage>>(
        requestOptions: RequestOptions(path: '/api/search'),
        statusCode: 200,
        data: BuiltList<api.SearchMessage>([result]),
      ),
    );

    final rows = await repo.search(
      mailboxId: 1,
      query: 'boss',
      folder: 'inbox',
    );

    expect(rows, [result]);
  });

  test('search maps a 401 to AppError.unauthorized', () async {
    final mobileApi = _MockMobileApi();
    final repo = MessageRepository(mobileApi);
    when(
      () => mobileApi.searchMessages(
        mailboxId: 1,
        q: 'boss',
        folder: 'inbox',
        limit: 50,
      ),
    ).thenThrow(
      DioException(
        requestOptions: RequestOptions(path: '/api/search'),
        response: Response(
          requestOptions: RequestOptions(path: '/api/search'),
          statusCode: 401,
          data: {'error': 'unauthorized'},
        ),
      ),
    );

    expect(
      () => repo.search(mailboxId: 1, query: 'boss', folder: 'inbox'),
      throwsA(
        isA<AppError>().having(
          (e) => e.kind,
          'kind',
          AppErrorKind.unauthorized,
        ),
      ),
    );
  });

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
      throwsA(
        isA<AppError>().having((e) => e.kind, 'kind', AppErrorKind.notFound),
      ),
    );
  });
}
