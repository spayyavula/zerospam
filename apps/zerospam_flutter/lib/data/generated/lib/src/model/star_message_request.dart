//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'star_message_request.g.dart';

/// StarMessageRequest
///
/// Properties:
/// * [starred] 
@BuiltValue()
abstract class StarMessageRequest implements Built<StarMessageRequest, StarMessageRequestBuilder> {
  @BuiltValueField(wireName: r'starred')
  bool? get starred;

  StarMessageRequest._();

  factory StarMessageRequest([void updates(StarMessageRequestBuilder b)]) = _$StarMessageRequest;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(StarMessageRequestBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<StarMessageRequest> get serializer => _$StarMessageRequestSerializer();
}

class _$StarMessageRequestSerializer implements PrimitiveSerializer<StarMessageRequest> {
  @override
  final Iterable<Type> types = const [StarMessageRequest, _$StarMessageRequest];

  @override
  final String wireName = r'StarMessageRequest';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    StarMessageRequest object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    if (object.starred != null) {
      yield r'starred';
      yield serializers.serialize(
        object.starred,
        specifiedType: const FullType(bool),
      );
    }
  }

  @override
  Object serialize(
    Serializers serializers,
    StarMessageRequest object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required StarMessageRequestBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
        case r'starred':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(bool),
          ) as bool;
          result.starred = valueDes;
          break;
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  StarMessageRequest deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = StarMessageRequestBuilder();
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

