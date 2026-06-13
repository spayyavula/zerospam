import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:openapi/openapi.dart' as api;

import '../../../theme/adaptive.dart';
import '../../message/presentation/message_detail_screen.dart';
import '../application/inbox_notifier.dart';

class InboxListScreen extends ConsumerWidget {
  const InboxListScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final inbox = ref.watch(inboxNotifierProvider);
    final colorScheme = Theme.of(context).colorScheme;
    return Scaffold(
      appBar: AppBar(
        title: const Text('Inbox'),
        actions: [
          IconButton(
            tooltip: 'Refresh inbox',
            onPressed: () => ref.read(inboxNotifierProvider.notifier).refresh(),
            icon: const Icon(Icons.refresh),
          ),
        ],
      ),
      body: inbox.when(
        loading: () => const _InboxSkeletonList(),
        error: (e, _) => _InboxErrorState(
          message: '$e',
          onRetry: () => ref.read(inboxNotifierProvider.notifier).refresh(),
        ),
        data: (messages) => RefreshIndicator(
          onRefresh: () => ref.read(inboxNotifierProvider.notifier).refresh(),
          child: messages.isEmpty
              ? const _InboxEmptyState()
              : ListView.builder(
                  physics: const AlwaysScrollableScrollPhysics(),
                  padding: const EdgeInsets.fromLTRB(12, 8, 12, 24),
                  itemCount: messages.length,
                  itemBuilder: (context, i) => _InboxMessageCard(
                    message: messages[i],
                    colorScheme: colorScheme,
                    onTap: () => Navigator.of(context).push(
                      MaterialPageRoute<void>(
                        builder: (_) =>
                            MessageDetailScreen(messageId: messages[i].id),
                      ),
                    ),
                  ),
                ),
        ),
      ),
    );
  }
}

class _InboxMessageCard extends StatelessWidget {
  const _InboxMessageCard({
    required this.message,
    required this.colorScheme,
    required this.onTap,
  });

  final api.MessageSummary message;
  final ColorScheme colorScheme;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final textTheme = theme.textTheme;
    final isUnread = message.read == 0;
    final sender = _displaySender(message.fromName, message.fromAddress);
    final subject = (message.subject?.trim().isNotEmpty ?? false)
        ? message.subject!.trim()
        : '(no subject)';
    final preview = (message.preview?.trim().isNotEmpty ?? false)
        ? message.preview!.trim()
        : 'No preview available';
    final received = DateTime.fromMillisecondsSinceEpoch(message.receivedAt);

