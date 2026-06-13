import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../application/auth_notifier.dart';

class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});
  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  final _email = TextEditingController();
  final _password = TextEditingController();
  final _totp = TextEditingController();

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    _totp.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final auth = ref.watch(authNotifierProvider);
    final needsTotp = auth.asData?.value.status == AuthStatus.needsTotp;
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(title: const Text('ZeroSpam — Sign in')),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            TextField(
              key: const Key('email'),
              controller: _email,
              decoration: const InputDecoration(labelText: 'Email'),
              keyboardType: TextInputType.emailAddress,
            ),
            TextField(
              key: const Key('password'),
              controller: _password,
              decoration: const InputDecoration(labelText: 'Password'),
              obscureText: true,
            ),
            if (needsTotp)
              TextField(
                key: const Key('totp'),
                controller: _totp,
                decoration: const InputDecoration(labelText: '6-digit code'),
                keyboardType: TextInputType.number,
              ),
            const SizedBox(height: 16),
            if (auth.isLoading) const CircularProgressIndicator(),
            if (auth.hasError)
              Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Text(
                  '${auth.error}',
                  key: const Key('error'),
                  style: theme.textTheme.bodyMedium?.copyWith(
                    color: theme.colorScheme.error,
                  ),
                ),
              ),
            FilledButton(
              key: const Key('submit'),
              onPressed: auth.isLoading
                  ? null
                  : () => ref
                        .read(authNotifierProvider.notifier)
                        .signIn(
                          _email.text.trim(),
                          _password.text,
                          totp: needsTotp ? _totp.text.trim() : null,
                        ),
              child: const Text('Sign in'),
            ),
          ],
        ),
      ),
    );
  }
}
