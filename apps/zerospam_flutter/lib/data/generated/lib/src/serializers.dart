//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_import

import 'package:one_of_serializer/any_of_serializer.dart';
import 'package:one_of_serializer/one_of_serializer.dart';
import 'package:built_collection/built_collection.dart';
import 'package:built_value/json_object.dart';
import 'package:built_value/serializer.dart';
import 'package:built_value/standard_json_plugin.dart';
import 'package:built_value/iso_8601_date_time_serializer.dart';
import 'package:openapi/src/date_serializer.dart';
import 'package:openapi/src/model/date.dart';

import 'package:openapi/src/model/auth_me.dart';
import 'package:openapi/src/model/auth_me_user.dart';
import 'package:openapi/src/model/device_register_request.dart';
import 'package:openapi/src/model/device_register_response.dart';
import 'package:openapi/src/model/error_response.dart';
import 'package:openapi/src/model/folder_count.dart';
import 'package:openapi/src/model/login_request.dart';
import 'package:openapi/src/model/login_response.dart';
import 'package:openapi/src/model/mailbox.dart';
import 'package:openapi/src/model/mailbox_counts.dart';
import 'package:openapi/src/model/mailbox_counts_inbox.dart';
import 'package:openapi/src/model/mark_read_request.dart';
import 'package:openapi/src/model/message_detail.dart';
import 'package:openapi/src/model/message_summary.dart';
import 'package:openapi/src/model/move_message_request.dart';
import 'package:openapi/src/model/ok_response.dart';
import 'package:openapi/src/model/search_message.dart';
import 'package:openapi/src/model/star_message_request.dart';

part 'serializers.g.dart';

@SerializersFor([
  AuthMe,
  AuthMeUser,
  DeviceRegisterRequest,
  DeviceRegisterResponse,
  ErrorResponse,
  FolderCount,
  LoginRequest,
  LoginResponse,
  Mailbox,
  MailboxCounts,
  MailboxCountsInbox,
  MarkReadRequest,
  MessageDetail,
  MessageSummary,
  MoveMessageRequest,
  OkResponse,
  SearchMessage,
  StarMessageRequest,
])
Serializers serializers = (_$serializers.toBuilder()
      ..addBuilderFactory(
        const FullType(BuiltList, [FullType(Mailbox)]),
        () => ListBuilder<Mailbox>(),
      )
      ..addBuilderFactory(
        const FullType(BuiltList, [FullType(SearchMessage)]),
        () => ListBuilder<SearchMessage>(),
      )
      ..addBuilderFactory(
        const FullType(BuiltList, [FullType(MessageSummary)]),
        () => ListBuilder<MessageSummary>(),
      )
      ..add(const OneOfSerializer())
      ..add(const AnyOfSerializer())
      ..add(const DateSerializer())
      ..add(Iso8601DateTimeSerializer())
    ).build();

Serializers standardSerializers =
    (serializers.toBuilder()..addPlugin(StandardJsonPlugin())).build();
