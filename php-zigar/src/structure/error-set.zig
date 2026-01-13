const std = @import("std");

const byte_buffer = @import("../byte-buffer.zig");
const ByteBuffer = byte_buffer.ByteBuffer;
const php = @import("../php.zig");
const Value = php.Value;
const Object = php.Object;
const String = php.String;
const HashTable = php.HashTable;
const All = @import("all.zig").All;

pub const ErrorSet = struct {
    bytes: *ByteBuffer = undefined,

    const Parent = All(@This());

    pub const setStorage = Parent.setStorage;
    pub const getValue = Parent.getValue;

    pub const freeObject = Parent.freeObject;
    pub const readProperty = Parent.readProperty;
};
