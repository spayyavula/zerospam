//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:built_collection/built_collection.dart';
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'device_register_request.g.dart';

/// DeviceRegisterRequest
///
/// Properties:
/// * [name] 
/// * [platform] 
/// * [appVersion] 
@BuiltValue()
abstract class DeviceRegisterRequest implements Built<DeviceRegisterRequest, DeviceRegisterRequestBuilder> {
  @BuiltValueField(wireName: r'name')
  String get name;

  @BuiltValueField(wireName: r'platform')
  DeviceRegisterRequestPlatformEnum? get platform;
  // enum platformEnum {  ios,  android,  web,  };

  @BuiltValueField(wireName: r'appVersion')
  String? get appVersion;

  DeviceRegisterRequest._();

  factory DeviceRegisterRequest([void updates(DeviceRegisterRequestBuilder b)]) = _$DeviceRegisterRequest;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(DeviceRegisterRequestBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<DeviceRegisterRequest> get serializer => _$DeviceRegisterRequestSerializer();
}

class _$DeviceRegisterRequestSerializer implements PrimitiveSerializer<DeviceRegisterRequest> {
  @override
  final Iterable<Type> types = const [DeviceRegisterRequest, _$DeviceRegisterRequest];

  @override
  final String wireName = r'DeviceRegisterRequest';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    DeviceRegisterRequest object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    yield r'name';
    yield serializers.serialize(
      object.name,
      specifiedType: const FullType(String),
    );
    if (object.platform != null) {
      yield r'platform';
      yield serializers.serialize(
        object.platform,
        specifiedType: const FullType(DeviceRegisterRequestPlatformEnum),
      );
    }
    if (object.appVersion != null) {
      yield r'appVersion';
      yield serializers.serialize(
        object.appVersion,
        specifiedType: const FullType(String),
      );
    }
  }

  @override
  Object serialize(
    Serializers serializers,
    DeviceRegisterRequest object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required DeviceRegisterRequestBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
        case r'name':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.name = valueDes;
          break;
        case r'platform':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(DeviceRegisterRequestPlatformEnum),
          ) as DeviceRegisterRequestPlatformEnum;
          result.platform = valueDes;
          break;
        case r'appVersion':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.appVersion = valueDes;
          break;
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  DeviceRegisterRequest deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = DeviceRegisterRequestBuilder();
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

class DeviceRegisterRequestPlatformEnum extends EnumClass {

  @BuiltValueEnumConst(wireName: r'ios')
  static const DeviceRegisterRequestPlatformEnum ios = _$deviceRegisterRequestPlatformEnum_ios;
  @BuiltValueEnumConst(wireName: r'android')
  static const DeviceRegisterRequestPlatformEnum android = _$deviceRegisterRequestPlatformEnum_android;
  @BuiltValueEnumConst(wireName: r'web')
  static const DeviceRegisterRequestPlatformEnum web = _$deviceRegisterRequestPlatformEnum_web;

  static Serializer<DeviceRegisterRequestPlatformEnum> get serializer => _$deviceRegisterRequestPlatformEnumSerializer;

  const DeviceRegisterRequestPlatformEnum._(String name): super(name);

  static BuiltSet<DeviceRegisterRequestPlatformEnum> get values => _$deviceRegisterRequestPlatformEnumValues;
  static DeviceRegisterRequestPlatformEnum valueOf(String name) => _$deviceRegisterRequestPlatformEnumValueOf(name);
}

