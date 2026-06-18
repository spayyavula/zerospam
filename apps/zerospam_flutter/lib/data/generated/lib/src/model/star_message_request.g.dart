// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'star_message_request.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

class _$StarMessageRequest extends StarMessageRequest {
  @override
  final bool? starred;

  factory _$StarMessageRequest([
    void Function(StarMessageRequestBuilder)? updates,
  ]) => (StarMessageRequestBuilder()..update(updates))._build();

  _$StarMessageRequest._({this.starred}) : super._();
  @override
  StarMessageRequest rebuild(
    void Function(StarMessageRequestBuilder) updates,
  ) => (toBuilder()..update(updates)).build();

  @override
  StarMessageRequestBuilder toBuilder() =>
      StarMessageRequestBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is StarMessageRequest && starred == other.starred;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, starred.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(
      r'StarMessageRequest',
    )..add('starred', starred)).toString();
  }
}

class StarMessageRequestBuilder
    implements Builder<StarMessageRequest, StarMessageRequestBuilder> {
  _$StarMessageRequest? _$v;

  bool? _starred;
  bool? get starred => _$this._starred;
  set starred(bool? starred) => _$this._starred = starred;

  StarMessageRequestBuilder() {
    StarMessageRequest._defaults(this);
  }

  StarMessageRequestBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _starred = $v.starred;
      _$v = null;
    }
    return this;
  }

  @override
  void replace(StarMessageRequest other) {
    _$v = other as _$StarMessageRequest;
  }

  @override
  void update(void Function(StarMessageRequestBuilder)? updates) {
    if (updates != null) updates(this);
  }

  @override
  StarMessageRequest build() => _build();

  _$StarMessageRequest _build() {
    final _$result = _$v ?? _$StarMessageRequest._(starred: starred);
    replace(_$result);
    return _$result;
  }
}

// ignore_for_file: deprecated_member_use_from_same_package,type=lint
