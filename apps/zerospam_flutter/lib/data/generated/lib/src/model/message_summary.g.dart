// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'message_summary.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

const MessageSummaryFolderEnum _$messageSummaryFolderEnum_inbox =
    const MessageSummaryFolderEnum._('inbox');
const MessageSummaryFolderEnum _$messageSummaryFolderEnum_quarantine =
    const MessageSummaryFolderEnum._('quarantine');
const MessageSummaryFolderEnum _$messageSummaryFolderEnum_sent =
    const MessageSummaryFolderEnum._('sent');
const MessageSummaryFolderEnum _$messageSummaryFolderEnum_trash =
    const MessageSummaryFolderEnum._('trash');

MessageSummaryFolderEnum _$messageSummaryFolderEnumValueOf(String name) {
  switch (name) {
    case 'inbox':
      return _$messageSummaryFolderEnum_inbox;
    case 'quarantine':
      return _$messageSummaryFolderEnum_quarantine;
    case 'sent':
      return _$messageSummaryFolderEnum_sent;
    case 'trash':
      return _$messageSummaryFolderEnum_trash;
    default:
      throw ArgumentError(name);
  }
}

final BuiltSet<MessageSummaryFolderEnum> _$messageSummaryFolderEnumValues =
    BuiltSet<MessageSummaryFolderEnum>(const <MessageSummaryFolderEnum>[
      _$messageSummaryFolderEnum_inbox,
      _$messageSummaryFolderEnum_quarantine,
      _$messageSummaryFolderEnum_sent,
      _$messageSummaryFolderEnum_trash,
    ]);

Serializer<MessageSummaryFolderEnum> _$messageSummaryFolderEnumSerializer =
    _$MessageSummaryFolderEnumSerializer();

class _$MessageSummaryFolderEnumSerializer
    implements PrimitiveSerializer<MessageSummaryFolderEnum> {
  static const Map<String, Object> _toWire = const <String, Object>{
    'inbox': 'inbox',
    'quarantine': 'quarantine',
    'sent': 'sent',
    'trash': 'trash',
  };
  static const Map<Object, String> _fromWire = const <Object, String>{
    'inbox': 'inbox',
    'quarantine': 'quarantine',
    'sent': 'sent',
    'trash': 'trash',
  };

  @override
  final Iterable<Type> types = const <Type>[MessageSummaryFolderEnum];
  @override
  final String wireName = 'MessageSummaryFolderEnum';

  @override
  Object serialize(
    Serializers serializers,
    MessageSummaryFolderEnum object, {
    FullType specifiedType = FullType.unspecified,
  }) => _toWire[object.name] ?? object.name;

  @override
  MessageSummaryFolderEnum deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) => MessageSummaryFolderEnum.valueOf(
    _fromWire[serialized] ?? (serialized is String ? serialized : ''),
  );
}

class _$MessageSummary extends MessageSummary {
  @override
  final String id;
  @override
  final int mailboxId;
  @override
  final MessageSummaryFolderEnum folder;
  @override
  final String fromAddress;
  @override
  final String? fromName;
  @override
  final String toAddresses;
  @override
  final String? subject;
  @override
  final String? preview;
  @override
  final int receivedAt;
  @override
  final int? expiresAt;
  @override
  final int read;
  @override
  final int starred;
  @override
  final int sizeBytes;
  @override
  final int attachmentCount;

  factory _$MessageSummary([void Function(MessageSummaryBuilder)? updates]) =>
      (MessageSummaryBuilder()..update(updates))._build();

  _$MessageSummary._({
    required this.id,
    required this.mailboxId,
    required this.folder,
    required this.fromAddress,
    this.fromName,
    required this.toAddresses,
    this.subject,
    this.preview,
    required this.receivedAt,
    this.expiresAt,
    required this.read,
    required this.starred,
    required this.sizeBytes,
    required this.attachmentCount,
  }) : super._();
  @override
  MessageSummary rebuild(void Function(MessageSummaryBuilder) updates) =>
      (toBuilder()..update(updates)).build();

  @override
  MessageSummaryBuilder toBuilder() => MessageSummaryBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is MessageSummary &&
        id == other.id &&
        mailboxId == other.mailboxId &&
        folder == other.folder &&
        fromAddress == other.fromAddress &&
        fromName == other.fromName &&
        toAddresses == other.toAddresses &&
        subject == other.subject &&
        preview == other.preview &&
        receivedAt == other.receivedAt &&
        expiresAt == other.expiresAt &&
        read == other.read &&
        starred == other.starred &&
        sizeBytes == other.sizeBytes &&
        attachmentCount == other.attachmentCount;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, id.hashCode);
    _$hash = $jc(_$hash, mailboxId.hashCode);
    _$hash = $jc(_$hash, folder.hashCode);
    _$hash = $jc(_$hash, fromAddress.hashCode);
    _$hash = $jc(_$hash, fromName.hashCode);
    _$hash = $jc(_$hash, toAddresses.hashCode);
    _$hash = $jc(_$hash, subject.hashCode);
    _$hash = $jc(_$hash, preview.hashCode);
    _$hash = $jc(_$hash, receivedAt.hashCode);
    _$hash = $jc(_$hash, expiresAt.hashCode);
    _$hash = $jc(_$hash, read.hashCode);
    _$hash = $jc(_$hash, starred.hashCode);
    _$hash = $jc(_$hash, sizeBytes.hashCode);
    _$hash = $jc(_$hash, attachmentCount.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(r'MessageSummary')
          ..add('id', id)
          ..add('mailboxId', mailboxId)
          ..add('folder', folder)
          ..add('fromAddress', fromAddress)
          ..add('fromName', fromName)
          ..add('toAddresses', toAddresses)
          ..add('subject', subject)
          ..add('preview', preview)
          ..add('receivedAt', receivedAt)
          ..add('expiresAt', expiresAt)
          ..add('read', read)
          ..add('starred', starred)
          ..add('sizeBytes', sizeBytes)
          ..add('attachmentCount', attachmentCount))
        .toString();
  }
}

