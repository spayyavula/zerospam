import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'features/auth/application/auth_notifier.dart';
import 'features/auth/presentation/login_screen.dart';
import 'features/inbox/presentation/inbox_list_screen.dart';

class ZeroSpamApp extends ConsumerWidget {
  const ZeroSpamApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final auth = ref.watch(authNotifierProvider);
    return MaterialApp(
      title: 'ZeroSpam',
      theme: ThemeData(colorSchemeSeed: Colors.indigo, useMaterial3: true),
      home: switch (auth.asData?.value.status) {
        AuthStatus.signedIn => const InboxListScreen(),
        _ => const LoginScreen(),
      },
    );
  }
}
