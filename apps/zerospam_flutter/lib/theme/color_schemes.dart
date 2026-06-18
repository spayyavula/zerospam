import 'package:flutter/material.dart';

/// ZeroSpam's secure teal-green brand seed.
const brandSeed = Color(0xFF1B6B5C);

/// Material 3 light color scheme derived from the ZeroSpam brand seed.
final ColorScheme lightScheme = ColorScheme.fromSeed(
  seedColor: brandSeed,
  brightness: Brightness.light,
);

/// Material 3 dark color scheme derived from the ZeroSpam brand seed.
final ColorScheme darkScheme = ColorScheme.fromSeed(
  seedColor: brandSeed,
  brightness: Brightness.dark,
);
