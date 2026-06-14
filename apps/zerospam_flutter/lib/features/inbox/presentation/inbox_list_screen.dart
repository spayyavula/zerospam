import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:openapi/openapi.dart' as api;

import '../../../core/providers.dart';
import '../../../theme/adaptive.dart';
import '../../message/presentation/message_detail_screen.dart';
import '../application/inbox_notifier.dart';

const _moveTargets = ['inbox', 'quarantine', 'trash'];

class InboxListScreen extends ConsumerStatefulWidget {
  const InboxListScreen({super.key, this.folder = 'inbox'});

  final String folder;

  @override
  ConsumerState<InboxListScreen> createState() => _InboxListScreenState();
}

class _InboxListScreenState extends ConsumerState<InboxListScreen> {
  late final TextEditingController _searchController;

  String get folder => widget.folder;

  @override
  void initState() {
    super.initState();
    _searchController = TextEditingController();
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final query = _searchController.text.trim();
    final isSearching = query.isNotEmpty;
    final searchProvider = searchNotifierProvider((
      folder: folder,
      query: query,
    ));
    final messagesState = isSearching
        ? ref
              .watch(searchProvider)
              .whenData(
                (messages) =>
                    messages.map(_MessageListItem.fromSearch).toList(),
              )
        : ref
              .watch(inboxNotifierProvider(folder))
              .whenData(
                (messages) =>
                    messages.map(_MessageListItem.fromSummary).toList(),
              );
    final colorScheme = Theme.of(context).colorScheme;
    final title = _folderTitle(folder);
    return Scaffold(
      appBar: AppBar(
        title: Text(title),
        actions: [
          IconButton(
            tooltip: 'Refresh $title',
            onPressed: () => isSearching
                ? ref.invalidate(searchProvider)
                : ref.invalidate(inboxNotifierProvider(folder)),
            icon: const Icon(Icons.refresh),
          ),
          IconButton(
            tooltip: 'Settings',
            onPressed: () {
              final router = GoRouter.maybeOf(context);
              if (router != null) {
                context.push('/settings');
              }
            },
            icon: const Icon(Icons.settings_outlined),
          ),
        ],
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 4),
            child: TextField(
              controller: _searchController,
              textInputAction: TextInputAction.search,
              decoration: InputDecoration(
                hintText: 'Search $title',
                prefixIcon: const Icon(Icons.search),
                suffixIcon: isSearching
                    ? IconButton(
                        tooltip: 'Clear search',
                        onPressed: () {
                          _searchController.clear();
                          setState(() {});
                        },
                        icon: const Icon(Icons.close),
                      )
                    : null,
              ),
              onChanged: (_) => setState(() {}),
            ),
          ),
          Expanded(
            child: messagesState.when(
              loading: () => const _InboxSkeletonList(),
              error: (e, _) => _InboxErrorState(
                folderTitle: title,
                message: '$e',
                onRetry: () => isSearching
                    ? ref.invalidate(searchProvider)
                    : ref.invalidate(inboxNotifierProvider(folder)),
              ),
              data: (messages) => RefreshIndicator(
                onRefresh: () => isSearching
                    ? ref.refresh(searchProvider.future)
                    : ref.refresh(inboxNotifierProvider(folder).future),
                child: messages.isEmpty
                    ? _InboxEmptyState(
                        folderTitle: isSearching ? 'Search results' : title,
                      )
                    : ListView.builder(
                        physics: const AlwaysScrollableScrollPhysics(),
                        padding: const EdgeInsets.fromLTRB(12, 8, 12, 24),
                        itemCount: messages.length,
                        itemBuilder: (context, i) => _InboxMessageCard(
                          message: messages[i],
                          colorScheme: colorScheme,
                          onTap: () => _openMessage(context, ref, messages[i]),
                          onToggleRead: () =>
                              _toggleRead(context, ref, messages[i]),
                          onToggleStar: () =>
                              _toggleStar(context, ref, messages[i]),
                          onMove: (targetFolder) => _moveMessage(
                            context,
                            ref,
                            messages[i],
                            targetFolder,
                          ),
                          onDelete: () =>
                              _deleteMessage(context, ref, messages[i]),
                        ),
                      ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  void _openMessage(
    BuildContext context,
    WidgetRef ref,
    _MessageListItem message,
  ) {
    final messageId = message.id;
    if (message.read == 0) {
      unawaited(
        ref
            .read(messageRepositoryProvider)
            .markRead(messageId)
            .then((_) {
              ref.invalidate(inboxNotifierProvider(folder));
              ref.invalidate(mailboxCountsProvider);
            })
            .catchError((Object error) {
              if (context.mounted) {
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(content: Text('Could not mark as read: $error')),
                );
              }
            }),
      );
    }

    final router = GoRouter.maybeOf(context);
    if (router != null) {
      context.push('/messages/${Uri.encodeComponent(messageId)}');
      return;
    }

    Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => MessageDetailScreen(messageId: messageId),
      ),
    );
  }

  Future<void> _toggleRead(
    BuildContext context,
    WidgetRef ref,
    _MessageListItem message,
  ) async {
    final read = message.read == 0;
    try {
      await ref
          .read(messageRepositoryProvider)
          .markRead(message.id, read: read);
      ref.invalidate(inboxNotifierProvider(folder));
      ref.invalidate(mailboxCountsProvider);
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(read ? 'Marked as read' : 'Marked as unread')),
        );
      }
    } catch (error) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Could not update read state: $error')),
        );
      }
    }
  }

  Future<void> _toggleStar(
    BuildContext context,
    WidgetRef ref,
    _MessageListItem message,
  ) async {
    final starred = message.starred == 0;
    try {
      await ref
          .read(messageRepositoryProvider)
          .setStarred(message.id, starred: starred);
      ref.invalidate(inboxNotifierProvider(folder));
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(starred ? 'Starred' : 'Unstarred')),
        );
      }
    } catch (error) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Could not update star: $error')),
        );
      }
    }
  }

  Future<void> _moveMessage(
    BuildContext context,
    WidgetRef ref,
    _MessageListItem message,
    String targetFolder,
  ) async {
    try {
      await ref
          .read(messageRepositoryProvider)
          .move(message.id, folder: targetFolder);
      ref.invalidate(inboxNotifierProvider(folder));
      ref.invalidate(inboxNotifierProvider(targetFolder));
      ref.invalidate(mailboxCountsProvider);
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Moved to ${_folderTitle(targetFolder)}')),
        );
      }
    } catch (error) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Could not move message: $error')),
        );
      }
    }
  }

  Future<void> _deleteMessage(
    BuildContext context,
    WidgetRef ref,
    _MessageListItem message,
  ) async {
    try {
      await ref.read(messageRepositoryProvider).delete(message.id);
      ref.invalidate(inboxNotifierProvider(folder));
      ref.invalidate(mailboxCountsProvider);
      if (context.mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(const SnackBar(content: Text('Message deleted')));
      }
    } catch (error) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Could not delete message: $error')),
        );
      }
    }
  }
}

