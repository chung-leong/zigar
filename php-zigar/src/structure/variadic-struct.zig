const std = @import("std");

const ByteBuffer = @import("../buffer.zig").ByteBuffer;
const php = @import("../php.zig");
const Value = php.Value;
const structure = @import("../structure.zig");

pub const VariadicStruct = struct {
    bytes: *ByteBuffer = undefined,
    slots: Value = undefined,

    const Super = structure.Parent(@This());
    pub const Static = structure.ArgStruct.Static;

    pub fn copyArguments(self: *@This(), iter: *php.ArgumentIterator) !void {
        _ = self;
        _ = iter;
        return error.NotImplemented;
    }

    pub fn getReturnValue(self: *@This()) !Value {
        _ = self;
    }

    pub const setStorage = Super.setStorage;
    pub const getMemory = Super.getMemory;
    pub const readSelf = Super.readSelf;
    pub const freeObject = Super.freeObject;
    const fromObject = Super.fromObject;
};
