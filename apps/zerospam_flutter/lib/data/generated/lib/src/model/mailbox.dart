//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'mailbox.g.dart';

/// Mailbox
///
/// Properties:
/// * [id] 
/// * [address] 
/// * [domainId] 
/// * [displayName] 
/// * [quarantineTtlHours] 
/// * [createdAt] 
@BuiltValue()
abstract class Mailbox implements Built<Mailbox, MailboxBuilder> {
  @BuiltValueField(wireName: r'id')
  int get id;

  @BuiltValueField(wireName: r'address')
  String get address;

  @BuiltValueField(wireName: r'domain_id')
  int get domainId;

  @BuiltValueField(wireName: r'display_name')
  String? get displayName;

  @BuiltValueField(wireName: r'quarantine_ttl_hours')
  int get quarantineTtlHours;

  @BuiltValueField(wireName: r'created_at')
  int get createdAt;

  Mailbox._();

  factory Mailbox([void updates(MailboxBuilder b)]) = _$Mailbox;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(MailboxBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<Mailbox> get serializer => _$MailboxSerializer();
}

class _$MailboxSerializer implements PrimitiveSerializer<Mailbox> {
  @override
  final Iterable<Type> types = const [Mailbox, _$Mailbox];

  @override
  final String wireName = r'Mailbox';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    Mailbox object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    yield r'id';
    yield serializers.serialize(
      object.id,
      specifiedType: const FullType(int),
    );
    yield r'address';
    yield serializers.serialize(
      object.address,
      specifiedType: const FullType(String),
    );
    yield r'domain_id';
    yield serializers.serialize(
      object.domainId,
      specifiedType: const FullType(int),
    );
    if (object.displayName != null) {
      yield r'display_name';
      yield serializers.serialize(
        object.displayName,
        specifiedType: const FullType.nullable(String),
      );
    }
    yield r'quarantine_ttl_hours';
    yield serializers.serialize(
      object.quarantineTtlHours,
      specifiedType: const FullType(int),
    );
    yield r'created_at';
    yield serializers.serialize(
      object.createdAt,
      specifiedType: const FullType(int),
    );
  }

  @override
  Object serialize(
    Serializers serializers,
    Mailbox object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required MailboxBuilder result,
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
        case r'address':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.address = valueDes;
          break;
        case r'domain_id':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(int),
          ) as int;
          result.domainId = valueDes;
          break;
        case r'display_name':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(String),
          ) as String?;
          if (valueDes == null) continue;
          result.displayName = valueDes;
          break;
        case r'quarantine_ttl_hours':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(int),
          ) as int;
          result.quarantineTtlHours = valueDes;
          break;
        case r'created_at':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(int),
          ) as int;
          result.createdAt = valueDes;
          break;
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  Mailbox deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = MailboxBuilder();
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