    return Semantics(
      button: true,
      label:
          '${isUnread ? 'Unread' : 'Read'} message from $sender, subject $subject, received ${_absoluteTime(received)}',
      child: Card(
        margin: const EdgeInsets.symmetric(vertical: 6),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.all(12),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Stack(
                  clipBehavior: Clip.none,
                  children: [
                    CircleAvatar(
                      radius: 24,
                      backgroundColor: colorScheme.secondaryContainer,
                      foregroundColor: colorScheme.onSecondaryContainer,
                      child: Text(
                        _initials(sender),
                        style: textTheme.labelLarge?.copyWith(
                          color: colorScheme.onSecondaryContainer,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                    ),
                    if (isUnread)
                      Positioned(
                        right: -1,
                        top: -1,
                        child: Container(
                          width: 12,
                          height: 12,
                          decoration: BoxDecoration(
                            color: colorScheme.primary,
                            shape: BoxShape.circle,
                            border: Border.all(
                              color: colorScheme.surfaceContainerLow,
                              width: 2,
                            ),
                          ),
                        ),
                      ),
                  ],
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Expanded(
                            child: Text(
                              sender,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: textTheme.titleSmall?.copyWith(
                                color: colorScheme.onSurface,
                                fontWeight: isUnread
                                    ? FontWeight.w800
                                    : FontWeight.w600,
                              ),
                            ),
                          ),
                          const SizedBox(width: 8),
                          Text(
                            _relativeTime(received),
                            style: textTheme.labelMedium?.copyWith(
                              color: colorScheme.onSurfaceVariant,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 4),
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Expanded(
                            child: Text(
                              subject,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: textTheme.bodyLarge?.copyWith(
                                color: colorScheme.onSurface,
                                fontWeight: isUnread
                                    ? FontWeight.w700
                                    : FontWeight.w500,
                              ),
                            ),
                          ),
                          const SizedBox(width: 8),
                          Icon(
                            message.starred == 1
                                ? Icons.star_rounded
                                : Icons.star_border_rounded,
                            size: 22,
                            color: message.starred == 1
                                ? colorScheme.tertiary
                                : colorScheme.onSurfaceVariant,
                            semanticLabel: message.starred == 1
                                ? 'Starred'
                                : 'Not starred',
                          ),
                        ],
                      ),
                      const SizedBox(height: 4),
                      Text(
                        preview,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: textTheme.bodyMedium?.copyWith(
                          color: colorScheme.onSurfaceVariant,
                        ),
                      ),
                      if (message.attachmentCount > 0) ...[
                        const SizedBox(height: 8),
                        Row(
                          children: [
                            Icon(
                              Icons.attach_file,
                              size: 18,
                              color: colorScheme.onSurfaceVariant,
                            ),
                            const SizedBox(width: 4),
                            Text(
                              NumberFormat.compact().format(
                                message.attachmentCount,
                              ),
                              style: textTheme.labelMedium?.copyWith(
                                color: colorScheme.onSurfaceVariant,
                              ),
                            ),
                          ],
                        ),
                      ],
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _InboxSkeletonList extends StatelessWidget {
  const _InboxSkeletonList();

  @override
  Widget build(BuildContext context) {
    return ListView.builder(
      physics: adaptiveScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(12, 8, 12, 24),
      itemCount: 6,
      itemBuilder: (context, index) => const _SkeletonCard(),
    );
  }
}

class _SkeletonCard extends StatelessWidget {
  const _SkeletonCard();

  @override
  Widget build(BuildContext context) {
    final fill = Theme.of(context).colorScheme.surfaceContainerHighest;
    return Card(
      margin: const EdgeInsets.symmetric(vertical: 6),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Row(
          children: [
            _SkeletonBox(
              width: 48,
              height: 48,
              color: fill,
              shape: BoxShape.circle,
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _SkeletonBox(width: 160, height: 14, color: fill),
                  const SizedBox(height: 10),
                  _SkeletonBox(width: double.infinity, height: 12, color: fill),
                  const SizedBox(height: 8),
                  _SkeletonBox(width: 220, height: 12, color: fill),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _SkeletonBox extends StatelessWidget {
  const _SkeletonBox({
    required this.width,
    required this.height,
    required this.color,
    this.shape = BoxShape.rectangle,
  });

  final double width;
  final double height;
  final Color color;
  final BoxShape shape;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: width,
      height: height,
      decoration: BoxDecoration(
        color: color,
        shape: shape,
        borderRadius: shape == BoxShape.rectangle
            ? BorderRadius.circular(999)
            : null,
      ),
    );
  }
}

class _InboxEmptyState extends StatelessWidget {
  const _InboxEmptyState();

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;
    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.all(24),
      children: [
        SizedBox(height: MediaQuery.sizeOf(context).height * 0.16),
        Icon(
          Icons.inbox_outlined,
          size: 64,
          color: colorScheme.primary,
          semanticLabel: 'Empty inbox',
        ),
        const SizedBox(height: 16),
        Text(
          'Your inbox is clear',
          textAlign: TextAlign.center,
          style: theme.textTheme.headlineSmall?.copyWith(
            color: colorScheme.onSurface,
            fontWeight: FontWeight.w800,
          ),
        ),
        const SizedBox(height: 8),
        Text(
          'Pull down to check again. We’ll surface only mail that passes your ZeroSpam rules.',
          textAlign: TextAlign.center,
          style: theme.textTheme.bodyLarge?.copyWith(
            color: colorScheme.onSurfaceVariant,
          ),
        ),
      ],
    );
  }
}

class _InboxErrorState extends StatelessWidget {
  const _InboxErrorState({required this.message, required this.onRetry});

  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Semantics(
          liveRegion: true,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(
                Icons.cloud_off_outlined,
                size: 56,
                color: colorScheme.error,
                semanticLabel: 'Inbox loading error',
              ),
              const SizedBox(height: 16),
              Text(
                'Couldn’t load inbox',
                style: theme.textTheme.titleLarge?.copyWith(
                  color: colorScheme.onSurface,
                  fontWeight: FontWeight.w800,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                message,
                key: const Key('inbox-error'),
                textAlign: TextAlign.center,
                style: theme.textTheme.bodyMedium?.copyWith(
                  color: colorScheme.onSurfaceVariant,
                ),
              ),
              const SizedBox(height: 16),
              FilledButton.icon(
                onPressed: onRetry,
                icon: const Icon(Icons.refresh),
                label: const Text('Try again'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

String _displaySender(String? name, String address) {
  final trimmed = name?.trim();
  return trimmed == null || trimmed.isEmpty ? address : trimmed;
}

String _initials(String value) {
  final parts = value
      .trim()
      .split(RegExp(r'\s+'))
      .where((part) => part.isNotEmpty)
      .toList();
  if (parts.isEmpty) return '?';
  if (parts.length == 1) return parts.first.characters.first.toUpperCase();
  return '${parts.first.characters.first}${parts.last.characters.first}'
      .toUpperCase();
}

String _relativeTime(DateTime dateTime) {
  final diff = DateTime.now().difference(dateTime);
  if (diff.inMinutes < 1) return 'now';
  if (diff.inHours < 1) return '${diff.inMinutes}m';
  if (diff.inDays < 1) return '${diff.inHours}h';
  if (diff.inDays < 7) return '${diff.inDays}d';
  return DateFormat.MMMd().format(dateTime);
}

String _absoluteTime(DateTime dateTime) {
  return DateFormat.yMMMd().add_jm().format(dateTime);
}
