const std = @import("std");

const accessor = @import("../accessor.zig");
const byte_buffer = @import("../byte-buffer.zig");
const ByteBuffer = byte_buffer.ByteBuffer;
const php = @import("../php.zig");
const Value = php.Value;
const Object = php.Object;
const HashTable = php.HashTable;
const structure = @import("../structure.zig");

pub const Struct = struct {
    bytes: *ByteBuffer = undefined,
    slots: ?*HashTable = undefined,

    const Super = structure.Parent(@This());

    pub const setStorage = Super.setStorage;
    pub const readSelf = Super.readSelf;
    pub const freeObject = Super.freeObject;
    pub const readProperty = Super.readProperty;
};
