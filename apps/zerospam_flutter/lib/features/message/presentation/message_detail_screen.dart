import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../application/message_notifier.dart';

class MessageDetailScreen extends ConsumerWidget {
  const MessageDetailScreen({super.key, required this.messageId});
  final String messageId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final msg = ref.watch(messageProvider(messageId));
    return Scaffold(
      appBar: AppBar(title: const Text('Message')),
      body: msg.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('$e', key: const Key('detail-error'))),
        data: (m) => SingleChildScrollView(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(m.subject ?? '(no subject)', style: Theme.of(context).textTheme.titleLarge),
              const SizedBox(height: 4),
              Text('From: ${m.fromName ?? m.fromAddress}',
                  style: Theme.of(context).textTheme.bodySmall),
              const Divider(height: 24),
              Text(m.bodyText ?? '(no text body)'),
            ],
          ),
        ),
      ),
    );
  }
}