class _InboxMessageCard extends StatelessWidget {
  const _InboxMessageCard({
    required this.message,
    required this.colorScheme,
    required this.onTap,
    required this.onToggleRead,
    required this.onToggleStar,
    required this.onMove,
    required this.onDelete,
  });

  final _MessageListItem message;
  final ColorScheme colorScheme;
  final VoidCallback onTap;
  final Future<void> Function() onToggleRead;
  final Future<void> Function() onToggleStar;
  final Future<void> Function(String folder) onMove;
  final Future<void> Function() onDelete;

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

    return Dismissible(
      key: ValueKey('message-read-${message.id}'),
      background: _SwipeBackground(
        alignment: Alignment.centerLeft,
        icon: isUnread
            ? Icons.mark_email_read_outlined
            : Icons.mark_email_unread_outlined,
        label: isUnread ? 'Mark read' : 'Mark unread',
      ),
      secondaryBackground: const _SwipeBackground(
        alignment: Alignment.centerRight,
        icon: Icons.delete_outline,
        label: 'Delete',
        destructive: true,
      ),
      confirmDismiss: (direction) async {
        if (direction == DismissDirection.endToStart) {
          final confirmed = await adaptiveDialog<bool>(
            context: context,
            title: const Text('Delete message?'),
            content: const Text('This permanently deletes the message.'),
            actions: [
              TextButton(
                onPressed: () => Navigator.of(context).pop(false),
                child: const Text('Cancel'),
              ),
              FilledButton(
                onPressed: () => Navigator.of(context).pop(true),
                child: const Text('Delete'),
              ),
            ],
          );
          if (confirmed == true) {
            await onDelete();
          }
          return false;
        }
        await onToggleRead();
        return false;
      },
      child: Semantics(
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
                            IconButton(
                              tooltip: message.starred == 1
                                  ? 'Unstar message'
                                  : 'Star message',
                              onPressed: onToggleStar,
                              icon: Icon(
                                message.starred == 1
                                    ? Icons.star_rounded
                                    : Icons.star_border_rounded,
                                color: message.starred == 1
                                    ? colorScheme.tertiary
                                    : colorScheme.onSurfaceVariant,
                                semanticLabel: message.starred == 1
                                    ? 'Starred'
                                    : 'Not starred',
                              ),
                            ),
                            PopupMenuButton<String>(
                              tooltip: 'Move message',
                              icon: const Icon(Icons.drive_file_move_outline),
                              onSelected: onMove,
                              itemBuilder: (context) => _moveTargets
                                  .where((target) => target != message.folder)
                                  .map(
                                    (target) => PopupMenuItem<String>(
                                      value: target,
                                      child: Text(
                                        'Move to ${_folderTitle(target)}',
                                      ),
                                    ),
                                  )
                                  .toList(),
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
      ),
    );
  }
}

