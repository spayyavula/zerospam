import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/providers.dart';
import '../../auth/application/auth_notifier.dart';

final meProvider = FutureProvider((ref) {
  return ref.read(authRepositoryProvider).me();
});

class SettingsScreen extends ConsumerWidget {
  const SettingsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final me = ref.watch(meProvider);
    final auth = ref.watch(authNotifierProvider);
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;

    return Scaffold(
      appBar: AppBar(title: const Text('Settings')),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
        children: [
          Card(
            child: me.when(
              loading: () => const ListTile(
                leading: CircleAvatar(child: Icon(Icons.person_outline)),
                title: Text('Loading account…'),
                subtitle: LinearProgressIndicator(),
              ),
              error: (error, _) => ListTile(
                leading: Icon(Icons.error_outline, color: colorScheme.error),
                title: const Text('Account unavailable'),
                subtitle: Text('$error'),
                trailing: IconButton(
                  tooltip: 'Retry account',
                  onPressed: () => ref.invalidate(meProvider),
                  icon: const Icon(Icons.refresh),
                ),
              ),
              data: (account) => ListTile(
                leading: CircleAvatar(
                  backgroundColor: colorScheme.primaryContainer,
                  foregroundColor: colorScheme.onPrimaryContainer,
                  child: Text(_initial(account.user.email)),
                ),
                title: Text(account.user.email),
                subtitle: Text(
                  account.user.totpEnabled
                      ? 'Two-factor authentication enabled'
                      : 'Two-factor authentication not enabled',
                ),
              ),
            ),
          ),
          const SizedBox(height: 12),
          Card(
            child: Column(
              children: [
                ListTile(
                  leading: const Icon(Icons.palette_outlined),
                  title: const Text('Appearance'),
                  subtitle: Text(
                    'ZeroSpam follows your system light or dark theme.',
                    style: theme.textTheme.bodyMedium?.copyWith(
                      color: colorScheme.onSurfaceVariant,
                    ),
                  ),
                ),
                const Divider(height: 1),
                const ListTile(
                  leading: Icon(Icons.info_outline),
                  title: Text('About ZeroSpam'),
                  subtitle: Text('Secure mail triage for trusted messages.'),
                ),
              ],
            ),
          ),
          const SizedBox(height: 24),
          FilledButton.icon(
            key: const Key('sign-out'),
            style: FilledButton.styleFrom(
              backgroundColor: colorScheme.error,
              foregroundColor: colorScheme.onError,
            ),
            onPressed: auth.isLoading
                ? null
                : () => ref.read(authNotifierProvider.notifier).signOut(),
            icon: const Icon(Icons.logout),
            label: const Text('Sign out'),
          ),
        ],
      ),
    );
  }
}

String _initial(String email) {
  final trimmed = email.trim();
  return trimmed.isEmpty ? '?' : trimmed.characters.first.toUpperCase();
}
