import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:openapi/openapi.dart' as api;
import 'dio_client.dart';
import 'token_store.dart';
import '../data/repositories/auth_repository.dart';
import '../data/repositories/mailbox_repository.dart';
import '../data/repositories/message_repository.dart';

final tokenStoreProvider = Provider<TokenStore>((ref) => TokenStore());

final mobileApiProvider = Provider<api.MobileApi>((ref) {
  final dio = buildDio(ref.read(tokenStoreProvider));
  // The generated top-level client (`Openapi`, from the package name) wires the
  // Dio + serializers into the tagged Api and exposes getMobileApi().
  final client = api.Openapi(dio: dio);
  return client.getMobileApi();
});

final authRepositoryProvider =
    Provider<AuthRepository>((ref) => AuthRepository(ref.read(mobileApiProvider)));
final mailboxRepositoryProvider =
    Provider<MailboxRepository>((ref) => MailboxRepository(ref.read(mobileApiProvider)));
final messageRepositoryProvider =
    Provider<MessageRepository>((ref) => MessageRepository(ref.read(mobileApiProvider)));
