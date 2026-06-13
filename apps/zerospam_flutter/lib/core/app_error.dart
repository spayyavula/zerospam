import 'package:dio/dio.dart';

enum AppErrorKind { unauthorized, notFound, validation, network, unknown }

/// UI-facing error. Repositories translate Dio/HTTP failures into this so the
/// rest of the app never sees Dio or generated-client exception types.
class AppError implements Exception {
  AppError(this.kind, this.message);
  final AppErrorKind kind;
  final String message;

  @override
  String toString() => 'AppError($kind): $message';

  /// zerospam returns `{ "error": "<message>" }` on failures (not the
  /// `{ success, error:{code,message} }` envelope), so we read `error`.
  static AppError fromDio(DioException e) {
    final status = e.response?.statusCode;
    final body = e.response?.data;
    final serverMsg =
        (body is Map && body['error'] is String) ? body['error'] as String : null;
    switch (status) {
      case 400:
      case 422:
        return AppError(AppErrorKind.validation, serverMsg ?? 'Invalid request');
      case 401:
        return AppError(AppErrorKind.unauthorized, serverMsg ?? 'Please sign in again');
      case 404:
        return AppError(AppErrorKind.notFound, serverMsg ?? 'Not found');
      default:
        if (e.type == DioExceptionType.connectionError ||
            e.type == DioExceptionType.connectionTimeout ||
            e.type == DioExceptionType.receiveTimeout) {
          return AppError(AppErrorKind.network, 'Network problem — check your connection');
        }
        return AppError(AppErrorKind.unknown, serverMsg ?? 'Something went wrong');
    }
  }
}
