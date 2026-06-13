import 'package:flutter/foundation.dart';

/// The device platform string the backend enumerates ('ios' | 'android' | 'web'),
/// or `null` for platforms it doesn't model (desktop) so the server can infer a
/// default. Derived from the running platform rather than hard-coded, so devices
/// are reported accurately regardless of where the app runs.
///
/// [isWeb] and [target] are injectable for tests; they default to the real
/// running platform.
String? devicePlatform({bool isWeb = kIsWeb, TargetPlatform? target}) {
  if (isWeb) return 'web';
  switch (target ?? defaultTargetPlatform) {
    case TargetPlatform.iOS:
      return 'ios';
    case TargetPlatform.android:
      return 'android';
    case TargetPlatform.fuchsia:
    case TargetPlatform.linux:
    case TargetPlatform.macOS:
    case TargetPlatform.windows:
      return null;
  }
}
