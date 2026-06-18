// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'mailbox_counts.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

class _$MailboxCounts extends MailboxCounts {
  @override
  final MailboxCountsInbox inbox;
  @override
  final MailboxCountsInbox screener;
  @override
  final MailboxCountsInbox quarantine;
  @override
  final MailboxCountsInbox sent;
  @override
  final MailboxCountsInbox trash;
  @override
  final MailboxCountsInbox drafts;

  factory _$MailboxCounts([void Function(MailboxCountsBuilder)? updates]) =>
      (MailboxCountsBuilder()..update(updates))._build();

  _$MailboxCounts._({
    required this.inbox,
    required this.screener,
    required this.quarantine,
    required this.sent,
    required this.trash,
    required this.drafts,
  }) : super._();
  @override
  MailboxCounts rebuild(void Function(MailboxCountsBuilder) updates) =>
      (toBuilder()..update(updates)).build();

  @override
  MailboxCountsBuilder toBuilder() => MailboxCountsBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is MailboxCounts &&
        inbox == other.inbox &&
        screener == other.screener &&
        quarantine == other.quarantine &&
        sent == other.sent &&
        trash == other.trash &&
        drafts == other.drafts;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, inbox.hashCode);
    _$hash = $jc(_$hash, screener.hashCode);
    _$hash = $jc(_$hash, quarantine.hashCode);
    _$hash = $jc(_$hash, sent.hashCode);
    _$hash = $jc(_$hash, trash.hashCode);
    _$hash = $jc(_$hash, drafts.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(r'MailboxCounts')
          ..add('inbox', inbox)
          ..add('screener', screener)
          ..add('quarantine', quarantine)
          ..add('sent', sent)
          ..add('trash', trash)
          ..add('drafts', drafts))
        .toString();
  }
}

class MailboxCountsBuilder
    implements Builder<MailboxCounts, MailboxCountsBuilder> {
  _$MailboxCounts? _$v;

  MailboxCountsInboxBuilder? _inbox;
  MailboxCountsInboxBuilder get inbox =>
      _$this._inbox ??= MailboxCountsInboxBuilder();
  set inbox(MailboxCountsInboxBuilder? inbox) => _$this._inbox = inbox;

  MailboxCountsInboxBuilder? _screener;
  MailboxCountsInboxBuilder get screener =>
      _$this._screener ??= MailboxCountsInboxBuilder();
  set screener(MailboxCountsInboxBuilder? screener) =>
      _$this._screener = screener;

  MailboxCountsInboxBuilder? _quarantine;
  MailboxCountsInboxBuilder get quarantine =>
      _$this._quarantine ??= MailboxCountsInboxBuilder();
  set quarantine(MailboxCountsInboxBuilder? quarantine) =>
      _$this._quarantine = quarantine;

  MailboxCountsInboxBuilder? _sent;
  MailboxCountsInboxBuilder get sent =>
      _$this._sent ??= MailboxCountsInboxBuilder();
  set sent(MailboxCountsInboxBuilder? sent) => _$this._sent = sent;

  MailboxCountsInboxBuilder? _trash;
  MailboxCountsInboxBuilder get trash =>
      _$this._trash ??= MailboxCountsInboxBuilder();
  set trash(MailboxCountsInboxBuilder? trash) => _$this._trash = trash;

  MailboxCountsInboxBuilder? _drafts;
  MailboxCountsInboxBuilder get drafts =>
      _$this._drafts ??= MailboxCountsInboxBuilder();
  set drafts(MailboxCountsInboxBuilder? drafts) => _$this._drafts = drafts;

  MailboxCountsBuilder() {
    MailboxCounts._defaults(this);
  }

  MailboxCountsBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _inbox = $v.inbox.toBuilder();
      _screener = $v.screener.toBuilder();
      _quarantine = $v.quarantine.toBuilder();
      _sent = $v.sent.toBuilder();
      _trash = $v.trash.toBuilder();
      _drafts = $v.drafts.toBuilder();
      _$v = null;
    }
    return this;
  }

  @override
  void replace(MailboxCounts other) {
    _$v = other as _$MailboxCounts;
  }

  @override
  void update(void Function(MailboxCountsBuilder)? updates) {
    if (updates != null) updates(this);
  }

  @override
  MailboxCounts build() => _build();

  _$MailboxCounts _build() {
    _$MailboxCounts _$result;
    try {
      _$result =
          _$v ??
          _$MailboxCounts._(
            inbox: inbox.build(),
            screener: screener.build(),
            quarantine: quarantine.build(),
            sent: sent.build(),
            trash: trash.build(),
            drafts: drafts.build(),
          );
    } catch (_) {
      late String _$failedField;
      try {
        _$failedField = 'inbox';
        inbox.build();
        _$failedField = 'screener';
        screener.build();
        _$failedField = 'quarantine';
        quarantine.build();
        _$failedField = 'sent';
        sent.build();
        _$failedField = 'trash';
        trash.build();
        _$failedField = 'drafts';
        drafts.build();
      } catch (e) {
        throw BuiltValueNestedFieldError(
          r'MailboxCounts',
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
