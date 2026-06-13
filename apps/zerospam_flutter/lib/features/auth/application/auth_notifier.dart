import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/providers.dart';

enum AuthStatus { signedOut, signedIn, needsTotp }

class AuthState {
  const AuthState(this.status, {this.error});
  final AuthStatus status;
  final String? error;
}

class AuthNotifier extends AsyncNotifier<AuthState> {
  @override
  Future<AuthState> build() async {
    final token = await ref.read(tokenStoreProvider).read();
    return AuthState(token == null ? AuthStatus.signedOut : AuthStatus.signedIn);
  }

  Future<void> signIn(String email, String password, {String? totp}) async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(() async {
      final auth = ref.read(authRepositoryProvider);
      final loggedIn = await auth.login(email: email, password: password, totp: totp);
      if (!loggedIn) return const AuthState(AuthStatus.needsTotp);
      final token = await auth.registerDevice(name: 'ZeroSpam Flutter', platform: 'android');
      await ref.read(tokenStoreProvider).write(token);
      return const AuthState(AuthStatus.signedIn);
    });
  }

  Future<void> signOut() async {
    await ref.read(tokenStoreProvider).clear();
    state = const AsyncData(AuthState(AuthStatus.signedOut));
  }
}

final authNotifierProvider =
    AsyncNotifierProvider<AuthNotifier, AuthState>(AuthNotifier.new);
