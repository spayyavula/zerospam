import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'features/auth/application/auth_notifier.dart';
import 'features/auth/presentation/login_screen.dart';
import 'features/inbox/presentation/inbox_list_screen.dart';
import 'features/message/presentation/message_detail_screen.dart';
import 'features/settings/presentation/settings_screen.dart';
import 'features/shell/presentation/shell_screen.dart';

final appRouterProvider = Provider<GoRouter>((ref) {
  final auth = ref.watch(authNotifierProvider);

  return GoRouter(
    initialLocation: '/inbox',
    redirect: (BuildContext context, GoRouterState state) {
      final status = auth.asData?.value.status;
      final signedIn = status == AuthStatus.signedIn;
      final onLogin = state.uri.path == '/login';

      if (!signedIn) {
        return onLogin ? null : '/login';
      }

      if (onLogin) {
        return '/inbox';
      }

      return null;
    },
    routes: [
      GoRoute(path: '/', redirect: (context, state) => '/inbox'),
      GoRoute(path: '/login', builder: (context, state) => const LoginScreen()),
      StatefulShellRoute.indexedStack(
        builder: (context, state, navigationShell) =>
            ShellScreen(navigationShell: navigationShell),
        branches: [
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/inbox',
                builder: (context, state) =>
                    const InboxListScreen(folder: 'inbox'),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/quarantine',
                builder: (context, state) =>
                    const InboxListScreen(folder: 'quarantine'),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/sent',
                builder: (context, state) =>
                    const InboxListScreen(folder: 'sent'),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/trash',
                builder: (context, state) =>
                    const InboxListScreen(folder: 'trash'),
              ),
            ],
          ),
        ],
      ),
      GoRoute(
        path: '/messages/:id',
        builder: (context, state) {
          final id = state.pathParameters['id']!;
          return MessageDetailScreen(messageId: id);
        },
      ),
      GoRoute(
        path: '/settings',
        builder: (context, state) => const SettingsScreen(),
      ),
    ],
  );
});
