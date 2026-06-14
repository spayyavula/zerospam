import 'package:dio/dio.dart';
import 'package:openapi/openapi.dart' as api;
import '../../core/app_error.dart';

class MessageRepository {
  MessageRepository(this._api);
  final api.MobileApi _api;

  Future<List<api.MessageSummary>> listInbox(int mailboxId) async {
    return listMessages(mailboxId: mailboxId, folder: 'inbox');
  }

  Future<List<api.MessageSummary>> listMessages({
    required int mailboxId,
    required String folder,
  }) async {
    try {
      final res = await _api.listMessages(mailboxId: mailboxId, folder: folder);
      return res.data?.toList() ?? <api.MessageSummary>[];
    } on DioException catch (e) {
      throw AppError.fromDio(e);
    }
  }

  Future<List<api.SearchMessage>> search({
    required int mailboxId,
    required String query,
    String? folder,
    int limit = 50,
  }) async {
    try {
      final res = await _api.searchMessages(
        mailboxId: mailboxId,
        q: query,
        folder: folder,
        limit: limit,
      );
      return res.data?.toList() ?? <api.SearchMessage>[];
    } on DioException catch (e) {
      throw AppError.fromDio(e);
    }
  }

  Future<api.MessageDetail> get(String id) async {
    try {
      final res = await _api.getMessage(id: id);
      return res.data!;
    } on DioException catch (e) {
      throw AppError.fromDio(e);
    }
  }

  Future<void> markRead(String id, {bool read = true}) async {
    try {
      await _api.markRead(
        id: id,
        markReadRequest: (api.MarkReadRequestBuilder()..read = read).build(),
      );
    } on DioException catch (e) {
      throw AppError.fromDio(e);
    }
  }

  Future<void> setStarred(String id, {required bool starred}) async {
    try {
      await _api.starMessage(
        id: id,
        starMessageRequest: (api.StarMessageRequestBuilder()..starred = starred)
            .build(),
      );
    } on DioException catch (e) {
      throw AppError.fromDio(e);
    }
  }

  Future<void> move(String id, {required String folder}) async {
    try {
      await _api.moveMessage(
        id: id,
        moveMessageRequest:
            (api.MoveMessageRequestBuilder()..folder = _moveFolder(folder))
                .build(),
      );
    } on DioException catch (e) {
      throw AppError.fromDio(e);
    }
  }

  api.MoveMessageRequestFolderEnum _moveFolder(String folder) {
    return switch (folder) {
      'inbox' => api.MoveMessageRequestFolderEnum.inbox,
      'quarantine' => api.MoveMessageRequestFolderEnum.quarantine,
      'trash' => api.MoveMessageRequestFolderEnum.trash,
      _ => throw ArgumentError.value(
        folder,
        'folder',
        'Unsupported move target',
      ),
    };
  }

  Future<void> delete(String id) async {
    try {
      await _api.deleteMessage(id: id);
    } on DioException catch (e) {
      throw AppError.fromDio(e);
    }
  }
}
