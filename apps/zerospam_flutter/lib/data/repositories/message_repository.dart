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

  Future<api.MessageDetail> get(String id) async {
    try {
      final res = await _api.getMessage(id: id);
      return res.data!;
    } on DioException catch (e) {
      throw AppError.fromDio(e);
    }
  }
}
