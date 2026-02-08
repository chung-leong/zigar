const std = @import("std");

const ByteBuffer = @import("../buffer.zig").ByteBuffer;
const php = @import("../php.zig");
const Value = php.Value;
const structure = @import("../structure.zig");

pub const Opaque = struct {
    bytes: *ByteBuffer = undefined,

    const Super = structure.Parent(@This());

    pub const setStorage = Super.setStorage;
    pub const getMemory = Super.getMemory;
    pub const readSelf = Super.readSelf;
    pub const freeObject = Super.freeObject;
};
