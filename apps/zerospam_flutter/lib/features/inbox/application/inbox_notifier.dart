import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:openapi/openapi.dart' as api;
import '../../../core/providers.dart';

/// Loads the first mailbox, then messages in the requested folder.
final inboxNotifierProvider =
    FutureProvider.family<List<api.MessageSummary>, String>((
      ref,
      folder,
    ) async {
      final mailboxes = await ref.read(mailboxRepositoryProvider).list();
      if (mailboxes.isEmpty) return <api.MessageSummary>[];
      return ref
          .read(messageRepositoryProvider)
          .listMessages(mailboxId: mailboxes.first.id, folder: folder);
    });

final searchNotifierProvider =
    FutureProvider.family<
      List<api.SearchMessage>,
      ({String folder, String query})
    >((ref, params) async {
      final mailboxes = await ref.read(mailboxRepositoryProvider).list();
      if (mailboxes.isEmpty) return <api.SearchMessage>[];
      return ref
          .read(messageRepositoryProvider)
          .search(
            mailboxId: mailboxes.first.id,
            query: params.query,
            folder: params.folder,
          );
    });

final mailboxCountsProvider = FutureProvider<api.MailboxCounts?>((ref) async {
  final mailboxes = await ref.read(mailboxRepositoryProvider).list();
  if (mailboxes.isEmpty) return null;
  return ref.read(mailboxRepositoryProvider).counts(mailboxes.first.id);
});
