const std = @import("std");

const ByteBuffer = @import("../buffer.zig").ByteBuffer;
const ZigClass = @import("../class.zig").ZigClass;
const php = @import("../php.zig");
const Object = php.Object;
const Value = php.Value;
const structure = @import("../structure.zig");

pub const Pointer = struct {
    bytes: *ByteBuffer = undefined,
    slots: Value = undefined,

    const Super = structure.Parent(@This());

    pub fn readSelf(self: *@This()) !Value {
        _ = self;
        unreachable;
    }

    pub fn writeSelf(self: *@This(), value: *const Value) !void {
        _ = self;
        _ = value;
        unreachable;
    }

    pub fn getString(self: *@This()) !Value {
        const class = ZigClass.fromStructure(self);
        _ = class;
        std.debug.print("getString\n", .{});
        unreachable;
    }

    pub const fromObject = Super.fromObject;
    pub const setStorage = Super.setStorage;
    pub const freeObject = Super.freeObject;
    pub const readProperty = Super.readProperty;
};
