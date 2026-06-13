// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'auth_me_user.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

class _$AuthMeUser extends AuthMeUser {
  @override
  final int id;
  @override
  final String email;
  @override
  final bool totpEnabled;
  @override
  final int? tourCompletedAt;

  factory _$AuthMeUser([void Function(AuthMeUserBuilder)? updates]) =>
      (AuthMeUserBuilder()..update(updates))._build();

  _$AuthMeUser._({
    required this.id,
    required this.email,
    required this.totpEnabled,
    this.tourCompletedAt,
  }) : super._();
  @override
  AuthMeUser rebuild(void Function(AuthMeUserBuilder) updates) =>
      (toBuilder()..update(updates)).build();

  @override
  AuthMeUserBuilder toBuilder() => AuthMeUserBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is AuthMeUser &&
        id == other.id &&
        email == other.email &&
        totpEnabled == other.totpEnabled &&
        tourCompletedAt == other.tourCompletedAt;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, id.hashCode);
    _$hash = $jc(_$hash, email.hashCode);
    _$hash = $jc(_$hash, totpEnabled.hashCode);
    _$hash = $jc(_$hash, tourCompletedAt.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(r'AuthMeUser')
          ..add('id', id)
          ..add('email', email)
          ..add('totpEnabled', totpEnabled)
          ..add('tourCompletedAt', tourCompletedAt))
        .toString();
  }
}

class AuthMeUserBuilder implements Builder<AuthMeUser, AuthMeUserBuilder> {
  _$AuthMeUser? _$v;

  int? _id;
  int? get id => _$this._id;
  set id(int? id) => _$this._id = id;

  String? _email;
  String? get email => _$this._email;
  set email(String? email) => _$this._email = email;

  bool? _totpEnabled;
  bool? get totpEnabled => _$this._totpEnabled;
  set totpEnabled(bool? totpEnabled) => _$this._totpEnabled = totpEnabled;

  int? _tourCompletedAt;
  int? get tourCompletedAt => _$this._tourCompletedAt;
  set tourCompletedAt(int? tourCompletedAt) =>
      _$this._tourCompletedAt = tourCompletedAt;

  AuthMeUserBuilder() {
    AuthMeUser._defaults(this);
  }

  AuthMeUserBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _id = $v.id;
      _email = $v.email;
      _totpEnabled = $v.totpEnabled;
      _tourCompletedAt = $v.tourCompletedAt;
      _$v = null;
    }
    return this;
  }

  @override
  void replace(AuthMeUser other) {
    _$v = other as _$AuthMeUser;
  }

  @override
  void update(void Function(AuthMeUserBuilder)? updates) {
    if (updates != null) updates(this);
  }

  @override
  AuthMeUser build() => _build();

  _$AuthMeUser _build() {
    final _$result =
        _$v ??
        _$AuthMeUser._(
          id: BuiltValueNullFieldError.checkNotNull(id, r'AuthMeUser', 'id'),
          email: BuiltValueNullFieldError.checkNotNull(
            email,
            r'AuthMeUser',
            'email',
          ),
          totpEnabled: BuiltValueNullFieldError.checkNotNull(
            totpEnabled,
            r'AuthMeUser',
            'totpEnabled',
          ),
          tourCompletedAt: tourCompletedAt,
        );
    replace(_$result);
    return _$result;
  }
}

// ignore_for_file: deprecated_member_use_from_same_package,type=lint
