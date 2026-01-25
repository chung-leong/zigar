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

    pub fn readSelf(obj: *Object) !Value {
        const self = fromObject(obj);
        _ = self;
        unreachable;
    }

    pub fn writeSelf(obj: *Object, value: *const Value) !void {
        const self = fromObject(obj);
        _ = self;
        _ = value;
        unreachable;
    }

    pub fn getString(obj: *Object) !Value {
        const self = fromObject(obj);
        const class = ZigClass.fromObject(obj);
        _ = self;
        _ = class;
        std.debug.print("getString\n", .{});
        unreachable;
    }

    pub const fromObject = Super.fromObject;
    pub const setStorage = Super.setStorage;
    pub const freeObject = Super.freeObject;
    pub const readProperty = Super.readProperty;
};
