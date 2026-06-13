import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:zerospam_flutter/core/providers.dart';
import 'package:zerospam_flutter/data/repositories/auth_repository.dart';
import 'package:zerospam_flutter/core/token_store.dart';
import 'package:zerospam_flutter/features/auth/presentation/login_screen.dart';

class _MockAuthRepo extends Mock implements AuthRepository {}

class _FakeTokenStore implements TokenStore {
  String? _t;
  @override
  Future<void> clear() async => _t = null;
  @override
  Future<String?> read() async => _t;
  @override
  Future<void> write(String token) async => _t = token;
}

void main() {
  testWidgets('successful sign-in writes a token', (tester) async {
    final repo = _MockAuthRepo();
    final store = _FakeTokenStore();
    // Concrete-value stubs (the screen sends exactly these), so no any()/fallback.
    when(() => repo.login(email: 'me@local', password: 'ChangeMe123!demo', totp: null))
        .thenAnswer((_) async => true);
    when(() => repo.registerDevice(name: 'ZeroSpam Flutter', platform: 'android'))
        .thenAnswer((_) async => 'tok_abc');

    await tester.pumpWidget(ProviderScope(
      overrides: [
        authRepositoryProvider.overrideWithValue(repo),
        tokenStoreProvider.overrideWithValue(store),
      ],
      child: const MaterialApp(home: LoginScreen()),
    ));

    await tester.enterText(find.byKey(const Key('email')), 'me@local');
    await tester.enterText(find.byKey(const Key('password')), 'ChangeMe123!demo');
    await tester.tap(find.byKey(const Key('submit')));
    await tester.pumpAndSettle();

    expect(await store.read(), 'tok_abc');
  });
}
