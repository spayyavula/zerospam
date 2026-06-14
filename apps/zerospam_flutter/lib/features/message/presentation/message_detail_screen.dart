import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:openapi/openapi.dart' as api;

import '../../../core/providers.dart';
import '../../../theme/adaptive.dart';
import '../../inbox/application/inbox_notifier.dart';
import '../application/message_notifier.dart';

const _moveTargets = ['inbox', 'quarantine', 'trash'];

class MessageDetailScreen extends ConsumerWidget {
  const MessageDetailScreen({super.key, required this.messageId});
  final String messageId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final msg = ref.watch(messageProvider(messageId));
    return Scaffold(
      appBar: AppBar(title: const Text('Message')),
      body: msg.when(
        loading: () => const _MessageLoadingState(),
        error: (e, _) => _MessageErrorState(
          message: '$e',
          onRetry: () => ref.invalidate(messageProvider(messageId)),
        ),
        data: (m) => _MessageDetailBody(messageId: messageId, message: m),
      ),
    );
  }
}

class _MessageDetailBody extends ConsumerWidget {
  const _MessageDetailBody({required this.messageId, required this.message});

  final String messageId;
  final api.MessageDetail message;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;
    final textTheme = theme.textTheme;
    final sender = _displaySender(message.fromName, message.fromAddress);
    final subject = (message.subject?.trim().isNotEmpty ?? false)
        ? message.subject!.trim()
        : '(no subject)';
    final body = (message.bodyText?.trim().isNotEmpty ?? false)
        ? message.bodyText!.trim()
        : '(no text body)';
    final received = DateTime.fromMillisecondsSinceEpoch(message.receivedAt);

