import 'package:dio/dio.dart';
import 'package:openapi/openapi.dart' as api;
import '../../core/app_error.dart';

class MailboxRepository {
  MailboxRepository(this._api);
  final api.MobileApi _api;

  Future<List<api.Mailbox>> list() async {
    try {
      final res = await _api.listMailboxes();
      return res.data?.toList() ?? <api.Mailbox>[];
    } on DioException catch (e) {
      throw AppError.fromDio(e);
    }
  }

  Future<api.MailboxCounts> counts(int mailboxId) async {
    try {
      final res = await _api.getMailboxCounts(id: mailboxId);
      return res.data!;
    } on DioException catch (e) {
      throw AppError.fromDio(e);
    }
  }
}
