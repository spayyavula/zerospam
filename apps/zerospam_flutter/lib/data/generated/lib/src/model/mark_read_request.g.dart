// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'mark_read_request.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

class _$MarkReadRequest extends MarkReadRequest {
  @override
  final bool? read;

  factory _$MarkReadRequest([void Function(MarkReadRequestBuilder)? updates]) =>
      (MarkReadRequestBuilder()..update(updates))._build();

  _$MarkReadRequest._({this.read}) : super._();
  @override
  MarkReadRequest rebuild(void Function(MarkReadRequestBuilder) updates) =>
      (toBuilder()..update(updates)).build();

  @override
  MarkReadRequestBuilder toBuilder() => MarkReadRequestBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is MarkReadRequest && read == other.read;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, read.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(
      r'MarkReadRequest',
    )..add('read', read)).toString();
  }
}

class MarkReadRequestBuilder
    implements Builder<MarkReadRequest, MarkReadRequestBuilder> {
  _$MarkReadRequest? _$v;

  bool? _read;
  bool? get read => _$this._read;
  set read(bool? read) => _$this._read = read;

  MarkReadRequestBuilder() {
    MarkReadRequest._defaults(this);
  }

  MarkReadRequestBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _read = $v.read;
      _$v = null;
    }
    return this;
  }

  @override
  void replace(MarkReadRequest other) {
    _$v = other as _$MarkReadRequest;
  }

  @override
  void update(void Function(MarkReadRequestBuilder)? updates) {
    if (updates != null) updates(this);
  }

  @override
  MarkReadRequest build() => _build();

  _$MarkReadRequest _build() {
    final _$result = _$v ?? _$MarkReadRequest._(read: read);
    replace(_$result);
    return _$result;
  }
}

// ignore_for_file: deprecated_member_use_from_same_package,type=lint