    return SingleChildScrollView(
      physics: adaptiveScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Card(
            margin: EdgeInsets.zero,
            child: Padding(
              padding: const EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Semantics(
                    header: true,
                    child: Text(
                      subject,
                      style: textTheme.headlineSmall?.copyWith(
                        color: colorScheme.onSurface,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
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
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              sender,
                              style: textTheme.titleSmall?.copyWith(
                                color: colorScheme.onSurface,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              message.fromAddress,
                              style: textTheme.bodyMedium?.copyWith(
                                color: colorScheme.onSurfaceVariant,
                              ),
                            ),
                            const SizedBox(height: 6),
                            Text(
                              DateFormat.yMMMd().add_jm().format(received),
                              style: textTheme.labelMedium?.copyWith(
                                color: colorScheme.onSurfaceVariant,
                              ),
                            ),
                          ],
                        ),
                      ),
                      IconButton(
                        tooltip: message.starred == 1
                            ? 'Unstar message'
                            : 'Star message',
                        onPressed: () => _toggleStar(context, ref),
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
                    ],
                  ),
                  const SizedBox(height: 16),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: [
                      _MetaChip(
                        icon: Icons.mark_email_read_outlined,
                        label: message.read == 0 ? 'Unread' : 'Read',
                      ),
                      if (message.attachmentCount > 0)
                        _MetaChip(
                          icon: Icons.attach_file,
                          label:
                              '${message.attachmentCount} attachment${message.attachmentCount == 1 ? '' : 's'}',
                        ),
                      _MetaChip(
                        icon: Icons.folder_outlined,
                        label: message.folder.name,
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 12),
          _ActionToolbar(
            message: message,
            colorScheme: colorScheme,
            onToggleRead: () => _toggleRead(context, ref),
            onToggleStar: () => _toggleStar(context, ref),
            onMove: () => _showMovePicker(context, ref),
            onDelete: () => _confirmDelete(context, ref),
          ),
          const SizedBox(height: 16),
          SelectableText(
            body,
            style: textTheme.bodyLarge?.copyWith(
              color: colorScheme.onSurface,
              height: 1.55,
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _toggleRead(BuildContext context, WidgetRef ref) async {
    final read = message.read == 0;
    try {
      await ref.read(messageRepositoryProvider).markRead(messageId, read: read);
      ref.invalidate(messageProvider(messageId));
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

  Future<void> _toggleStar(BuildContext context, WidgetRef ref) async {
    final starred = message.starred == 0;
    try {
      await ref
          .read(messageRepositoryProvider)
          .setStarred(messageId, starred: starred);
      ref.invalidate(messageProvider(messageId));
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

  Future<void> _showMovePicker(BuildContext context, WidgetRef ref) async {
    final currentFolder = message.folder.name;
    final targetFolder = await adaptiveDialog<String>(
      context: context,
      title: const Text('Move message'),
      content: const Text('Choose a destination folder.'),
      actions: _moveTargets
          .where((target) => target != currentFolder)
          .map(
            (target) => TextButton(
              onPressed: () => Navigator.of(context).pop(target),
              child: Text(_folderTitle(target)),
            ),
          )
          .toList(),
    );
    if (targetFolder == null) return;
    if (!context.mounted) return;
    await _moveMessage(context, ref, targetFolder);
  }

  Future<void> _moveMessage(
    BuildContext context,
    WidgetRef ref,
    String targetFolder,
  ) async {
    try {
      await ref
          .read(messageRepositoryProvider)
          .move(messageId, folder: targetFolder);
      ref.invalidate(messageProvider(messageId));
      ref.invalidate(inboxNotifierProvider(message.folder.name));
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

  Future<void> _confirmDelete(BuildContext context, WidgetRef ref) async {
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
    if (confirmed != true) return;
    if (!context.mounted) return;
    await _deleteMessage(context, ref);
  }

  Future<void> _deleteMessage(BuildContext context, WidgetRef ref) async {
    try {
      await ref.read(messageRepositoryProvider).delete(messageId);
      ref.invalidate(inboxNotifierProvider(message.folder.name));
      ref.invalidate(mailboxCountsProvider);
      if (context.mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(const SnackBar(content: Text('Message deleted')));
        await Navigator.of(context).maybePop();
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

class _ActionToolbar extends StatelessWidget {
  const _ActionToolbar({
    required this.message,
    required this.colorScheme,
    required this.onToggleRead,
    required this.onToggleStar,
    required this.onMove,
    required this.onDelete,
  });

  final api.MessageDetail message;
  final ColorScheme colorScheme;
  final Future<void> Function() onToggleRead;
  final Future<void> Function() onToggleStar;
  final Future<void> Function() onMove;
  final Future<void> Function() onDelete;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      label: 'Message actions',
      child: Card(
        margin: EdgeInsets.zero,
        color: colorScheme.surfaceContainer,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceAround,
            children: [
              _ActionButton(
                icon: message.read == 0
                    ? Icons.mark_email_read_outlined
                    : Icons.mark_email_unread_outlined,
                label: message.read == 0 ? 'Read' : 'Unread',
                onPressed: onToggleRead,
              ),
              _ActionButton(
                icon: message.starred == 1
                    ? Icons.star_rounded
                    : Icons.star_border_rounded,
                label: message.starred == 1 ? 'Unstar' : 'Star',
                onPressed: onToggleStar,
              ),
              _ActionButton(
                icon: Icons.drive_file_move_outline,
                label: 'Move',
                onPressed: onMove,
              ),
              _ActionButton(
                icon: Icons.delete_outline,
                label: 'Delete',
                onPressed: onDelete,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _ActionButton extends StatelessWidget {
  const _ActionButton({
    required this.icon,
    required this.label,
    required this.onPressed,
  });

  final IconData icon;
  final String label;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;
    return IconButton(
      tooltip: label,
      onPressed: onPressed,
      icon: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon),
          const SizedBox(height: 2),
          Text(
            label,
            style: theme.textTheme.labelSmall?.copyWith(
              color: colorScheme.onSurfaceVariant,
            ),
          ),
        ],
      ),
    );
  }
}

class _MetaChip extends StatelessWidget {
  const _MetaChip({required this.icon, required this.label});

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;
    return Chip(
      avatar: Icon(icon, size: 18),
      label: Text(label),
      backgroundColor: colorScheme.surfaceContainerHighest,
      labelStyle: theme.textTheme.labelMedium?.copyWith(
        color: colorScheme.onSurfaceVariant,
      ),
      side: BorderSide(color: colorScheme.outlineVariant),
    );
  }
}

class _MessageLoadingState extends StatelessWidget {
  const _MessageLoadingState();

  @override
  Widget build(BuildContext context) {
    final fill = Theme.of(context).colorScheme.surfaceContainerHighest;
    return SingleChildScrollView(
      physics: adaptiveScrollPhysics(),
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Card(
            margin: EdgeInsets.zero,
            child: Padding(
              padding: const EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _SkeletonBox(width: double.infinity, height: 24, color: fill),
                  const SizedBox(height: 18),
                  Row(
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
                            _SkeletonBox(width: 180, height: 14, color: fill),
                            const SizedBox(height: 8),
                            _SkeletonBox(width: 240, height: 12, color: fill),
                          ],
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 20),
          _SkeletonBox(width: double.infinity, height: 14, color: fill),
          const SizedBox(height: 10),
          _SkeletonBox(width: double.infinity, height: 14, color: fill),
          const SizedBox(height: 10),
          _SkeletonBox(width: 260, height: 14, color: fill),
        ],
      ),
    );
  }
}

class _MessageErrorState extends StatelessWidget {
  const _MessageErrorState({required this.message, required this.onRetry});

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
                Icons.mark_email_unread_outlined,
                size: 56,
                color: colorScheme.error,
                semanticLabel: 'Message loading error',
              ),
              const SizedBox(height: 16),
              Text(
                'Couldn’t load this message',
                style: theme.textTheme.titleLarge?.copyWith(
                  color: colorScheme.onSurface,
                  fontWeight: FontWeight.w800,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                message,
                key: const Key('detail-error'),
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

String _folderTitle(String folder) {
  return switch (folder) {
    'inbox' => 'Inbox',
    'quarantine' => 'Quarantine',
    'sent' => 'Sent',
    'trash' => 'Trash',
    _ => toBeginningOfSentenceCase(folder) ?? folder,
  };
}
