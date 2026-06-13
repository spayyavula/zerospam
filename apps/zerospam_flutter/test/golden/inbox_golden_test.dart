import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:openapi/openapi.dart' as api;
import 'package:zerospam_flutter/core/providers.dart';
import 'package:zerospam_flutter/data/repositories/mailbox_repository.dart';
import 'package:zerospam_flutter/data/repositories/message_repository.dart';
import 'package:zerospam_flutter/features/inbox/presentation/inbox_list_screen.dart';
import 'package:zerospam_flutter/theme/app_theme.dart';

class _MockMailboxRepository extends Mock implements MailboxRepository {}

class _MockMessageRepository extends Mock implements MessageRepository {}

void main() {
  group(
    'inbox goldens',
    skip:
        'Non-gating visual coverage; update intentionally with --update-goldens.',
    () {
      testWidgets('light', (tester) async {
        await tester.pumpWidget(_wrap(ThemeMode.light));
        await tester.pumpAndSettle();

        await expectLater(
          find.byType(InboxListScreen),
          matchesGoldenFile('inbox_light.png'),
        );
      });

      testWidgets('dark', (tester) async {
        await tester.pumpWidget(_wrap(ThemeMode.dark));
        await tester.pumpAndSettle();

        await expectLater(
          find.byType(InboxListScreen),
          matchesGoldenFile('inbox_dark.png'),
        );
      });
    },
  );
}

Widget _wrap(ThemeMode themeMode) {
  final mailboxRepository = _MockMailboxRepository();
  final messageRepository = _MockMessageRepository();
  when(() => mailboxRepository.list()).thenAnswer((_) async => [_mailbox()]);
  when(
    () => messageRepository.listInbox(1),
  ).thenAnswer((_) async => _messages());

  return ProviderScope(
    overrides: [
      mailboxRepositoryProvider.overrideWithValue(mailboxRepository),
      messageRepositoryProvider.overrideWithValue(messageRepository),
    ],
    child: MaterialApp(
      theme: lightTheme(),
      darkTheme: darkTheme(),
      themeMode: themeMode,
      home: const InboxListScreen(),
    ),
  );
}

api.Mailbox _mailbox() => api.Mailbox(
  (b) => b
    ..id = 1
    ..address = 'me@zerospam.test'
    ..domainId = 1
    ..displayName = 'Primary'
    ..quarantineTtlHours = 48
    ..createdAt = DateTime(2026, 6, 13).millisecondsSinceEpoch,
);

List<api.MessageSummary> _messages() {
  final now = DateTime(2026, 6, 13, 12).millisecondsSinceEpoch;
  return [
    api.MessageSummary(
      (b) => b
        ..id = 'm1'
        ..mailboxId = 1
        ..folder = api.MessageSummaryFolderEnum.inbox
        ..fromAddress = 'sarah@example.com'
        ..fromName = 'Sarah Chen'
        ..toAddresses = 'me@zerospam.test'
        ..subject = 'Security review notes'
        ..preview =
            'I left the new findings and action items in the shared doc.'
        ..receivedAt = now - 8 * 60 * 1000
        ..read = 0
        ..starred = 1
        ..sizeBytes = 4210
        ..attachmentCount = 1,
    ),
    api.MessageSummary(
      (b) => b
        ..id = 'm2'
        ..mailboxId = 1
        ..folder = api.MessageSummaryFolderEnum.inbox
        ..fromAddress = 'alerts@bank.example'
        ..fromName = 'Bank Alerts'
        ..toAddresses = 'me@zerospam.test'
        ..subject = 'Statement ready'
        ..preview = 'Your monthly statement is ready to review.'
        ..receivedAt = now - 3 * 60 * 60 * 1000
        ..read = 1
        ..starred = 0
        ..sizeBytes = 2104
        ..attachmentCount = 0,
    ),
  ];
}
