import 'package:test/test.dart';
import 'package:openapi/openapi.dart';


/// tests for MobileApi
void main() {
  final instance = Openapi().getMobileApi();

  group(MobileApi, () {
    // Current user
    //
    //Future<AuthMe> getMe() async
    test('test getMe', () async {
      // TODO
    });

    // Get one message
    //
    //Future<MessageDetail> getMessage(String id) async
    test('test getMessage', () async {
      // TODO
    });

    // List mailboxes
    //
    //Future<BuiltList<Mailbox>> listMailboxes() async
    test('test listMailboxes', () async {
      // TODO
    });

    // List messages in a folder
    //
    //Future<BuiltList<MessageSummary>> listMessages(int mailboxId, String folder, { int limit, int offset }) async
    test('test listMessages', () async {
      // TODO
    });

    // Log in (sets session cookie)
    //
    //Future<LoginResponse> login(LoginRequest loginRequest) async
    test('test login', () async {
      // TODO
    });

    // Register a device, get a bearer token
    //
    //Future<DeviceRegisterResponse> registerDevice(DeviceRegisterRequest deviceRegisterRequest) async
    test('test registerDevice', () async {
      // TODO
    });

  });
}
