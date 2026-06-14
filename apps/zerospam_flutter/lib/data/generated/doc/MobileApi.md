# openapi.api.MobileApi

## Load the API package
```dart
import 'package:openapi/api.dart';
```

All URIs are relative to *http://localhost:8025*

Method | HTTP request | Description
------------- | ------------- | -------------
[**deleteMessage**](MobileApi.md#deletemessage) | **DELETE** /api/messages/{id} | Delete a message
[**getMailboxCounts**](MobileApi.md#getmailboxcounts) | **GET** /api/mailboxes/{id}/counts | Get per-folder mailbox counts
[**getMe**](MobileApi.md#getme) | **GET** /api/auth/me | Current user
[**getMessage**](MobileApi.md#getmessage) | **GET** /api/messages/{id} | Get one message
[**listMailboxes**](MobileApi.md#listmailboxes) | **GET** /api/mailboxes | List mailboxes
[**listMessages**](MobileApi.md#listmessages) | **GET** /api/messages | List messages in a folder
[**login**](MobileApi.md#login) | **POST** /api/auth/login | Log in (sets session cookie)
[**markRead**](MobileApi.md#markread) | **POST** /api/messages/{id}/read | Set message read state
[**moveMessage**](MobileApi.md#movemessage) | **POST** /api/messages/{id}/move | Move a message to another folder
[**registerDevice**](MobileApi.md#registerdevice) | **POST** /api/auth/devices | Register a device, get a bearer token
[**searchMessages**](MobileApi.md#searchmessages) | **GET** /api/search | Search messages
[**starMessage**](MobileApi.md#starmessage) | **POST** /api/messages/{id}/star | Set message starred state


# **deleteMessage**
> OkResponse deleteMessage(id)

Delete a message

### Example
```dart
import 'package:openapi/api.dart';

final api = Openapi().getMobileApi();
final String id = id_example; // String | 

try {
    final response = api.deleteMessage(id);
    print(response);
} on DioException catch (e) {
    print('Exception when calling MobileApi->deleteMessage: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **id** | **String**|  | 

### Return type

[**OkResponse**](OkResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **getMailboxCounts**
> MailboxCounts getMailboxCounts(id)

Get per-folder mailbox counts

### Example
```dart
import 'package:openapi/api.dart';

final api = Openapi().getMobileApi();
final int id = 56; // int | 

try {
    final response = api.getMailboxCounts(id);
    print(response);
} on DioException catch (e) {
    print('Exception when calling MobileApi->getMailboxCounts: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **id** | **int**|  | 

### Return type

[**MailboxCounts**](MailboxCounts.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **getMe**
> AuthMe getMe()

Current user

### Example
```dart
import 'package:openapi/api.dart';

final api = Openapi().getMobileApi();

try {
    final response = api.getMe();
    print(response);
} on DioException catch (e) {
    print('Exception when calling MobileApi->getMe: $e\n');
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

[**AuthMe**](AuthMe.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **getMessage**
> MessageDetail getMessage(id)

Get one message

### Example
```dart
import 'package:openapi/api.dart';

final api = Openapi().getMobileApi();
final String id = id_example; // String | 

try {
    final response = api.getMessage(id);
    print(response);
} on DioException catch (e) {
    print('Exception when calling MobileApi->getMessage: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **id** | **String**|  | 

### Return type

[**MessageDetail**](MessageDetail.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **listMailboxes**
> BuiltList<Mailbox> listMailboxes()

List mailboxes

### Example
```dart
import 'package:openapi/api.dart';

final api = Openapi().getMobileApi();

try {
    final response = api.listMailboxes();
    print(response);
} on DioException catch (e) {
    print('Exception when calling MobileApi->listMailboxes: $e\n');
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

[**BuiltList&lt;Mailbox&gt;**](Mailbox.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **listMessages**
> BuiltList<MessageSummary> listMessages(mailboxId, folder, limit, offset)

List messages in a folder

### Example
```dart
import 'package:openapi/api.dart';

final api = Openapi().getMobileApi();
final int mailboxId = 56; // int | 
final String folder = folder_example; // String | 
final int limit = 56; // int | 
final int offset = 56; // int | 

try {
    final response = api.listMessages(mailboxId, folder, limit, offset);
    print(response);
} on DioException catch (e) {
    print('Exception when calling MobileApi->listMessages: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **mailboxId** | **int**|  | 
 **folder** | **String**|  | 
 **limit** | **int**|  | [optional] [default to 100]
 **offset** | **int**|  | [optional] [default to 0]

### Return type

[**BuiltList&lt;MessageSummary&gt;**](MessageSummary.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **login**
> LoginResponse login(loginRequest)

Log in (sets session cookie)

### Example
```dart
import 'package:openapi/api.dart';

final api = Openapi().getMobileApi();
final LoginRequest loginRequest = ; // LoginRequest | 

try {
    final response = api.login(loginRequest);
    print(response);
} on DioException catch (e) {
    print('Exception when calling MobileApi->login: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **loginRequest** | [**LoginRequest**](LoginRequest.md)|  | 

### Return type

[**LoginResponse**](LoginResponse.md)

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **markRead**
> OkResponse markRead(id, markReadRequest)

Set message read state

### Example
```dart
import 'package:openapi/api.dart';

final api = Openapi().getMobileApi();
final String id = id_example; // String | 
final MarkReadRequest markReadRequest = ; // MarkReadRequest | 

try {
    final response = api.markRead(id, markReadRequest);
    print(response);
} on DioException catch (e) {
    print('Exception when calling MobileApi->markRead: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **id** | **String**|  | 
 **markReadRequest** | [**MarkReadRequest**](MarkReadRequest.md)|  | [optional] 

### Return type

[**OkResponse**](OkResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **moveMessage**
> OkResponse moveMessage(id, moveMessageRequest)

Move a message to another folder

### Example
```dart
import 'package:openapi/api.dart';

final api = Openapi().getMobileApi();
final String id = id_example; // String | 
final MoveMessageRequest moveMessageRequest = ; // MoveMessageRequest | 

try {
    final response = api.moveMessage(id, moveMessageRequest);
    print(response);
} on DioException catch (e) {
    print('Exception when calling MobileApi->moveMessage: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **id** | **String**|  | 
 **moveMessageRequest** | [**MoveMessageRequest**](MoveMessageRequest.md)|  | 

### Return type

[**OkResponse**](OkResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **registerDevice**
> DeviceRegisterResponse registerDevice(deviceRegisterRequest)

Register a device, get a bearer token

### Example
```dart
import 'package:openapi/api.dart';

final api = Openapi().getMobileApi();
final DeviceRegisterRequest deviceRegisterRequest = ; // DeviceRegisterRequest | 

try {
    final response = api.registerDevice(deviceRegisterRequest);
    print(response);
} on DioException catch (e) {
    print('Exception when calling MobileApi->registerDevice: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **deviceRegisterRequest** | [**DeviceRegisterRequest**](DeviceRegisterRequest.md)|  | 

### Return type

[**DeviceRegisterResponse**](DeviceRegisterResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **searchMessages**
> BuiltList<SearchMessage> searchMessages(mailboxId, q, folder, limit)

Search messages

### Example
```dart
import 'package:openapi/api.dart';

final api = Openapi().getMobileApi();
final int mailboxId = 56; // int | 
final String q = q_example; // String | 
final String folder = folder_example; // String | 
final int limit = 56; // int | 

try {
    final response = api.searchMessages(mailboxId, q, folder, limit);
    print(response);
} on DioException catch (e) {
    print('Exception when calling MobileApi->searchMessages: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **mailboxId** | **int**|  | 
 **q** | **String**|  | 
 **folder** | **String**|  | [optional] 
 **limit** | **int**|  | [optional] [default to 50]

### Return type

[**BuiltList&lt;SearchMessage&gt;**](SearchMessage.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **starMessage**
> OkResponse starMessage(id, starMessageRequest)

Set message starred state

### Example
```dart
import 'package:openapi/api.dart';

final api = Openapi().getMobileApi();
final String id = id_example; // String | 
final StarMessageRequest starMessageRequest = ; // StarMessageRequest | 

try {
    final response = api.starMessage(id, starMessageRequest);
    print(response);
} on DioException catch (e) {
    print('Exception when calling MobileApi->starMessage: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **id** | **String**|  | 
 **starMessageRequest** | [**StarMessageRequest**](StarMessageRequest.md)|  | [optional] 

### Return type

[**OkResponse**](OkResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

