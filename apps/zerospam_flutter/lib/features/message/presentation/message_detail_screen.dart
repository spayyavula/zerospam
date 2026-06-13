import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:openapi/openapi.dart' as api;

import '../../../theme/adaptive.dart';
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
        loading: () => const _MessageLoadingState(),
        error: (e, _) => _MessageErrorState(
          message: '$e',
          onRetry: () => ref.invalidate(messageProvider(messageId)),
        ),
        data: (m) => _MessageDetailBody(message: m),
      ),
    );
  }
}

class _MessageDetailBody extends StatelessWidget {
  const _MessageDetailBody({required this.message});

  final api.MessageDetail message;

  @override
  Widget build(BuildContext context) {
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
                      Icon(
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
          _ActionToolbar(colorScheme: colorScheme),
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
}

class _ActionToolbar extends StatelessWidget {
  const _ActionToolbar({required this.colorScheme});

  final ColorScheme colorScheme;

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
                icon: Icons.mark_email_unread_outlined,
                label: 'Read',
                onPressed: () => _showComingSoon(context, 'Read status'),
              ),
              _ActionButton(
                icon: Icons.star_border_rounded,
                label: 'Star',
                onPressed: () => _showComingSoon(context, 'Star'),
              ),
              _ActionButton(
                icon: Icons.drive_file_move_outline,
                label: 'Move',
                onPressed: () => _showComingSoon(context, 'Move'),
              ),
              _ActionButton(
                icon: Icons.delete_outline,
                label: 'Delete',
                onPressed: () => _showComingSoon(context, 'Delete'),
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _showComingSoon(BuildContext context, String action) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('$action action is coming in the next phase.')),
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
