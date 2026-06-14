//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:built_collection/built_collection.dart';
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'search_message.g.dart';

/// SearchMessage
///
/// Properties:
/// * [id] 
/// * [mailboxId] 
/// * [folder] 
/// * [fromAddress] 
/// * [fromName] 
/// * [subject] 
/// * [preview] 
/// * [receivedAt] 
/// * [expiresAt] 
/// * [read] 
/// * [starred] 
/// * [attachmentCount] 
/// * [whitelistMatch] 
@BuiltValue()
abstract class SearchMessage implements Built<SearchMessage, SearchMessageBuilder> {
  @BuiltValueField(wireName: r'id')
  String get id;

  @BuiltValueField(wireName: r'mailbox_id')
  int get mailboxId;

  @BuiltValueField(wireName: r'folder')
  SearchMessageFolderEnum get folder;
  // enum folderEnum {  inbox,  quarantine,  sent,  trash,  };

  @BuiltValueField(wireName: r'from_address')
  String get fromAddress;

  @BuiltValueField(wireName: r'from_name')
  String? get fromName;

  @BuiltValueField(wireName: r'subject')
  String? get subject;

  @BuiltValueField(wireName: r'preview')
  String? get preview;

  @BuiltValueField(wireName: r'received_at')
  int get receivedAt;

  @BuiltValueField(wireName: r'expires_at')
  int? get expiresAt;

  @BuiltValueField(wireName: r'read')
  int get read;

  @BuiltValueField(wireName: r'starred')
  int get starred;

  @BuiltValueField(wireName: r'attachment_count')
  int get attachmentCount;

  @BuiltValueField(wireName: r'whitelist_match')
  int? get whitelistMatch;

  SearchMessage._();

  factory SearchMessage([void updates(SearchMessageBuilder b)]) = _$SearchMessage;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(SearchMessageBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<SearchMessage> get serializer => _$SearchMessageSerializer();
}

class _$SearchMessageSerializer implements PrimitiveSerializer<SearchMessage> {
  @override
  final Iterable<Type> types = const [SearchMessage, _$SearchMessage];

  @override
  final String wireName = r'SearchMessage';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    SearchMessage object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    yield r'id';
    yield serializers.serialize(
      object.id,
      specifiedType: const FullType(String),
    );
    yield r'mailbox_id';
    yield serializers.serialize(
      object.mailboxId,
      specifiedType: const FullType(int),
    );
    yield r'folder';
    yield serializers.serialize(
      object.folder,
      specifiedType: const FullType(SearchMessageFolderEnum),
    );
    yield r'from_address';
    yield serializers.serialize(
      object.fromAddress,
      specifiedType: const FullType(String),
    );
    if (object.fromName != null) {
      yield r'from_name';
      yield serializers.serialize(
        object.fromName,
        specifiedType: const FullType.nullable(String),
      );
    }
    if (object.subject != null) {
      yield r'subject';
      yield serializers.serialize(
        object.subject,
        specifiedType: const FullType.nullable(String),
      );
    }
    if (object.preview != null) {
      yield r'preview';
      yield serializers.serialize(
        object.preview,
        specifiedType: const FullType.nullable(String),
      );
    }
    yield r'received_at';
    yield serializers.serialize(
      object.receivedAt,
      specifiedType: const FullType(int),
    );
    if (object.expiresAt != null) {
      yield r'expires_at';
      yield serializers.serialize(
        object.expiresAt,
        specifiedType: const FullType.nullable(int),
      );
    }
    yield r'read';
    yield serializers.serialize(
      object.read,
      specifiedType: const FullType(int),
    );
    yield r'starred';
    yield serializers.serialize(
      object.starred,
      specifiedType: const FullType(int),
    );
    yield r'attachment_count';
    yield serializers.serialize(
      object.attachmentCount,
      specifiedType: const FullType(int),
    );
    if (object.whitelistMatch != null) {
      yield r'whitelist_match';
      yield serializers.serialize(
        object.whitelistMatch,
        specifiedType: const FullType.nullable(int),
      );
    }
  }

  @override
  Object serialize(
    Serializers serializers,
    SearchMessage object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required SearchMessageBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
        case r'id':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.id = valueDes;
          break;
        case r'mailbox_id':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(int),
          ) as int;
          result.mailboxId = valueDes;
          break;
        case r'folder':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(SearchMessageFolderEnum),
          ) as SearchMessageFolderEnum;
          result.folder = valueDes;
          break;
        case r'from_address':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.fromAddress = valueDes;
          break;
        case r'from_name':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(String),
          ) as String?;
          if (valueDes == null) continue;
          result.fromName = valueDes;
          break;
        case r'subject':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(String),
          ) as String?;
          if (valueDes == null) continue;
          result.subject = valueDes;
          break;
        case r'preview':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(String),
          ) as String?;
          if (valueDes == null) continue;
          result.preview = valueDes;
          break;
        case r'received_at':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(int),
          ) as int;
          result.receivedAt = valueDes;
          break;
        case r'expires_at':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(int),
          ) as int?;
          if (valueDes == null) continue;
          result.expiresAt = valueDes;
          break;
        case r'read':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(int),
          ) as int;
          result.read = valueDes;
          break;
        case r'starred':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(int),
          ) as int;
          result.starred = valueDes;
          break;
        case r'attachment_count':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(int),
          ) as int;
          result.attachmentCount = valueDes;
          break;
        case r'whitelist_match':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(int),
          ) as int?;
          if (valueDes == null) continue;
          result.whitelistMatch = valueDes;
          break;
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  SearchMessage deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = SearchMessageBuilder();
    final serializedList = (serialized as Iterable<Object?>).toList();
    final unhandled = <Object?>[];
    _deserializeProperties(
      serializers,
      serialized,
      specifiedType: specifiedType,
      serializedList: serializedList,
      unhandled: unhandled,
      result: result,
    );
    return result.build();
  }
}

class SearchMessageFolderEnum extends EnumClass {

  @BuiltValueEnumConst(wireName: r'inbox')
  static const SearchMessageFolderEnum inbox = _$searchMessageFolderEnum_inbox;
  @BuiltValueEnumConst(wireName: r'quarantine')
  static const SearchMessageFolderEnum quarantine = _$searchMessageFolderEnum_quarantine;
  @BuiltValueEnumConst(wireName: r'sent')
  static const SearchMessageFolderEnum sent = _$searchMessageFolderEnum_sent;
  @BuiltValueEnumConst(wireName: r'trash')
  static const SearchMessageFolderEnum trash = _$searchMessageFolderEnum_trash;

  static Serializer<SearchMessageFolderEnum> get serializer => _$searchMessageFolderEnumSerializer;

  const SearchMessageFolderEnum._(String name): super(name);

  static BuiltSet<SearchMessageFolderEnum> get values => _$searchMessageFolderEnumValues;
  static SearchMessageFolderEnum valueOf(String name) => _$searchMessageFolderEnumValueOf(name);
}

