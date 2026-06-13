import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:zerospam_flutter/core/providers.dart';
import 'package:zerospam_flutter/core/token_store.dart';
import 'package:zerospam_flutter/data/repositories/auth_repository.dart';
import 'package:zerospam_flutter/features/auth/presentation/login_screen.dart';
import 'package:zerospam_flutter/theme/app_theme.dart';

class _MockAuthRepository extends Mock implements AuthRepository {}

class _FakeTokenStore implements TokenStore {
  String? _token;

  @override
  Future<void> clear() async => _token = null;

  @override
  Future<String?> read() async => _token;

  @override
  Future<void> write(String token) async => _token = token;
}

void main() {
  group(
    'login goldens',
    skip:
        'Non-gating visual coverage; update intentionally with --update-goldens.',
    () {
      testWidgets('light', (tester) async {
        await tester.pumpWidget(_wrap(ThemeMode.light));
        await tester.pumpAndSettle();

        await expectLater(
          find.byType(LoginScreen),
          matchesGoldenFile('login_light.png'),
        );
      });

      testWidgets('dark', (tester) async {
        await tester.pumpWidget(_wrap(ThemeMode.dark));
        await tester.pumpAndSettle();

        await expectLater(
          find.byType(LoginScreen),
          matchesGoldenFile('login_dark.png'),
        );
      });
    },
  );
}

Widget _wrap(ThemeMode themeMode) {
  return ProviderScope(
    overrides: [
      authRepositoryProvider.overrideWithValue(_MockAuthRepository()),
      tokenStoreProvider.overrideWithValue(_FakeTokenStore()),
    ],
    child: MaterialApp(
      theme: lightTheme(),
      darkTheme: darkTheme(),
      themeMode: themeMode,
      home: const LoginScreen(),
    ),
  );
}
