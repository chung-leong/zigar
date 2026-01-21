const std = @import("std");

const accessor = @import("../accessor.zig");
const byte_buffer = @import("../byte-buffer.zig");
const ByteBuffer = byte_buffer.ByteBuffer;
const php = @import("../php.zig");
const HashTable = php.HashTable;
const Value = php.Value;
const Object = php.Object;
const String = php.String;
const structure = @import("../structure.zig");
const zig_class = @import("../zig-class.zig");
const ZigClass = zig_class.ZigClass;

pub const Comptime = struct {
    slots: Value = undefined,

    const Super = structure.Parent(@This());
    pub const Static = struct {
        value_acc: *accessor.Any = undefined,

        pub fn initialize(self: *@This(), class: *ZigClass) !void {
            const member = try class.getMember(.instance, 0);
            self.value_acc = &member.accessors;
        }
    };

    pub fn readSelf(obj: *Object) !Value {
        const self = fromObject(obj);
        const class = ZigClass.fromObject(obj);
        const static = class.getStaticData(@This());
        return try static.value_acc.get(self);
    }

    pub fn writeSelf(obj: *Object, value: *const Value) !void {
        const self = fromObject(obj);
        const class = ZigClass.fromObject(obj);
        const static = class.getStaticData(@This());
        return try static.value_acc.set(self, value);
    }

    pub fn getString(obj: *Object) !Value {
        var value = try readSelf(obj);
        php.convertValueToString(&value);
        return value;
    }

    pub fn readProperty(obj: *Object, name: *String, prop_type: c_int, cache_slot: ?[*]?*anyopaque, retval: *Value) *Value {
        std.debug.print("comptime => {s}\n", .{php.getStringContent(name)});
        return Super.readProperty(obj, name, prop_type, cache_slot, retval);
    }

    pub const fromObject = Super.fromObject;
    pub const setStorage = Super.setStorage;
    // pub const readSelf = Super.readSelf;
    pub const freeObject = Super.freeObject;
    // pub const readProperty = Super.readProperty;
    pub const writeProperty = Super.writeProperty;
};
