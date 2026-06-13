//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:openapi/src/model/mailbox_counts_inbox.dart';
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'mailbox_counts.g.dart';

/// MailboxCounts
///
/// Properties:
/// * [inbox] 
/// * [screener] 
/// * [quarantine] 
/// * [sent] 
/// * [trash] 
/// * [drafts] 
@BuiltValue()
abstract class MailboxCounts implements Built<MailboxCounts, MailboxCountsBuilder> {
  @BuiltValueField(wireName: r'inbox')
  MailboxCountsInbox get inbox;

  @BuiltValueField(wireName: r'screener')
  MailboxCountsInbox get screener;

  @BuiltValueField(wireName: r'quarantine')
  MailboxCountsInbox get quarantine;

  @BuiltValueField(wireName: r'sent')
  MailboxCountsInbox get sent;

  @BuiltValueField(wireName: r'trash')
  MailboxCountsInbox get trash;

  @BuiltValueField(wireName: r'drafts')
  MailboxCountsInbox get drafts;

  MailboxCounts._();

  factory MailboxCounts([void updates(MailboxCountsBuilder b)]) = _$MailboxCounts;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(MailboxCountsBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<MailboxCounts> get serializer => _$MailboxCountsSerializer();
}

class _$MailboxCountsSerializer implements PrimitiveSerializer<MailboxCounts> {
  @override
  final Iterable<Type> types = const [MailboxCounts, _$MailboxCounts];

  @override
  final String wireName = r'MailboxCounts';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    MailboxCounts object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    yield r'inbox';
    yield serializers.serialize(
      object.inbox,
      specifiedType: const FullType(MailboxCountsInbox),
    );
    yield r'screener';
    yield serializers.serialize(
      object.screener,
      specifiedType: const FullType(MailboxCountsInbox),
    );
    yield r'quarantine';
    yield serializers.serialize(
      object.quarantine,
      specifiedType: const FullType(MailboxCountsInbox),
    );
    yield r'sent';
    yield serializers.serialize(
      object.sent,
      specifiedType: const FullType(MailboxCountsInbox),
    );
    yield r'trash';
    yield serializers.serialize(
      object.trash,
      specifiedType: const FullType(MailboxCountsInbox),
    );
    yield r'drafts';
    yield serializers.serialize(
      object.drafts,
      specifiedType: const FullType(MailboxCountsInbox),
    );
  }

  @override
  Object serialize(
    Serializers serializers,
    MailboxCounts object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required MailboxCountsBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
        case r'inbox':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(MailboxCountsInbox),
          ) as MailboxCountsInbox;
          result.inbox.replace(valueDes);
          break;
        case r'screener':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(MailboxCountsInbox),
          ) as MailboxCountsInbox;
          result.screener.replace(valueDes);
          break;
        case r'quarantine':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(MailboxCountsInbox),
          ) as MailboxCountsInbox;
          result.quarantine.replace(valueDes);
          break;
        case r'sent':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(MailboxCountsInbox),
          ) as MailboxCountsInbox;
          result.sent.replace(valueDes);
          break;
        case r'trash':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(MailboxCountsInbox),
          ) as MailboxCountsInbox;
          result.trash.replace(valueDes);
          break;
        case r'drafts':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(MailboxCountsInbox),
          ) as MailboxCountsInbox;
          result.drafts.replace(valueDes);
          break;
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  MailboxCounts deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = MailboxCountsBuilder();
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

