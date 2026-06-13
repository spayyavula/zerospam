// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'mailbox.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

class _$Mailbox extends Mailbox {
  @override
  final int id;
  @override
  final String address;
  @override
  final int domainId;
  @override
  final String? displayName;
  @override
  final int quarantineTtlHours;
  @override
  final int createdAt;

  factory _$Mailbox([void Function(MailboxBuilder)? updates]) =>
      (MailboxBuilder()..update(updates))._build();

  _$Mailbox._(
      {required this.id,
      required this.address,
      required this.domainId,
      this.displayName,
      required this.quarantineTtlHours,
      required this.createdAt})
      : super._();
  @override
  Mailbox rebuild(void Function(MailboxBuilder) updates) =>
      (toBuilder()..update(updates)).build();

  @override
  MailboxBuilder toBuilder() => MailboxBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is Mailbox &&
        id == other.id &&
        address == other.address &&
        domainId == other.domainId &&
        displayName == other.displayName &&
        quarantineTtlHours == other.quarantineTtlHours &&
        createdAt == other.createdAt;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, id.hashCode);
    _$hash = $jc(_$hash, address.hashCode);
    _$hash = $jc(_$hash, domainId.hashCode);
    _$hash = $jc(_$hash, displayName.hashCode);
    _$hash = $jc(_$hash, quarantineTtlHours.hashCode);
    _$hash = $jc(_$hash, createdAt.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(r'Mailbox')
          ..add('id', id)
          ..add('address', address)
          ..add('domainId', domainId)
          ..add('displayName', displayName)
          ..add('quarantineTtlHours', quarantineTtlHours)
          ..add('createdAt', createdAt))
        .toString();
  }
}

class MailboxBuilder implements Builder<Mailbox, MailboxBuilder> {
  _$Mailbox? _$v;

  int? _id;
  int? get id => _$this._id;
  set id(int? id) => _$this._id = id;

  String? _address;
  String? get address => _$this._address;
  set address(String? address) => _$this._address = address;

  int? _domainId;
  int? get domainId => _$this._domainId;
  set domainId(int? domainId) => _$this._domainId = domainId;

  String? _displayName;
  String? get displayName => _$this._displayName;
  set displayName(String? displayName) => _$this._displayName = displayName;

  int? _quarantineTtlHours;
  int? get quarantineTtlHours => _$this._quarantineTtlHours;
  set quarantineTtlHours(int? quarantineTtlHours) =>
      _$this._quarantineTtlHours = quarantineTtlHours;

  int? _createdAt;
  int? get createdAt => _$this._createdAt;
  set createdAt(int? createdAt) => _$this._createdAt = createdAt;

  MailboxBuilder() {
    Mailbox._defaults(this);
  }

  MailboxBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _id = $v.id;
      _address = $v.address;
      _domainId = $v.domainId;
      _displayName = $v.displayName;
      _quarantineTtlHours = $v.quarantineTtlHours;
      _createdAt = $v.createdAt;
      _$v = null;
    }
    return this;
  }

  @override
  void replace(Mailbox other) {
    _$v = other as _$Mailbox;
  }

  @override
  void update(void Function(MailboxBuilder)? updates) {
    if (updates != null) updates(this);
  }

  @override
  Mailbox build() => _build();

  _$Mailbox _build() {
    final _$result = _$v ??
        _$Mailbox._(
          id: BuiltValueNullFieldError.checkNotNull(id, r'Mailbox', 'id'),
          address: BuiltValueNullFieldError.checkNotNull(
              address, r'Mailbox', 'address'),
          domainId: BuiltValueNullFieldError.checkNotNull(
              domainId, r'Mailbox', 'domainId'),
          displayName: displayName,
          quarantineTtlHours: BuiltValueNullFieldError.checkNotNull(
              quarantineTtlHours, r'Mailbox', 'quarantineTtlHours'),
          createdAt: BuiltValueNullFieldError.checkNotNull(
              createdAt, r'Mailbox', 'createdAt'),
        );
    replace(_$result);
    return _$result;
  }
}

// ignore_for_file: deprecated_member_use_from_same_package,type=lint
