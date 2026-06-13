// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'search_message.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

const SearchMessageFolderEnum _$searchMessageFolderEnum_inbox =
    const SearchMessageFolderEnum._('inbox');
const SearchMessageFolderEnum _$searchMessageFolderEnum_quarantine =
    const SearchMessageFolderEnum._('quarantine');
const SearchMessageFolderEnum _$searchMessageFolderEnum_sent =
    const SearchMessageFolderEnum._('sent');
const SearchMessageFolderEnum _$searchMessageFolderEnum_trash =
    const SearchMessageFolderEnum._('trash');

SearchMessageFolderEnum _$searchMessageFolderEnumValueOf(String name) {
  switch (name) {
    case 'inbox':
      return _$searchMessageFolderEnum_inbox;
    case 'quarantine':
      return _$searchMessageFolderEnum_quarantine;
    case 'sent':
      return _$searchMessageFolderEnum_sent;
    case 'trash':
      return _$searchMessageFolderEnum_trash;
    default:
      throw ArgumentError(name);
  }
}

final BuiltSet<SearchMessageFolderEnum> _$searchMessageFolderEnumValues =
    BuiltSet<SearchMessageFolderEnum>(const <SearchMessageFolderEnum>[
      _$searchMessageFolderEnum_inbox,
      _$searchMessageFolderEnum_quarantine,
      _$searchMessageFolderEnum_sent,
      _$searchMessageFolderEnum_trash,
    ]);

Serializer<SearchMessageFolderEnum> _$searchMessageFolderEnumSerializer =
    _$SearchMessageFolderEnumSerializer();

class _$SearchMessageFolderEnumSerializer
    implements PrimitiveSerializer<SearchMessageFolderEnum> {
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
  final Iterable<Type> types = const <Type>[SearchMessageFolderEnum];
  @override
  final String wireName = 'SearchMessageFolderEnum';

  @override
  Object serialize(
    Serializers serializers,
    SearchMessageFolderEnum object, {
    FullType specifiedType = FullType.unspecified,
  }) => _toWire[object.name] ?? object.name;

  @override
  SearchMessageFolderEnum deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) => SearchMessageFolderEnum.valueOf(
    _fromWire[serialized] ?? (serialized is String ? serialized : ''),
  );
}

class _$SearchMessage extends SearchMessage {
  @override
  final String id;
  @override
  final int mailboxId;
  @override
  final SearchMessageFolderEnum folder;
  @override
  final String fromAddress;
  @override
  final String? fromName;
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
  final int attachmentCount;
  @override
  final int? whitelistMatch;

  factory _$SearchMessage([void Function(SearchMessageBuilder)? updates]) =>
      (SearchMessageBuilder()..update(updates))._build();

  _$SearchMessage._({
    required this.id,
    required this.mailboxId,
    required this.folder,
    required this.fromAddress,
    this.fromName,
    this.subject,
    this.preview,
    required this.receivedAt,
    this.expiresAt,
    required this.read,
    required this.starred,
    required this.attachmentCount,
    this.whitelistMatch,
  }) : super._();
  @override
  SearchMessage rebuild(void Function(SearchMessageBuilder) updates) =>
      (toBuilder()..update(updates)).build();

  @override
  SearchMessageBuilder toBuilder() => SearchMessageBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is SearchMessage &&
        id == other.id &&
        mailboxId == other.mailboxId &&
        folder == other.folder &&
        fromAddress == other.fromAddress &&
        fromName == other.fromName &&
        subject == other.subject &&
        preview == other.preview &&
        receivedAt == other.receivedAt &&
        expiresAt == other.expiresAt &&
        read == other.read &&
        starred == other.starred &&
        attachmentCount == other.attachmentCount &&
        whitelistMatch == other.whitelistMatch;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, id.hashCode);
    _$hash = $jc(_$hash, mailboxId.hashCode);
    _$hash = $jc(_$hash, folder.hashCode);
    _$hash = $jc(_$hash, fromAddress.hashCode);
    _$hash = $jc(_$hash, fromName.hashCode);
    _$hash = $jc(_$hash, subject.hashCode);
    _$hash = $jc(_$hash, preview.hashCode);
    _$hash = $jc(_$hash, receivedAt.hashCode);
    _$hash = $jc(_$hash, expiresAt.hashCode);
    _$hash = $jc(_$hash, read.hashCode);
    _$hash = $jc(_$hash, starred.hashCode);
    _$hash = $jc(_$hash, attachmentCount.hashCode);
    _$hash = $jc(_$hash, whitelistMatch.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(r'SearchMessage')
          ..add('id', id)
          ..add('mailboxId', mailboxId)
          ..add('folder', folder)
          ..add('fromAddress', fromAddress)
          ..add('fromName', fromName)
          ..add('subject', subject)
          ..add('preview', preview)
          ..add('receivedAt', receivedAt)
          ..add('expiresAt', expiresAt)
          ..add('read', read)
          ..add('starred', starred)
          ..add('attachmentCount', attachmentCount)
          ..add('whitelistMatch', whitelistMatch))
        .toString();
  }
}

