// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'mailbox_counts_inbox.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

class _$MailboxCountsInbox extends MailboxCountsInbox {
  @override
  final int total;
  @override
  final int unread;

  factory _$MailboxCountsInbox([
    void Function(MailboxCountsInboxBuilder)? updates,
  ]) => (MailboxCountsInboxBuilder()..update(updates))._build();

  _$MailboxCountsInbox._({required this.total, required this.unread})
    : super._();
  @override
  MailboxCountsInbox rebuild(
    void Function(MailboxCountsInboxBuilder) updates,
  ) => (toBuilder()..update(updates)).build();

  @override
  MailboxCountsInboxBuilder toBuilder() =>
      MailboxCountsInboxBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is MailboxCountsInbox &&
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
    return (newBuiltValueToStringHelper(r'MailboxCountsInbox')
          ..add('total', total)
          ..add('unread', unread))
        .toString();
  }
}

class MailboxCountsInboxBuilder
    implements Builder<MailboxCountsInbox, MailboxCountsInboxBuilder> {
  _$MailboxCountsInbox? _$v;

  int? _total;
  int? get total => _$this._total;
  set total(int? total) => _$this._total = total;

  int? _unread;
  int? get unread => _$this._unread;
  set unread(int? unread) => _$this._unread = unread;

  MailboxCountsInboxBuilder() {
    MailboxCountsInbox._defaults(this);
  }

  MailboxCountsInboxBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _total = $v.total;
      _unread = $v.unread;
      _$v = null;
    }
    return this;
  }

  @override
  void replace(MailboxCountsInbox other) {
    _$v = other as _$MailboxCountsInbox;
  }

  @override
  void update(void Function(MailboxCountsInboxBuilder)? updates) {
    if (updates != null) updates(this);
  }

  @override
  MailboxCountsInbox build() => _build();

  _$MailboxCountsInbox _build() {
    final _$result =
        _$v ??
        _$MailboxCountsInbox._(
          total: BuiltValueNullFieldError.checkNotNull(
            total,
            r'MailboxCountsInbox',
            'total',
          ),
          unread: BuiltValueNullFieldError.checkNotNull(
            unread,
            r'MailboxCountsInbox',
            'unread',
          ),
        );
    replace(_$result);
    return _$result;
  }
}

// ignore_for_file: deprecated_member_use_from_same_package,type=lint
