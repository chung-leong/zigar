const std = @import("std");

const ByteBuffer = @import("../buffer.zig").ByteBuffer;
const php = @import("../php.zig");
const Value = php.Value;
const structure = @import("../structure.zig");

pub const VariadicStruct = struct {
    bytes: *ByteBuffer = undefined,
    slots: Value = undefined,

    const Super = structure.Parent(@This());

    pub const setStorage = Super.setStorage;
    pub const readSelf = Super.readSelf;
    pub const freeObject = Super.freeObject;
    pub const readProperty = Super.readProperty;
};
