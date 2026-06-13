import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:openapi/openapi.dart' as api;

import '../../inbox/application/inbox_notifier.dart';

class ShellScreen extends ConsumerWidget {
  const ShellScreen({super.key, required this.navigationShell});

  final StatefulNavigationShell navigationShell;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final counts = ref
        .watch(mailboxCountsProvider)
        .maybeWhen(data: (counts) => counts, orElse: () => null);
    return Scaffold(
      body: navigationShell,
      bottomNavigationBar: NavigationBar(
        selectedIndex: navigationShell.currentIndex,
        onDestinationSelected: (index) {
          navigationShell.goBranch(
            index,
            initialLocation: index == navigationShell.currentIndex,
          );
        },
        destinations: [
          NavigationDestination(
            icon: _badgeIcon(Icons.inbox_outlined, _unread(counts?.inbox)),
            selectedIcon: _badgeIcon(
              Icons.inbox_rounded,
              _unread(counts?.inbox),
            ),
            label: 'Inbox',
          ),
          NavigationDestination(
            icon: _badgeIcon(
              Icons.shield_outlined,
              _unread(counts?.quarantine),
            ),
            selectedIcon: _badgeIcon(
              Icons.shield_rounded,
              _unread(counts?.quarantine),
            ),
            label: 'Quarantine',
          ),
          const NavigationDestination(
            icon: Icon(Icons.send_outlined),
            selectedIcon: Icon(Icons.send_rounded),
            label: 'Sent',
          ),
          NavigationDestination(
            icon: _badgeIcon(Icons.delete_outline, _unread(counts?.trash)),
            selectedIcon: _badgeIcon(
              Icons.delete_rounded,
              _unread(counts?.trash),
            ),
            label: 'Trash',
          ),
        ],
      ),
    );
  }

  int _unread(api.MailboxCountsInbox? count) => count?.unread ?? 0;

  Widget _badgeIcon(IconData icon, int unread) {
    final child = Icon(icon);
    if (unread <= 0) return child;
    return Badge(label: Text(unread > 99 ? '99+' : '$unread'), child: child);
  }
}