class MessageSummaryBuilder
    implements Builder<MessageSummary, MessageSummaryBuilder> {
  _$MessageSummary? _$v;

  String? _id;
  String? get id => _$this._id;
  set id(String? id) => _$this._id = id;

  int? _mailboxId;
  int? get mailboxId => _$this._mailboxId;
  set mailboxId(int? mailboxId) => _$this._mailboxId = mailboxId;

  MessageSummaryFolderEnum? _folder;
  MessageSummaryFolderEnum? get folder => _$this._folder;
  set folder(MessageSummaryFolderEnum? folder) => _$this._folder = folder;

  String? _fromAddress;
  String? get fromAddress => _$this._fromAddress;
  set fromAddress(String? fromAddress) => _$this._fromAddress = fromAddress;

  String? _fromName;
  String? get fromName => _$this._fromName;
  set fromName(String? fromName) => _$this._fromName = fromName;

  String? _toAddresses;
  String? get toAddresses => _$this._toAddresses;
  set toAddresses(String? toAddresses) => _$this._toAddresses = toAddresses;

  String? _subject;
  String? get subject => _$this._subject;
  set subject(String? subject) => _$this._subject = subject;

  String? _preview;
  String? get preview => _$this._preview;
  set preview(String? preview) => _$this._preview = preview;

  int? _receivedAt;
  int? get receivedAt => _$this._receivedAt;
  set receivedAt(int? receivedAt) => _$this._receivedAt = receivedAt;

  int? _expiresAt;
  int? get expiresAt => _$this._expiresAt;
  set expiresAt(int? expiresAt) => _$this._expiresAt = expiresAt;

  int? _read;
  int? get read => _$this._read;
  set read(int? read) => _$this._read = read;

  int? _starred;
  int? get starred => _$this._starred;
  set starred(int? starred) => _$this._starred = starred;

  int? _sizeBytes;
  int? get sizeBytes => _$this._sizeBytes;
  set sizeBytes(int? sizeBytes) => _$this._sizeBytes = sizeBytes;

  int? _attachmentCount;
  int? get attachmentCount => _$this._attachmentCount;
  set attachmentCount(int? attachmentCount) =>
      _$this._attachmentCount = attachmentCount;

  MessageSummaryBuilder() {
    MessageSummary._defaults(this);
  }

  MessageSummaryBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _id = $v.id;
      _mailboxId = $v.mailboxId;
      _folder = $v.folder;
      _fromAddress = $v.fromAddress;
      _fromName = $v.fromName;
      _toAddresses = $v.toAddresses;
      _subject = $v.subject;
      _preview = $v.preview;
      _receivedAt = $v.receivedAt;
      _expiresAt = $v.expiresAt;
      _read = $v.read;
      _starred = $v.starred;
      _sizeBytes = $v.sizeBytes;
      _attachmentCount = $v.attachmentCount;
      _$v = null;
    }
    return this;
  }

  @override
  void replace(MessageSummary other) {
    _$v = other as _$MessageSummary;
  }

  @override
  void update(void Function(MessageSummaryBuilder)? updates) {
    if (updates != null) updates(this);
  }

  @override
  MessageSummary build() => _build();

  _$MessageSummary _build() {
    final _$result =
        _$v ??
        _$MessageSummary._(
          id: BuiltValueNullFieldError.checkNotNull(
            id,
            r'MessageSummary',
            'id',
          ),
          mailboxId: BuiltValueNullFieldError.checkNotNull(
            mailboxId,
            r'MessageSummary',
            'mailboxId',
          ),
          folder: BuiltValueNullFieldError.checkNotNull(
            folder,
            r'MessageSummary',
            'folder',
          ),
          fromAddress: BuiltValueNullFieldError.checkNotNull(
            fromAddress,
            r'MessageSummary',
            'fromAddress',
          ),
          fromName: fromName,
          toAddresses: BuiltValueNullFieldError.checkNotNull(
            toAddresses,
            r'MessageSummary',
            'toAddresses',
          ),
          subject: subject,
          preview: preview,
          receivedAt: BuiltValueNullFieldError.checkNotNull(
            receivedAt,
            r'MessageSummary',
            'receivedAt',
          ),
          expiresAt: expiresAt,
          read: BuiltValueNullFieldError.checkNotNull(
            read,
            r'MessageSummary',
            'read',
          ),
          starred: BuiltValueNullFieldError.checkNotNull(
            starred,
            r'MessageSummary',
            'starred',
          ),
          sizeBytes: BuiltValueNullFieldError.checkNotNull(
            sizeBytes,
            r'MessageSummary',
            'sizeBytes',
          ),
          attachmentCount: BuiltValueNullFieldError.checkNotNull(
            attachmentCount,
            r'MessageSummary',
            'attachmentCount',
          ),
        );
    replace(_$result);
    return _$result;
  }
}

// ignore_for_file: deprecated_member_use_from_same_package,type=lint
