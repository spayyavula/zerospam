// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'device_register_request.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

const DeviceRegisterRequestPlatformEnum
    _$deviceRegisterRequestPlatformEnum_ios =
    const DeviceRegisterRequestPlatformEnum._('ios');
const DeviceRegisterRequestPlatformEnum
    _$deviceRegisterRequestPlatformEnum_android =
    const DeviceRegisterRequestPlatformEnum._('android');
const DeviceRegisterRequestPlatformEnum
    _$deviceRegisterRequestPlatformEnum_web =
    const DeviceRegisterRequestPlatformEnum._('web');

DeviceRegisterRequestPlatformEnum _$deviceRegisterRequestPlatformEnumValueOf(
    String name) {
  switch (name) {
    case 'ios':
      return _$deviceRegisterRequestPlatformEnum_ios;
    case 'android':
      return _$deviceRegisterRequestPlatformEnum_android;
    case 'web':
      return _$deviceRegisterRequestPlatformEnum_web;
    default:
      throw ArgumentError(name);
  }
}

final BuiltSet<DeviceRegisterRequestPlatformEnum>
    _$deviceRegisterRequestPlatformEnumValues = BuiltSet<
        DeviceRegisterRequestPlatformEnum>(const <DeviceRegisterRequestPlatformEnum>[
  _$deviceRegisterRequestPlatformEnum_ios,
  _$deviceRegisterRequestPlatformEnum_android,
  _$deviceRegisterRequestPlatformEnum_web,
]);

Serializer<DeviceRegisterRequestPlatformEnum>
    _$deviceRegisterRequestPlatformEnumSerializer =
    _$DeviceRegisterRequestPlatformEnumSerializer();

class _$DeviceRegisterRequestPlatformEnumSerializer
    implements PrimitiveSerializer<DeviceRegisterRequestPlatformEnum> {
  static const Map<String, Object> _toWire = const <String, Object>{
    'ios': 'ios',
    'android': 'android',
    'web': 'web',
  };
  static const Map<Object, String> _fromWire = const <Object, String>{
    'ios': 'ios',
    'android': 'android',
    'web': 'web',
  };

  @override
  final Iterable<Type> types = const <Type>[DeviceRegisterRequestPlatformEnum];
  @override
  final String wireName = 'DeviceRegisterRequestPlatformEnum';

  @override
  Object serialize(
          Serializers serializers, DeviceRegisterRequestPlatformEnum object,
          {FullType specifiedType = FullType.unspecified}) =>
      _toWire[object.name] ?? object.name;

  @override
  DeviceRegisterRequestPlatformEnum deserialize(
          Serializers serializers, Object serialized,
          {FullType specifiedType = FullType.unspecified}) =>
      DeviceRegisterRequestPlatformEnum.valueOf(
          _fromWire[serialized] ?? (serialized is String ? serialized : ''));
}

class _$DeviceRegisterRequest extends DeviceRegisterRequest {
  @override
  final String name;
  @override
  final DeviceRegisterRequestPlatformEnum? platform;
  @override
  final String? appVersion;

  factory _$DeviceRegisterRequest(
          [void Function(DeviceRegisterRequestBuilder)? updates]) =>
      (DeviceRegisterRequestBuilder()..update(updates))._build();

  _$DeviceRegisterRequest._(
      {required this.name, this.platform, this.appVersion})
      : super._();
  @override
  DeviceRegisterRequest rebuild(
          void Function(DeviceRegisterRequestBuilder) updates) =>
      (toBuilder()..update(updates)).build();

  @override
  DeviceRegisterRequestBuilder toBuilder() =>
      DeviceRegisterRequestBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is DeviceRegisterRequest &&
        name == other.name &&
        platform == other.platform &&
        appVersion == other.appVersion;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, name.hashCode);
    _$hash = $jc(_$hash, platform.hashCode);
    _$hash = $jc(_$hash, appVersion.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(r'DeviceRegisterRequest')
          ..add('name', name)
          ..add('platform', platform)
          ..add('appVersion', appVersion))
        .toString();
  }
}

class DeviceRegisterRequestBuilder
    implements Builder<DeviceRegisterRequest, DeviceRegisterRequestBuilder> {
  _$DeviceRegisterRequest? _$v;

  String? _name;
  String? get name => _$this._name;
  set name(String? name) => _$this._name = name;

  DeviceRegisterRequestPlatformEnum? _platform;
  DeviceRegisterRequestPlatformEnum? get platform => _$this._platform;
  set platform(DeviceRegisterRequestPlatformEnum? platform) =>
      _$this._platform = platform;

  String? _appVersion;
  String? get appVersion => _$this._appVersion;
  set appVersion(String? appVersion) => _$this._appVersion = appVersion;

  DeviceRegisterRequestBuilder() {
    DeviceRegisterRequest._defaults(this);
  }

  DeviceRegisterRequestBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _name = $v.name;
      _platform = $v.platform;
      _appVersion = $v.appVersion;
      _$v = null;
    }
    return this;
  }

  @override
  void replace(DeviceRegisterRequest other) {
    _$v = other as _$DeviceRegisterRequest;
  }

  @override
  void update(void Function(DeviceRegisterRequestBuilder)? updates) {
    if (updates != null) updates(this);
  }

  @override
  DeviceRegisterRequest build() => _build();

  _$DeviceRegisterRequest _build() {
    final _$result = _$v ??
        _$DeviceRegisterRequest._(
          name: BuiltValueNullFieldError.checkNotNull(
              name, r'DeviceRegisterRequest', 'name'),
          platform: platform,
          appVersion: appVersion,
        );
    replace(_$result);
    return _$result;
  }
}

// ignore_for_file: deprecated_member_use_from_same_package,type=lint
