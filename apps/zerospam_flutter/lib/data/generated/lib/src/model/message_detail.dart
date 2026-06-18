//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:built_collection/built_collection.dart';
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'message_detail.g.dart';

/// MessageDetail
///
/// Properties:
/// * [id] 
/// * [mailboxId] 
/// * [folder] 
/// * [fromAddress] 
/// * [fromName] 
/// * [toAddresses] 
/// * [subject] 
/// * [preview] 
/// * [receivedAt] 
/// * [expiresAt] 
/// * [read] 
/// * [starred] 
/// * [sizeBytes] 
/// * [attachmentCount] 
/// * [bodyText] 
/// * [bodyHtml] 
/// * [ccAddresses] 
@BuiltValue()
abstract class MessageDetail implements Built<MessageDetail, MessageDetailBuilder> {
  @BuiltValueField(wireName: r'id')
  String get id;

  @BuiltValueField(wireName: r'mailbox_id')
  int get mailboxId;

  @BuiltValueField(wireName: r'folder')
  MessageDetailFolderEnum get folder;
  // enum folderEnum {  inbox,  quarantine,  sent,  trash,  };

  @BuiltValueField(wireName: r'from_address')
  String get fromAddress;

  @BuiltValueField(wireName: r'from_name')
  String? get fromName;

  @BuiltValueField(wireName: r'to_addresses')
  String get toAddresses;

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

  @BuiltValueField(wireName: r'size_bytes')
  int get sizeBytes;

  @BuiltValueField(wireName: r'attachment_count')
  int get attachmentCount;

  @BuiltValueField(wireName: r'body_text')
  String? get bodyText;

  @BuiltValueField(wireName: r'body_html')
  String? get bodyHtml;

  @BuiltValueField(wireName: r'cc_addresses')
  String? get ccAddresses;

  MessageDetail._();

  factory MessageDetail([void updates(MessageDetailBuilder b)]) = _$MessageDetail;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(MessageDetailBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<MessageDetail> get serializer => _$MessageDetailSerializer();
}

class _$MessageDetailSerializer implements PrimitiveSerializer<MessageDetail> {
  @override
  final Iterable<Type> types = const [MessageDetail, _$MessageDetail];

  @override
  final String wireName = r'MessageDetail';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    MessageDetail object, {
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
      specifiedType: const FullType(MessageDetailFolderEnum),
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
    yield r'to_addresses';
    yield serializers.serialize(
      object.toAddresses,
      specifiedType: const FullType(String),
    );
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
    yield r'size_bytes';
    yield serializers.serialize(
      object.sizeBytes,
      specifiedType: const FullType(int),
    );
    yield r'attachment_count';
    yield serializers.serialize(
      object.attachmentCount,
      specifiedType: const FullType(int),
    );
    if (object.bodyText != null) {
      yield r'body_text';
      yield serializers.serialize(
        object.bodyText,
        specifiedType: const FullType.nullable(String),
      );
    }
    if (object.bodyHtml != null) {
      yield r'body_html';
      yield serializers.serialize(
        object.bodyHtml,
        specifiedType: const FullType.nullable(String),
      );
    }
    if (object.ccAddresses != null) {
      yield r'cc_addresses';
      yield serializers.serialize(
        object.ccAddresses,
        specifiedType: const FullType.nullable(String),
      );
    }
  }

  @override
  Object serialize(
    Serializers serializers,
    MessageDetail object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required MessageDetailBuilder result,
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
            specifiedType: const FullType(MessageDetailFolderEnum),
          ) as MessageDetailFolderEnum;
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
        case r'to_addresses':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.toAddresses = valueDes;
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
        case r'size_bytes':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(int),
          ) as int;
          result.sizeBytes = valueDes;
          break;
        case r'attachment_count':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(int),
          ) as int;
          result.attachmentCount = valueDes;
          break;
        case r'body_text':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(String),
          ) as String?;
          if (valueDes == null) continue;
          result.bodyText = valueDes;
          break;
        case r'body_html':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(String),
          ) as String?;
          if (valueDes == null) continue;
          result.bodyHtml = valueDes;
          break;
        case r'cc_addresses':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(String),
          ) as String?;
          if (valueDes == null) continue;
          result.ccAddresses = valueDes;
          break;
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  MessageDetail deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = MessageDetailBuilder();
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

class MessageDetailFolderEnum extends EnumClass {

  @BuiltValueEnumConst(wireName: r'inbox')
  static const MessageDetailFolderEnum inbox = _$messageDetailFolderEnum_inbox;
  @BuiltValueEnumConst(wireName: r'quarantine')
  static const MessageDetailFolderEnum quarantine = _$messageDetailFolderEnum_quarantine;
  @BuiltValueEnumConst(wireName: r'sent')
  static const MessageDetailFolderEnum sent = _$messageDetailFolderEnum_sent;
  @BuiltValueEnumConst(wireName: r'trash')
  static const MessageDetailFolderEnum trash = _$messageDetailFolderEnum_trash;

  static Serializer<MessageDetailFolderEnum> get serializer => _$messageDetailFolderEnumSerializer;

  const MessageDetailFolderEnum._(String name): super(name);

  static BuiltSet<MessageDetailFolderEnum> get values => _$messageDetailFolderEnumValues;
  static MessageDetailFolderEnum valueOf(String name) => _$messageDetailFolderEnumValueOf(name);
}

