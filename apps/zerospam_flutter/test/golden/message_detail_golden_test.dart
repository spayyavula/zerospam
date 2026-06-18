import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:openapi/openapi.dart' as api;
import 'package:zerospam_flutter/core/providers.dart';
import 'package:zerospam_flutter/data/repositories/message_repository.dart';
import 'package:zerospam_flutter/features/message/presentation/message_detail_screen.dart';
import 'package:zerospam_flutter/theme/app_theme.dart';

class _MockMessageRepository extends Mock implements MessageRepository {}

void main() {
  group(
    'message detail goldens',
    skip:
        'Non-gating visual coverage; update intentionally with --update-goldens.',
    () {
      testWidgets('light', (tester) async {
        await tester.pumpWidget(_wrap(ThemeMode.light));
        await tester.pumpAndSettle();

        await expectLater(
          find.byType(MessageDetailScreen),
          matchesGoldenFile('message_detail_light.png'),
        );
      });

      testWidgets('dark', (tester) async {
        await tester.pumpWidget(_wrap(ThemeMode.dark));
        await tester.pumpAndSettle();

        await expectLater(
          find.byType(MessageDetailScreen),
          matchesGoldenFile('message_detail_dark.png'),
        );
      });
    },
  );
}

Widget _wrap(ThemeMode themeMode) {
  final messageRepository = _MockMessageRepository();
  when(() => messageRepository.get('m1')).thenAnswer((_) async => _message());

  return ProviderScope(
    overrides: [messageRepositoryProvider.overrideWithValue(messageRepository)],
    child: MaterialApp(
      theme: lightTheme(),
      darkTheme: darkTheme(),
      themeMode: themeMode,
      home: const MessageDetailScreen(messageId: 'm1'),
    ),
  );
}

api.MessageDetail _message() => api.MessageDetail(
  (b) => b
    ..id = 'm1'
    ..mailboxId = 1
    ..folder = api.MessageDetailFolderEnum.inbox
    ..fromAddress = 'sarah@example.com'
    ..fromName = 'Sarah Chen'
    ..toAddresses = 'me@zerospam.test'
    ..subject = 'Security review notes'
    ..preview = 'I left the new findings and action items in the shared doc.'
    ..receivedAt = DateTime(2026, 6, 13, 11, 52).millisecondsSinceEpoch
    ..read = 0
    ..starred = 1
    ..sizeBytes = 4210
    ..attachmentCount = 1
    ..bodyText = '''Hi team,

I reviewed the latest ZeroSpam quarantine flow and added notes to the shared document.

The main recommendation is to keep primary actions visible, make destructive actions require confirmation, and preserve strong contrast in both themes.

Thanks,
Sarah'''
    ..bodyHtml = null
    ..ccAddresses = 'security@example.com',
);
