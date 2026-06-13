// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'move_message_request.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

const MoveMessageRequestFolderEnum _$moveMessageRequestFolderEnum_inbox =
    const MoveMessageRequestFolderEnum._('inbox');
const MoveMessageRequestFolderEnum _$moveMessageRequestFolderEnum_quarantine =
    const MoveMessageRequestFolderEnum._('quarantine');
const MoveMessageRequestFolderEnum _$moveMessageRequestFolderEnum_trash =
    const MoveMessageRequestFolderEnum._('trash');

MoveMessageRequestFolderEnum _$moveMessageRequestFolderEnumValueOf(
  String name,
) {
  switch (name) {
    case 'inbox':
      return _$moveMessageRequestFolderEnum_inbox;
    case 'quarantine':
      return _$moveMessageRequestFolderEnum_quarantine;
    case 'trash':
      return _$moveMessageRequestFolderEnum_trash;
    default:
      throw ArgumentError(name);
  }
}

final BuiltSet<MoveMessageRequestFolderEnum>
_$moveMessageRequestFolderEnumValues =
    BuiltSet<MoveMessageRequestFolderEnum>(const <MoveMessageRequestFolderEnum>[
      _$moveMessageRequestFolderEnum_inbox,
      _$moveMessageRequestFolderEnum_quarantine,
      _$moveMessageRequestFolderEnum_trash,
    ]);

Serializer<MoveMessageRequestFolderEnum>
_$moveMessageRequestFolderEnumSerializer =
    _$MoveMessageRequestFolderEnumSerializer();

class _$MoveMessageRequestFolderEnumSerializer
    implements PrimitiveSerializer<MoveMessageRequestFolderEnum> {
  static const Map<String, Object> _toWire = const <String, Object>{
    'inbox': 'inbox',
    'quarantine': 'quarantine',
    'trash': 'trash',
  };
  static const Map<Object, String> _fromWire = const <Object, String>{
    'inbox': 'inbox',
    'quarantine': 'quarantine',
    'trash': 'trash',
  };

  @override
  final Iterable<Type> types = const <Type>[MoveMessageRequestFolderEnum];
  @override
  final String wireName = 'MoveMessageRequestFolderEnum';

  @override
  Object serialize(
    Serializers serializers,
    MoveMessageRequestFolderEnum object, {
    FullType specifiedType = FullType.unspecified,
  }) => _toWire[object.name] ?? object.name;

  @override
  MoveMessageRequestFolderEnum deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) => MoveMessageRequestFolderEnum.valueOf(
    _fromWire[serialized] ?? (serialized is String ? serialized : ''),
  );
}

class _$MoveMessageRequest extends MoveMessageRequest {
  @override
  final MoveMessageRequestFolderEnum folder;

  factory _$MoveMessageRequest([
    void Function(MoveMessageRequestBuilder)? updates,
  ]) => (MoveMessageRequestBuilder()..update(updates))._build();

  _$MoveMessageRequest._({required this.folder}) : super._();
  @override
  MoveMessageRequest rebuild(
    void Function(MoveMessageRequestBuilder) updates,
  ) => (toBuilder()..update(updates)).build();

  @override
  MoveMessageRequestBuilder toBuilder() =>
      MoveMessageRequestBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is MoveMessageRequest && folder == other.folder;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, folder.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(
      r'MoveMessageRequest',
    )..add('folder', folder)).toString();
  }
}

class MoveMessageRequestBuilder
    implements Builder<MoveMessageRequest, MoveMessageRequestBuilder> {
  _$MoveMessageRequest? _$v;

  MoveMessageRequestFolderEnum? _folder;
  MoveMessageRequestFolderEnum? get folder => _$this._folder;
  set folder(MoveMessageRequestFolderEnum? folder) => _$this._folder = folder;

  MoveMessageRequestBuilder() {
    MoveMessageRequest._defaults(this);
  }

  MoveMessageRequestBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _folder = $v.folder;
      _$v = null;
    }
    return this;
  }

  @override
  void replace(MoveMessageRequest other) {
    _$v = other as _$MoveMessageRequest;
  }

  @override
  void update(void Function(MoveMessageRequestBuilder)? updates) {
    if (updates != null) updates(this);
  }

  @override
  MoveMessageRequest build() => _build();

  _$MoveMessageRequest _build() {
    final _$result =
        _$v ??
        _$MoveMessageRequest._(
          folder: BuiltValueNullFieldError.checkNotNull(
            folder,
            r'MoveMessageRequest',
            'folder',
          ),
        );
    replace(_$result);
    return _$result;
  }
}

// ignore_for_file: deprecated_member_use_from_same_package,type=lint
