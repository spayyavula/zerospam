// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'device_register_response.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

class _$DeviceRegisterResponse extends DeviceRegisterResponse {
  @override
  final String token;

  factory _$DeviceRegisterResponse([
    void Function(DeviceRegisterResponseBuilder)? updates,
  ]) => (DeviceRegisterResponseBuilder()..update(updates))._build();

  _$DeviceRegisterResponse._({required this.token}) : super._();
  @override
  DeviceRegisterResponse rebuild(
    void Function(DeviceRegisterResponseBuilder) updates,
  ) => (toBuilder()..update(updates)).build();

  @override
  DeviceRegisterResponseBuilder toBuilder() =>
      DeviceRegisterResponseBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is DeviceRegisterResponse && token == other.token;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, token.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(
      r'DeviceRegisterResponse',
    )..add('token', token)).toString();
  }
}

class DeviceRegisterResponseBuilder
    implements Builder<DeviceRegisterResponse, DeviceRegisterResponseBuilder> {
  _$DeviceRegisterResponse? _$v;

  String? _token;
  String? get token => _$this._token;
  set token(String? token) => _$this._token = token;

  DeviceRegisterResponseBuilder() {
    DeviceRegisterResponse._defaults(this);
  }

  DeviceRegisterResponseBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _token = $v.token;
      _$v = null;
    }
    return this;
  }

  @override
  void replace(DeviceRegisterResponse other) {
    _$v = other as _$DeviceRegisterResponse;
  }

  @override
  void update(void Function(DeviceRegisterResponseBuilder)? updates) {
    if (updates != null) updates(this);
  }

  @override
  DeviceRegisterResponse build() => _build();

  _$DeviceRegisterResponse _build() {
    final _$result =
        _$v ??
        _$DeviceRegisterResponse._(
          token: BuiltValueNullFieldError.checkNotNull(
            token,
            r'DeviceRegisterResponse',
            'token',
          ),
        );
    replace(_$result);
    return _$result;
  }
}

// ignore_for_file: deprecated_member_use_from_same_package,type=lint
