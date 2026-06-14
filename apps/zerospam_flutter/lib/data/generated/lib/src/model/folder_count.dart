//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'folder_count.g.dart';

/// FolderCount
///
/// Properties:
/// * [total] 
/// * [unread] 
@BuiltValue()
abstract class FolderCount implements Built<FolderCount, FolderCountBuilder> {
  @BuiltValueField(wireName: r'total')
  int get total;

  @BuiltValueField(wireName: r'unread')
  int get unread;

  FolderCount._();

  factory FolderCount([void updates(FolderCountBuilder b)]) = _$FolderCount;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(FolderCountBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<FolderCount> get serializer => _$FolderCountSerializer();
}

class _$FolderCountSerializer implements PrimitiveSerializer<FolderCount> {
  @override
  final Iterable<Type> types = const [FolderCount, _$FolderCount];

  @override
  final String wireName = r'FolderCount';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    FolderCount object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    yield r'total';
    yield serializers.serialize(
      object.total,
      specifiedType: const FullType(int),
    );
    yield r'unread';
    yield serializers.serialize(
      object.unread,
      specifiedType: const FullType(int),
    );
  }

  @override
  Object serialize(
    Serializers serializers,
    FolderCount object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required FolderCountBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
        case r'total':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(int),
          ) as int;
          result.total = valueDes;
          break;
        case r'unread':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(int),
          ) as int;
          result.unread = valueDes;
          break;
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  FolderCount deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = FolderCountBuilder();
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