class SearchMessageBuilder
    implements Builder<SearchMessage, SearchMessageBuilder> {
  _$SearchMessage? _$v;

  String? _id;
  String? get id => _$this._id;
  set id(String? id) => _$this._id = id;

  int? _mailboxId;
  int? get mailboxId => _$this._mailboxId;
  set mailboxId(int? mailboxId) => _$this._mailboxId = mailboxId;

  SearchMessageFolderEnum? _folder;
  SearchMessageFolderEnum? get folder => _$this._folder;
  set folder(SearchMessageFolderEnum? folder) => _$this._folder = folder;

  String? _fromAddress;
  String? get fromAddress => _$this._fromAddress;
  set fromAddress(String? fromAddress) => _$this._fromAddress = fromAddress;

  String? _fromName;
  String? get fromName => _$this._fromName;
  set fromName(String? fromName) => _$this._fromName = fromName;

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

  int? _attachmentCount;
  int? get attachmentCount => _$this._attachmentCount;
  set attachmentCount(int? attachmentCount) =>
      _$this._attachmentCount = attachmentCount;

  int? _whitelistMatch;
  int? get whitelistMatch => _$this._whitelistMatch;
  set whitelistMatch(int? whitelistMatch) =>
      _$this._whitelistMatch = whitelistMatch;

  SearchMessageBuilder() {
    SearchMessage._defaults(this);
  }

  SearchMessageBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _id = $v.id;
      _mailboxId = $v.mailboxId;
      _folder = $v.folder;
      _fromAddress = $v.fromAddress;
      _fromName = $v.fromName;
      _subject = $v.subject;
      _preview = $v.preview;
      _receivedAt = $v.receivedAt;
      _expiresAt = $v.expiresAt;
      _read = $v.read;
      _starred = $v.starred;
      _attachmentCount = $v.attachmentCount;
      _whitelistMatch = $v.whitelistMatch;
      _$v = null;
    }
    return this;
  }

  @override
  void replace(SearchMessage other) {
    _$v = other as _$SearchMessage;
  }

  @override
  void update(void Function(SearchMessageBuilder)? updates) {
    if (updates != null) updates(this);
  }

  @override
  SearchMessage build() => _build();

  _$SearchMessage _build() {
    final _$result =
        _$v ??
        _$SearchMessage._(
          id: BuiltValueNullFieldError.checkNotNull(id, r'SearchMessage', 'id'),
          mailboxId: BuiltValueNullFieldError.checkNotNull(
            mailboxId,
            r'SearchMessage',
            'mailboxId',
          ),
          folder: BuiltValueNullFieldError.checkNotNull(
            folder,
            r'SearchMessage',
            'folder',
          ),
          fromAddress: BuiltValueNullFieldError.checkNotNull(
            fromAddress,
            r'SearchMessage',
            'fromAddress',
          ),
          fromName: fromName,
          subject: subject,
          preview: preview,
          receivedAt: BuiltValueNullFieldError.checkNotNull(
            receivedAt,
            r'SearchMessage',
            'receivedAt',
          ),
          expiresAt: expiresAt,
          read: BuiltValueNullFieldError.checkNotNull(
            read,
            r'SearchMessage',
            'read',
          ),
          starred: BuiltValueNullFieldError.checkNotNull(
            starred,
            r'SearchMessage',
            'starred',
          ),
          attachmentCount: BuiltValueNullFieldError.checkNotNull(
            attachmentCount,
            r'SearchMessage',
            'attachmentCount',
          ),
          whitelistMatch: whitelistMatch,
        );
    replace(_$result);
    return _$result;
  }
}

// ignore_for_file: deprecated_member_use_from_same_package,type=lint
