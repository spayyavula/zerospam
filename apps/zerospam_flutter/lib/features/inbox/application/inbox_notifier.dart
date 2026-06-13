import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:openapi/openapi.dart' as api;
import '../../../core/providers.dart';

/// Loads the first mailbox, then its inbox messages.
class InboxNotifier extends AsyncNotifier<List<api.MessageSummary>> {
  @override
  Future<List<api.MessageSummary>> build() async {
    final mailboxes = await ref.read(mailboxRepositoryProvider).list();
    if (mailboxes.isEmpty) return <api.MessageSummary>[];
    return ref.read(messageRepositoryProvider).listInbox(mailboxes.first.id);
  }

  Future<void> refresh() async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(() => build());
  }
}

final inboxNotifierProvider =
    AsyncNotifierProvider<InboxNotifier, List<api.MessageSummary>>(InboxNotifier.new);
