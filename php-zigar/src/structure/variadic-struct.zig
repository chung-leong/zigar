const std = @import("std");

const ByteBuffer = @import("../buffer.zig").ByteBuffer;
const ZigClassEntry = @import("../class-entry.zig").ZigClassEntry;
const php = @import("../php.zig");
const Object = php.Object;
const Value = php.Value;
const structure = @import("../structure.zig");

pub const VariadicStruct = struct {
    slots: Value = undefined,
    bytes: *ByteBuffer = undefined,

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

    pub fn freeObject(obj: *Object) void {
        const class = ZigClassEntry.fromObject(obj);
        defer class.release();
        const self = fromObject(obj);
        self.bytes.release();
        php.release(&self.slots);
    }

    pub const setStorage = Super.setStorage;
    pub const readSelf = Super.readSelf;
    pub const getExtent = Super.getExtent;
    pub const getReferencedObjects = Super.getReferencedObjects;
    const fromObject = Super.fromObject;
};
