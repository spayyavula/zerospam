// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'login_response.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

class _$LoginResponse extends LoginResponse {
  @override
  final bool? ok;
  @override
  final bool? needsTotp;

  factory _$LoginResponse([void Function(LoginResponseBuilder)? updates]) =>
      (LoginResponseBuilder()..update(updates))._build();

  _$LoginResponse._({this.ok, this.needsTotp}) : super._();
  @override
  LoginResponse rebuild(void Function(LoginResponseBuilder) updates) =>
      (toBuilder()..update(updates)).build();

  @override
  LoginResponseBuilder toBuilder() => LoginResponseBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is LoginResponse &&
        ok == other.ok &&
        needsTotp == other.needsTotp;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, ok.hashCode);
    _$hash = $jc(_$hash, needsTotp.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(r'LoginResponse')
          ..add('ok', ok)
          ..add('needsTotp', needsTotp))
        .toString();
  }
}

class LoginResponseBuilder
    implements Builder<LoginResponse, LoginResponseBuilder> {
  _$LoginResponse? _$v;

  bool? _ok;
  bool? get ok => _$this._ok;
  set ok(bool? ok) => _$this._ok = ok;

  bool? _needsTotp;
  bool? get needsTotp => _$this._needsTotp;
  set needsTotp(bool? needsTotp) => _$this._needsTotp = needsTotp;

  LoginResponseBuilder() {
    LoginResponse._defaults(this);
  }

  LoginResponseBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _ok = $v.ok;
      _needsTotp = $v.needsTotp;
      _$v = null;
    }
    return this;
  }

  @override
  void replace(LoginResponse other) {
    _$v = other as _$LoginResponse;
  }

  @override
  void update(void Function(LoginResponseBuilder)? updates) {
    if (updates != null) updates(this);
  }

  @override
  LoginResponse build() => _build();

  _$LoginResponse _build() {
    final _$result = _$v ?? _$LoginResponse._(ok: ok, needsTotp: needsTotp);
    replace(_$result);
    return _$result;
  }
}

// ignore_for_file: deprecated_member_use_from_same_package,type=lint
