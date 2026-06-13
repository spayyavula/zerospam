import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:openapi/openapi.dart' as api;
import '../../../core/providers.dart';

final messageProvider = FutureProvider.family<api.MessageDetail, String>((ref, id) {
  return ref.read(messageRepositoryProvider).get(id);
});
