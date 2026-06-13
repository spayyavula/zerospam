//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'auth_me_user.g.dart';

/// AuthMeUser
///
/// Properties:
/// * [id] 
/// * [email] 
/// * [totpEnabled] 
/// * [tourCompletedAt] 
@BuiltValue()
abstract class AuthMeUser implements Built<AuthMeUser, AuthMeUserBuilder> {
  @BuiltValueField(wireName: r'id')
  int get id;

  @BuiltValueField(wireName: r'email')
  String get email;

  @BuiltValueField(wireName: r'totp_enabled')
  bool get totpEnabled;

  @BuiltValueField(wireName: r'tour_completed_at')
  int? get tourCompletedAt;

  AuthMeUser._();

  factory AuthMeUser([void updates(AuthMeUserBuilder b)]) = _$AuthMeUser;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(AuthMeUserBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<AuthMeUser> get serializer => _$AuthMeUserSerializer();
}

class _$AuthMeUserSerializer implements PrimitiveSerializer<AuthMeUser> {
  @override
  final Iterable<Type> types = const [AuthMeUser, _$AuthMeUser];

  @override
  final String wireName = r'AuthMeUser';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    AuthMeUser object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    yield r'id';
    yield serializers.serialize(
      object.id,
      specifiedType: const FullType(int),
    );
    yield r'email';
    yield serializers.serialize(
      object.email,
      specifiedType: const FullType(String),
    );
    yield r'totp_enabled';
    yield serializers.serialize(
      object.totpEnabled,
      specifiedType: const FullType(bool),
    );
    if (object.tourCompletedAt != null) {
      yield r'tour_completed_at';
      yield serializers.serialize(
        object.tourCompletedAt,
        specifiedType: const FullType.nullable(int),
      );
    }
  }

  @override
  Object serialize(
    Serializers serializers,
    AuthMeUser object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required AuthMeUserBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
        case r'id':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(int),
          ) as int;
          result.id = valueDes;
          break;
        case r'email':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.email = valueDes;
          break;
        case r'totp_enabled':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(bool),
          ) as bool;
          result.totpEnabled = valueDes;
          break;
        case r'tour_completed_at':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(int),
          ) as int?;
          if (valueDes == null) continue;
          result.tourCompletedAt = valueDes;
          break;
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  AuthMeUser deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = AuthMeUserBuilder();
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

