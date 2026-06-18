import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../theme/motion.dart';
import '../application/auth_notifier.dart';

class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});
  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  final _formKey = GlobalKey<FormState>();
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
    final colorScheme = theme.colorScheme;
    final textTheme = theme.textTheme;

    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 440),
              child: Form(
                key: _formKey,
                child: AutofillGroup(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Semantics(
                        header: true,
                        child: Column(
                          children: [
                            Container(
                              width: 72,
                              height: 72,
                              decoration: BoxDecoration(
                                color: colorScheme.primaryContainer,
                                borderRadius: BorderRadius.circular(24),
                                boxShadow: [
                                  BoxShadow(
                                    color: colorScheme.shadow.withValues(
                                      alpha: 0.12,
                                    ),
                                    blurRadius: 24,
                                    offset: const Offset(0, 12),
                                  ),
                                ],
                              ),
                              child: Icon(
                                Icons.verified_user_outlined,
                                size: 40,
                                color: colorScheme.onPrimaryContainer,
                                semanticLabel: 'ZeroSpam logo',
                              ),
                            ),
                            const SizedBox(height: 20),
                            Text(
                              'ZeroSpam',
                              style: textTheme.headlineLarge?.copyWith(
                                color: colorScheme.onSurface,
                                fontWeight: FontWeight.w800,
                              ),
                              textAlign: TextAlign.center,
                            ),
                            const SizedBox(height: 8),
                            Text(
                              'Secure mail screening for the messages that matter.',
                              style: textTheme.bodyLarge?.copyWith(
                                color: colorScheme.onSurfaceVariant,
                              ),
                              textAlign: TextAlign.center,
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 32),
                      Card(
                        margin: EdgeInsets.zero,
                        child: Padding(
                          padding: const EdgeInsets.all(20),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: [
                              Text(
                                'Sign in',
                                style: textTheme.titleLarge?.copyWith(
                                  color: colorScheme.onSurface,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                              const SizedBox(height: 16),
                              TextFormField(
                                key: const Key('email'),
                                controller: _email,
                                decoration: const InputDecoration(
                                  labelText: 'Email',
                                  hintText: 'you@example.com',
                                  prefixIcon: Icon(Icons.alternate_email),
                                ),
                                keyboardType: TextInputType.emailAddress,
                                textInputAction: TextInputAction.next,
                                autofillHints: const [AutofillHints.username],
                                validator: _validateEmail,
                              ),
                              const SizedBox(height: 12),
                              TextFormField(
                                key: const Key('password'),
                                controller: _password,
                                decoration: const InputDecoration(
                                  labelText: 'Password',
                                  prefixIcon: Icon(Icons.lock_outline),
                                ),
                                obscureText: true,
                                textInputAction: needsTotp
                                    ? TextInputAction.next
                                    : TextInputAction.done,
                                autofillHints: const [AutofillHints.password],
                                validator: _validateRequired,
                                onFieldSubmitted: (_) {
                                  if (!needsTotp) _submit(needsTotp);
                                },
                              ),
                              if (needsTotp) ...[
                                const SizedBox(height: 12),
                                TextFormField(
                                  key: const Key('totp'),
                                  controller: _totp,
                                  decoration: const InputDecoration(
                                    labelText: '6-digit code',
                                    helperText:
                                        'Enter the code from your authenticator app.',
                                    prefixIcon: Icon(Icons.pin_outlined),
                                  ),
                                  keyboardType: TextInputType.number,
                                  textInputAction: TextInputAction.done,
                                  autofillHints: const [
                                    AutofillHints.oneTimeCode,
                                  ],
                                  validator: _validateTotp,
                                  onFieldSubmitted: (_) => _submit(needsTotp),
                                ),
                              ],
                              const SizedBox(height: 16),
                              if (auth.hasError)
                                _ErrorSurface(message: '${auth.error}'),
                              if (auth.hasError) const SizedBox(height: 12),
                              Semantics(
                                button: true,
                                enabled: !auth.isLoading,
                                label: auth.isLoading
                                    ? 'Signing in'
                                    : 'Sign in to ZeroSpam',
                                child: FilledButton(
                                  key: const Key('submit'),
                                  onPressed: auth.isLoading
                                      ? null
                                      : () => _submit(needsTotp),
                                  child: AnimatedSwitcher(
                                    duration: AppMotion.fast,
                                    child: auth.isLoading
                                        ? const SizedBox.square(
                                            key: ValueKey('login-progress'),
                                            dimension: 20,
                                            child: CircularProgressIndicator(
                                              strokeWidth: 2.5,
                                            ),
                                          )
                                        : const Text(
                                            'Sign in securely',
                                            key: ValueKey('login-label'),
                                          ),
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  String? _validateEmail(String? value) {
    final trimmed = value?.trim() ?? '';
    if (trimmed.isEmpty) return 'Enter your email address';
    if (!trimmed.contains('@')) return 'Enter a valid email address';
    return null;
  }

  String? _validateRequired(String? value) {
    if (value == null || value.isEmpty) return 'Enter your password';
    return null;
  }

  String? _validateTotp(String? value) {
    final trimmed = value?.trim() ?? '';
    if (trimmed.isEmpty) return 'Enter your 6-digit code';
    if (trimmed.length != 6) return 'Use the 6-digit code';
    return null;
  }

  void _submit(bool needsTotp) {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    ref
        .read(authNotifierProvider.notifier)
        .signIn(
          _email.text.trim(),
          _password.text,
          totp: needsTotp ? _totp.text.trim() : null,
        );
  }
}

class _ErrorSurface extends StatelessWidget {
  const _ErrorSurface({required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;

    return Semantics(
      liveRegion: true,
      child: Container(
        key: const Key('error'),
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: colorScheme.errorContainer,
          borderRadius: BorderRadius.circular(12),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(
              Icons.error_outline,
              color: colorScheme.onErrorContainer,
              semanticLabel: 'Sign in error',
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                message,
                style: theme.textTheme.bodyMedium?.copyWith(
                  color: colorScheme.onErrorContainer,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
