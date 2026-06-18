//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:openapi/src/model/auth_me_user.dart';
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'auth_me.g.dart';

/// AuthMe
///
/// Properties:
/// * [user] 
@BuiltValue()
abstract class AuthMe implements Built<AuthMe, AuthMeBuilder> {
  @BuiltValueField(wireName: r'user')
  AuthMeUser get user;

  AuthMe._();

  factory AuthMe([void updates(AuthMeBuilder b)]) = _$AuthMe;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(AuthMeBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<AuthMe> get serializer => _$AuthMeSerializer();
}

class _$AuthMeSerializer implements PrimitiveSerializer<AuthMe> {
  @override
  final Iterable<Type> types = const [AuthMe, _$AuthMe];

  @override
  final String wireName = r'AuthMe';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    AuthMe object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    yield r'user';
    yield serializers.serialize(
      object.user,
      specifiedType: const FullType(AuthMeUser),
    );
  }

  @override
  Object serialize(
    Serializers serializers,
    AuthMe object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required AuthMeBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
        case r'user':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(AuthMeUser),
          ) as AuthMeUser;
          result.user.replace(valueDes);
          break;
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  AuthMe deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = AuthMeBuilder();
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

