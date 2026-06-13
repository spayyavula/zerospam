# openapi.api.MobileApi

## Load the API package
```dart
import 'package:openapi/api.dart';
```

All URIs are relative to *http://localhost:8025*

Method | HTTP request | Description
------------- | ------------- | -------------
[**getMe**](MobileApi.md#getme) | **GET** /api/auth/me | Current user
[**getMessage**](MobileApi.md#getmessage) | **GET** /api/messages/{id} | Get one message
[**listMailboxes**](MobileApi.md#listmailboxes) | **GET** /api/mailboxes | List mailboxes
[**listMessages**](MobileApi.md#listmessages) | **GET** /api/messages | List messages in a folder
[**login**](MobileApi.md#login) | **POST** /api/auth/login | Log in (sets session cookie)
[**registerDevice**](MobileApi.md#registerdevice) | **POST** /api/auth/devices | Register a device, get a bearer token


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

