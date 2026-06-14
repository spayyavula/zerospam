import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:zerospam_flutter/core/dio_client.dart';
import 'package:zerospam_flutter/core/token_store.dart';

class _FakeTokenStore implements TokenStore {
  @override
  Future<void> clear() async {}
  @override
  Future<String?> read() async => null;
  @override
  Future<void> write(String token) async {}
}

/// Captures the outgoing RequestOptions instead of hitting the network.
class _CapturingAdapter implements HttpClientAdapter {
  RequestOptions? last;
  @override
  Future<ResponseBody> fetch(RequestOptions options, Stream<Uint8List>? requestStream,
      Future<void>? cancelFuture) async {
    last = options;
    return ResponseBody.fromString('{"ok":true}', 200,
        headers: {Headers.contentTypeHeader: ['application/json']});
  }

  @override
  void close({bool force = false}) {}
}

String? _contentType(RequestOptions o) {
  final key = o.headers.keys.firstWhere(
      (k) => k.toLowerCase() == Headers.contentTypeHeader,
      orElse: () => '');
  return key.isEmpty ? null : o.headers[key]?.toString();
}

void main() {
  Dio dioWith(_CapturingAdapter adapter) {
    final dio = buildDio(_FakeTokenStore());
    dio.httpClientAdapter = adapter;
    return dio;
  }

  test('bodyless request (DELETE) does NOT carry a JSON content-type', () async {
    // A JSON content-type on an empty body makes Fastify reject it
    // (FST_ERR_CTP_EMPTY_JSON_BODY -> 400), which broke message deletion.
    final adapter = _CapturingAdapter();
    await dioWith(adapter).delete('/api/messages/abc');
    final ct = _contentType(adapter.last!);
    expect(ct == null || !ct.contains('application/json'), isTrue,
        reason: 'bodyless DELETE should not send application/json content-type, got: $ct');
  });

  test('request WITH a body keeps the JSON content-type', () async {
    final adapter = _CapturingAdapter();
    await dioWith(adapter).post('/api/auth/login', data: {'email': 'a', 'password': 'b'});
    expect(_contentType(adapter.last!), contains('application/json'));
  });
}
