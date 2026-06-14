// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'folder_count.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

class _$FolderCount extends FolderCount {
  @override
  final int total;
  @override
  final int unread;

  factory _$FolderCount([void Function(FolderCountBuilder)? updates]) =>
      (FolderCountBuilder()..update(updates))._build();

  _$FolderCount._({required this.total, required this.unread}) : super._();
  @override
  FolderCount rebuild(void Function(FolderCountBuilder) updates) =>
      (toBuilder()..update(updates)).build();

  @override
  FolderCountBuilder toBuilder() => FolderCountBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is FolderCount &&
        total == other.total &&
        unread == other.unread;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, total.hashCode);
    _$hash = $jc(_$hash, unread.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(r'FolderCount')
          ..add('total', total)
          ..add('unread', unread))
        .toString();
  }
}

class FolderCountBuilder implements Builder<FolderCount, FolderCountBuilder> {
  _$FolderCount? _$v;

  int? _total;
  int? get total => _$this._total;
  set total(int? total) => _$this._total = total;

  int? _unread;
  int? get unread => _$this._unread;
  set unread(int? unread) => _$this._unread = unread;

  FolderCountBuilder() {
    FolderCount._defaults(this);
  }

  FolderCountBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _total = $v.total;
      _unread = $v.unread;
      _$v = null;
    }
    return this;
  }

  @override
  void replace(FolderCount other) {
    _$v = other as _$FolderCount;
  }

  @override
  void update(void Function(FolderCountBuilder)? updates) {
    if (updates != null) updates(this);
  }

  @override
  FolderCount build() => _build();

  _$FolderCount _build() {
    final _$result =
        _$v ??
        _$FolderCount._(
          total: BuiltValueNullFieldError.checkNotNull(
            total,
            r'FolderCount',
            'total',
          ),
          unread: BuiltValueNullFieldError.checkNotNull(
            unread,
            r'FolderCount',
            'unread',
          ),
        );
    replace(_$result);
    return _$result;
  }
}

// ignore_for_file: deprecated_member_use_from_same_package,type=lint
