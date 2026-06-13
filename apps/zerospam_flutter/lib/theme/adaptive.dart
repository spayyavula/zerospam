import 'dart:io';

import 'package:flutter/cupertino.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';

/// True when the current runtime should prefer Cupertino idioms.
bool get isCupertino => !kIsWeb && (Platform.isIOS || Platform.isMacOS);

/// Returns scroll physics that match the current platform family.
ScrollPhysics adaptiveScrollPhysics() {
  return isCupertino
      ? const BouncingScrollPhysics(parent: AlwaysScrollableScrollPhysics())
      : const ClampingScrollPhysics();
}

/// Returns a page transition builder that follows the current platform family.
PageTransitionsBuilder adaptivePageTransition() {
  return isCupertino
      ? const CupertinoPageTransitionsBuilder()
      : const ZoomPageTransitionsBuilder();
}

/// Returns a platform-adaptive switch behind one interface.
Widget adaptiveSwitch({
  required bool value,
  required ValueChanged<bool>? onChanged,
  Color? activeColor,
  Color? inactiveTrackColor,
}) {
  if (isCupertino) {
    return CupertinoSwitch(
      value: value,
      onChanged: onChanged,
      activeTrackColor: activeColor,
      inactiveTrackColor: inactiveTrackColor,
    );
  }

  return Switch(
    value: value,
    onChanged: onChanged,
    activeThumbColor: activeColor,
    inactiveTrackColor: inactiveTrackColor,
  );
}

/// Shows a platform-adaptive dialog behind one interface.
Future<T?> adaptiveDialog<T>({
  required BuildContext context,
  required Widget title,
  required Widget content,
  List<Widget> actions = const <Widget>[],
  bool barrierDismissible = true,
}) {
  if (isCupertino) {
    return showCupertinoDialog<T>(
      context: context,
      barrierDismissible: barrierDismissible,
      builder: (context) => CupertinoAlertDialog(
        title: title,
        content: content,
        actions: actions,
      ),
    );
  }

  return showDialog<T>(
    context: context,
    barrierDismissible: barrierDismissible,
    builder: (context) =>
        AlertDialog(title: title, content: content, actions: actions),
  );
}
