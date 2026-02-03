const std = @import("std");

const ByteBuffer = @import("../buffer.zig").ByteBuffer;
const ZigClassEntry = @import("../class-entry.zig").ZigClassEntry;
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

    pub fn stringify(self: *@This()) !Value {
        const class = ZigClassEntry.fromStructure(self);
        _ = class;
        std.debug.print("stringify\n", .{});
        unreachable;
    }

    pub const setStorage = Super.setStorage;
    pub const copyArguments = Super.copyArguments;
    pub const freeObject = Super.freeObject;
    const fromObject = Super.fromObject;
};
