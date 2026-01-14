const std = @import("std");

const byte_buffer = @import("../byte-buffer.zig");
const ByteBuffer = byte_buffer.ByteBuffer;
const php = @import("../php.zig");
const Value = php.Value;
const Object = php.Object;
const String = php.String;
const HashTable = php.HashTable;
const structure = @import("../structure.zig");

pub const ErrorSet = struct {
    bytes: *ByteBuffer = undefined,

    const Super = structure.Parent(@This());

    pub const setStorage = Super.setStorage;
    pub const getValue = Super.getValue;

    pub const freeObject = Super.freeObject;
    pub const readProperty = Super.readProperty;
};
