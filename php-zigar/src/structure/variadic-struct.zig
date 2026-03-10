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
        unreachable;
    }

    pub fn getReturnValue(self: *@This()) !Value {
        _ = self;
        unreachable;
    }

    pub fn getArguments(self: *@This()) ![]Value {
        _ = self;
        unreachable;
    }

    pub fn setReturnValue(self: *@This(), value: *const Value) !void {
        _ = self;
        _ = value;
        unreachable;
    }

    pub const setStorage = Super.setStorage;
    pub const readSelf = Super.readSelf;
    pub const getExtent = Super.getExtent;
    pub const freeObject = Super.freeObject;
    pub const getReferencedObjects = Super.getReferencedObjects;
    const fromObject = Super.fromObject;
};
