// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'auth_me.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

class _$AuthMe extends AuthMe {
  @override
  final AuthMeUser user;

  factory _$AuthMe([void Function(AuthMeBuilder)? updates]) =>
      (AuthMeBuilder()..update(updates))._build();

  _$AuthMe._({required this.user}) : super._();
  @override
  AuthMe rebuild(void Function(AuthMeBuilder) updates) =>
      (toBuilder()..update(updates)).build();

  @override
  AuthMeBuilder toBuilder() => AuthMeBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is AuthMe && user == other.user;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, user.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(
      r'AuthMe',
    )..add('user', user)).toString();
  }
}

class AuthMeBuilder implements Builder<AuthMe, AuthMeBuilder> {
  _$AuthMe? _$v;

  AuthMeUserBuilder? _user;
  AuthMeUserBuilder get user => _$this._user ??= AuthMeUserBuilder();
  set user(AuthMeUserBuilder? user) => _$this._user = user;

  AuthMeBuilder() {
    AuthMe._defaults(this);
  }

  AuthMeBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _user = $v.user.toBuilder();
      _$v = null;
    }
    return this;
  }

  @override
  void replace(AuthMe other) {
    _$v = other as _$AuthMe;
  }

  @override
  void update(void Function(AuthMeBuilder)? updates) {
    if (updates != null) updates(this);
  }

  @override
  AuthMe build() => _build();

  _$AuthMe _build() {
    _$AuthMe _$result;
    try {
      _$result = _$v ?? _$AuthMe._(user: user.build());
    } catch (_) {
      late String _$failedField;
      try {
        _$failedField = 'user';
        user.build();
      } catch (e) {
        throw BuiltValueNestedFieldError(
          r'AuthMe',
          _$failedField,
          e.toString(),
        );
      }
      rethrow;
    }
    replace(_$result);
    return _$result;
  }
}

// ignore_for_file: deprecated_member_use_from_same_package,type=lint
