//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:built_collection/built_collection.dart';
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'move_message_request.g.dart';

/// MoveMessageRequest
///
/// Properties:
/// * [folder] 
@BuiltValue()
abstract class MoveMessageRequest implements Built<MoveMessageRequest, MoveMessageRequestBuilder> {
  @BuiltValueField(wireName: r'folder')
  MoveMessageRequestFolderEnum get folder;
  // enum folderEnum {  inbox,  quarantine,  trash,  };

  MoveMessageRequest._();

  factory MoveMessageRequest([void updates(MoveMessageRequestBuilder b)]) = _$MoveMessageRequest;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(MoveMessageRequestBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<MoveMessageRequest> get serializer => _$MoveMessageRequestSerializer();
}

class _$MoveMessageRequestSerializer implements PrimitiveSerializer<MoveMessageRequest> {
  @override
  final Iterable<Type> types = const [MoveMessageRequest, _$MoveMessageRequest];

  @override
  final String wireName = r'MoveMessageRequest';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    MoveMessageRequest object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    yield r'folder';
    yield serializers.serialize(
      object.folder,
      specifiedType: const FullType(MoveMessageRequestFolderEnum),
    );
  }

  @override
  Object serialize(
    Serializers serializers,
    MoveMessageRequest object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required MoveMessageRequestBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
        case r'folder':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(MoveMessageRequestFolderEnum),
          ) as MoveMessageRequestFolderEnum;
          result.folder = valueDes;
          break;
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  MoveMessageRequest deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = MoveMessageRequestBuilder();
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

class MoveMessageRequestFolderEnum extends EnumClass {

  @BuiltValueEnumConst(wireName: r'inbox')
  static const MoveMessageRequestFolderEnum inbox = _$moveMessageRequestFolderEnum_inbox;
  @BuiltValueEnumConst(wireName: r'quarantine')
  static const MoveMessageRequestFolderEnum quarantine = _$moveMessageRequestFolderEnum_quarantine;
  @BuiltValueEnumConst(wireName: r'trash')
  static const MoveMessageRequestFolderEnum trash = _$moveMessageRequestFolderEnum_trash;

  static Serializer<MoveMessageRequestFolderEnum> get serializer => _$moveMessageRequestFolderEnumSerializer;

  const MoveMessageRequestFolderEnum._(String name): super(name);

  static BuiltSet<MoveMessageRequestFolderEnum> get values => _$moveMessageRequestFolderEnumValues;
  static MoveMessageRequestFolderEnum valueOf(String name) => _$moveMessageRequestFolderEnumValueOf(name);
}

