// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'message_detail.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

const MessageDetailFolderEnum _$messageDetailFolderEnum_inbox =
    const MessageDetailFolderEnum._('inbox');
const MessageDetailFolderEnum _$messageDetailFolderEnum_quarantine =
    const MessageDetailFolderEnum._('quarantine');
const MessageDetailFolderEnum _$messageDetailFolderEnum_sent =
    const MessageDetailFolderEnum._('sent');
const MessageDetailFolderEnum _$messageDetailFolderEnum_trash =
    const MessageDetailFolderEnum._('trash');

MessageDetailFolderEnum _$messageDetailFolderEnumValueOf(String name) {
  switch (name) {
    case 'inbox':
      return _$messageDetailFolderEnum_inbox;
    case 'quarantine':
      return _$messageDetailFolderEnum_quarantine;
    case 'sent':
      return _$messageDetailFolderEnum_sent;
    case 'trash':
      return _$messageDetailFolderEnum_trash;
    default:
      throw ArgumentError(name);
  }
}

final BuiltSet<MessageDetailFolderEnum> _$messageDetailFolderEnumValues =
    BuiltSet<MessageDetailFolderEnum>(const <MessageDetailFolderEnum>[
  _$messageDetailFolderEnum_inbox,
  _$messageDetailFolderEnum_quarantine,
  _$messageDetailFolderEnum_sent,
  _$messageDetailFolderEnum_trash,
]);

Serializer<MessageDetailFolderEnum> _$messageDetailFolderEnumSerializer =
    _$MessageDetailFolderEnumSerializer();

class _$MessageDetailFolderEnumSerializer
    implements PrimitiveSerializer<MessageDetailFolderEnum> {
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
  final Iterable<Type> types = const <Type>[MessageDetailFolderEnum];
  @override
  final String wireName = 'MessageDetailFolderEnum';

  @override
  Object serialize(Serializers serializers, MessageDetailFolderEnum object,
          {FullType specifiedType = FullType.unspecified}) =>
      _toWire[object.name] ?? object.name;

  @override
  MessageDetailFolderEnum deserialize(
          Serializers serializers, Object serialized,
          {FullType specifiedType = FullType.unspecified}) =>
      MessageDetailFolderEnum.valueOf(
          _fromWire[serialized] ?? (serialized is String ? serialized : ''));
}

class _$MessageDetail extends MessageDetail {
  @override
  final String id;
  @override
  final int mailboxId;
  @override
  final MessageDetailFolderEnum folder;
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
  @override
  final String? bodyText;
  @override
  final String? bodyHtml;
  @override
  final String? ccAddresses;

  factory _$MessageDetail([void Function(MessageDetailBuilder)? updates]) =>
      (MessageDetailBuilder()..update(updates))._build();

  _$MessageDetail._(
      {required this.id,
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
      this.bodyText,
      this.bodyHtml,
      this.ccAddresses})
      : super._();
  @override
  MessageDetail rebuild(void Function(MessageDetailBuilder) updates) =>
      (toBuilder()..update(updates)).build();

  @override
  MessageDetailBuilder toBuilder() => MessageDetailBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is MessageDetail &&
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
        attachmentCount == other.attachmentCount &&
        bodyText == other.bodyText &&
        bodyHtml == other.bodyHtml &&
        ccAddresses == other.ccAddresses;
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
    _$hash = $jc(_$hash, bodyText.hashCode);
    _$hash = $jc(_$hash, bodyHtml.hashCode);
    _$hash = $jc(_$hash, ccAddresses.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(r'MessageDetail')
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
          ..add('attachmentCount', attachmentCount)
          ..add('bodyText', bodyText)
          ..add('bodyHtml', bodyHtml)
          ..add('ccAddresses', ccAddresses))
        .toString();
  }
}

class MessageDetailBuilder
    implements Builder<MessageDetail, MessageDetailBuilder> {
  _$MessageDetail? _$v;

  String? _id;
  String? get id => _$this._id;
  set id(String? id) => _$this._id = id;

  int? _mailboxId;
  int? get mailboxId => _$this._mailboxId;
  set mailboxId(int? mailboxId) => _$this._mailboxId = mailboxId;

  MessageDetailFolderEnum? _folder;
  MessageDetailFolderEnum? get folder => _$this._folder;
  set folder(MessageDetailFolderEnum? folder) => _$this._folder = folder;

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

  String? _bodyText;
  String? get bodyText => _$this._bodyText;
  set bodyText(String? bodyText) => _$this._bodyText = bodyText;

  String? _bodyHtml;
  String? get bodyHtml => _$this._bodyHtml;
  set bodyHtml(String? bodyHtml) => _$this._bodyHtml = bodyHtml;

  String? _ccAddresses;
  String? get ccAddresses => _$this._ccAddresses;
  set ccAddresses(String? ccAddresses) => _$this._ccAddresses = ccAddresses;

  MessageDetailBuilder() {
    MessageDetail._defaults(this);
  }

  MessageDetailBuilder get _$this {
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
      _bodyText = $v.bodyText;
      _bodyHtml = $v.bodyHtml;
      _ccAddresses = $v.ccAddresses;
      _$v = null;
    }
    return this;
  }

  @override
  void replace(MessageDetail other) {
    _$v = other as _$MessageDetail;
  }

  @override
  void update(void Function(MessageDetailBuilder)? updates) {
    if (updates != null) updates(this);
  }

  @override
  MessageDetail build() => _build();

  _$MessageDetail _build() {
    final _$result = _$v ??
        _$MessageDetail._(
          id: BuiltValueNullFieldError.checkNotNull(id, r'MessageDetail', 'id'),
          mailboxId: BuiltValueNullFieldError.checkNotNull(
              mailboxId, r'MessageDetail', 'mailboxId'),
          folder: BuiltValueNullFieldError.checkNotNull(
              folder, r'MessageDetail', 'folder'),
          fromAddress: BuiltValueNullFieldError.checkNotNull(
              fromAddress, r'MessageDetail', 'fromAddress'),
          fromName: fromName,
          toAddresses: BuiltValueNullFieldError.checkNotNull(
              toAddresses, r'MessageDetail', 'toAddresses'),
          subject: subject,
          preview: preview,
          receivedAt: BuiltValueNullFieldError.checkNotNull(
              receivedAt, r'MessageDetail', 'receivedAt'),
          expiresAt: expiresAt,
          read: BuiltValueNullFieldError.checkNotNull(
              read, r'MessageDetail', 'read'),
          starred: BuiltValueNullFieldError.checkNotNull(
              starred, r'MessageDetail', 'starred'),
          sizeBytes: BuiltValueNullFieldError.checkNotNull(
              sizeBytes, r'MessageDetail', 'sizeBytes'),
          attachmentCount: BuiltValueNullFieldError.checkNotNull(
              attachmentCount, r'MessageDetail', 'attachmentCount'),
          bodyText: bodyText,
          bodyHtml: bodyHtml,
          ccAddresses: ccAddresses,
        );
    replace(_$result);
    return _$result;
  }
}

// ignore_for_file: deprecated_member_use_from_same_package,type=lint
