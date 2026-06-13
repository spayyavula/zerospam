import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../application/inbox_notifier.dart';
import '../../message/presentation/message_detail_screen.dart';

class InboxListScreen extends ConsumerWidget {
  const InboxListScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final inbox = ref.watch(inboxNotifierProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Inbox')),
      body: inbox.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('$e', key: const Key('inbox-error'))),
        data: (messages) => RefreshIndicator(
          onRefresh: () => ref.read(inboxNotifierProvider.notifier).refresh(),
          child: messages.isEmpty
              ? const Center(child: Text('No messages'))
              : ListView.separated(
                  itemCount: messages.length,
                  separatorBuilder: (_, _) => const Divider(height: 1),
                  itemBuilder: (context, i) {
                    final m = messages[i];
                    return ListTile(
                      leading: m.read == 0
                          ? const Icon(Icons.circle, size: 10, color: Colors.blue)
                          : const SizedBox(width: 10),
                      title: Text(m.subject ?? '(no subject)',
                          maxLines: 1, overflow: TextOverflow.ellipsis),
                      subtitle: Text(m.fromName ?? m.fromAddress,
                          maxLines: 1, overflow: TextOverflow.ellipsis),
                      onTap: () => Navigator.of(context).push(MaterialPageRoute(
                        builder: (_) => MessageDetailScreen(messageId: m.id),
                      )),
                    );
                  },
                ),
        ),
      ),
    );
  }
}
