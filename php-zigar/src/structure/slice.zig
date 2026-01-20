const std = @import("std");

const accessor = @import("../accessor.zig");
const byte_buffer = @import("../byte-buffer.zig");
const ByteBuffer = byte_buffer.ByteBuffer;
const php = @import("../php.zig");
const Object = php.Object;
const Value = php.Value;
const structure = @import("../structure.zig");
const zig_class = @import("../zig-class.zig");
const ZigClass = zig_class.ZigClass;

pub const Slice = struct {
    bytes: *ByteBuffer = undefined,
    slots: Value = undefined,

    const Super = structure.Parent(@This());
    pub const Static = struct {
        value_acc: *accessor.Any = undefined,

        pub fn initialize(self: *@This(), class: *ZigClass) !void {
            const member = try class.getMember(.instance, 0);
            self.value_acc = &member.accessors;
        }
    };

    pub fn readElement(obj: *Object, key: *Value, _: c_int, retval: *Value) !?*Value {
        const self = Super.fromObject(obj);
        const class = ZigClass.fromStructure(self);
        const static = class.getStaticData(@This());
        const index = try getIndex(key);
        retval.* = try static.value_acc.getElement(self, index);
        return retval;
    }

    pub fn writeElement(obj: *Object, key: *Value, value: *Value) !void {
        const self = Super.fromObject(obj);
        const class = ZigClass.fromStructure(self);
        const static = class.getStaticData(@This());
        const index = try getIndex(key);
        try static.value_acc.setElement(self, index, value);
    }

    pub fn hasElement(obj: *Object, key: *Value, _: c_int) !c_int {
        const class = ZigClass.fromObject(obj);
        const index = getIndex(key) catch return 0;
        const len = class.length orelse return error.MissingLength;
        return if (index < len) 1 else 0;
    }

    pub fn countElements(obj: *Object, count: *php.Long) !c_int {
        const class = ZigClass.fromObject(obj);
        const len = class.length orelse return error.MissingLength;
        if (len > std.math.maxInt(php.Long)) return error.TooLarge;
        count.* = @intCast(len);
        return php.SUCCESS;
    }

    fn getIndex(key: *Value) !usize {
        const key_long = try php.getValueLong(key);
        if (key_long < 0) return error.NegativeIndex;
        return @intCast(key_long);
    }

    pub const setStorage = Super.setStorage;
    pub const readSelf = Super.readSelf;
    pub const freeObject = Super.freeObject;
    pub const readProperty = Super.readProperty;
    pub const writeProperty = Super.writeProperty;
};
