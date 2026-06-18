//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'device_register_response.g.dart';

/// DeviceRegisterResponse
///
/// Properties:
/// * [token] 
@BuiltValue()
abstract class DeviceRegisterResponse implements Built<DeviceRegisterResponse, DeviceRegisterResponseBuilder> {
  @BuiltValueField(wireName: r'token')
  String get token;

  DeviceRegisterResponse._();

  factory DeviceRegisterResponse([void updates(DeviceRegisterResponseBuilder b)]) = _$DeviceRegisterResponse;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(DeviceRegisterResponseBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<DeviceRegisterResponse> get serializer => _$DeviceRegisterResponseSerializer();
}

class _$DeviceRegisterResponseSerializer implements PrimitiveSerializer<DeviceRegisterResponse> {
  @override
  final Iterable<Type> types = const [DeviceRegisterResponse, _$DeviceRegisterResponse];

  @override
  final String wireName = r'DeviceRegisterResponse';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    DeviceRegisterResponse object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    yield r'token';
    yield serializers.serialize(
      object.token,
      specifiedType: const FullType(String),
    );
  }

  @override
  Object serialize(
    Serializers serializers,
    DeviceRegisterResponse object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required DeviceRegisterResponseBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
        case r'token':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.token = valueDes;
          break;
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  DeviceRegisterResponse deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = DeviceRegisterResponseBuilder();
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

