import 'package:flutter/foundation.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:zerospam_flutter/core/device_platform.dart';

void main() {
  test('web maps to "web"', () {
    expect(devicePlatform(isWeb: true), 'web');
  });

  test('iOS and Android map to their wire values', () {
    expect(devicePlatform(isWeb: false, target: TargetPlatform.iOS), 'ios');
    expect(devicePlatform(isWeb: false, target: TargetPlatform.android), 'android');
  });

  test('desktop platforms are omitted (null) so the server infers a default', () {
    expect(devicePlatform(isWeb: false, target: TargetPlatform.macOS), isNull);
    expect(devicePlatform(isWeb: false, target: TargetPlatform.windows), isNull);
    expect(devicePlatform(isWeb: false, target: TargetPlatform.linux), isNull);
    expect(devicePlatform(isWeb: false, target: TargetPlatform.fuchsia), isNull);
  });
}