class _MessageListItem {
  const _MessageListItem({
    required this.id,
    required this.folder,
    required this.fromAddress,
    required this.fromName,
    required this.subject,
    required this.preview,
    required this.receivedAt,
    required this.read,
    required this.starred,
    required this.attachmentCount,
  });

  factory _MessageListItem.fromSummary(api.MessageSummary message) {
    return _MessageListItem(
      id: message.id,
      folder: message.folder.name,
      fromAddress: message.fromAddress,
      fromName: message.fromName,
      subject: message.subject,
      preview: message.preview,
      receivedAt: message.receivedAt,
      read: message.read,
      starred: message.starred,
      attachmentCount: message.attachmentCount,
    );
  }

  factory _MessageListItem.fromSearch(api.SearchMessage message) {
    return _MessageListItem(
      id: message.id,
      folder: message.folder.name,
      fromAddress: message.fromAddress,
      fromName: message.fromName,
      subject: message.subject,
      preview: message.preview,
      receivedAt: message.receivedAt,
      read: message.read,
      starred: message.starred,
      attachmentCount: message.attachmentCount,
    );
  }

  final String id;
  final String folder;
  final String fromAddress;
  final String? fromName;
  final String? subject;
  final String? preview;
  final int receivedAt;
  final int read;
  final int starred;
  final int attachmentCount;
}

class _SwipeBackground extends StatelessWidget {
  const _SwipeBackground({
    required this.alignment,
    required this.icon,
    required this.label,
    this.destructive = false,
  });

  final Alignment alignment;
  final IconData icon;
  final String label;
  final bool destructive;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    return Container(
      alignment: alignment,
      margin: const EdgeInsets.symmetric(vertical: 6),
      padding: const EdgeInsets.symmetric(horizontal: 20),
      decoration: BoxDecoration(
        color: destructive
            ? colorScheme.errorContainer
            : colorScheme.primaryContainer,
        borderRadius: BorderRadius.circular(20),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            icon,
            color: destructive
                ? colorScheme.onErrorContainer
                : colorScheme.onPrimaryContainer,
          ),
          const SizedBox(width: 8),
          Text(
            label,
            style: Theme.of(context).textTheme.labelLarge?.copyWith(
              color: destructive
                  ? colorScheme.onErrorContainer
                  : colorScheme.onPrimaryContainer,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
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
  const _InboxEmptyState({required this.folderTitle});

  final String folderTitle;

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
          'Your ${folderTitle.toLowerCase()} is clear',
          textAlign: TextAlign.center,
          style: theme.textTheme.headlineSmall?.copyWith(
            color: colorScheme.onSurface,
            fontWeight: FontWeight.w800,
          ),
        ),
        const SizedBox(height: 8),
        Text(
          'Pull down to check again. ZeroSpam keeps this folder in sync with your mailbox.',
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
  const _InboxErrorState({
    required this.folderTitle,
    required this.message,
    required this.onRetry,
  });

  final String folderTitle;
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
                'Couldn’t load ${folderTitle.toLowerCase()}',
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

String _folderTitle(String folder) {
  return switch (folder) {
    'inbox' => 'Inbox',
    'quarantine' => 'Quarantine',
    'sent' => 'Sent',
    'trash' => 'Trash',
    _ => toBeginningOfSentenceCase(folder) ?? folder,
  };
}
