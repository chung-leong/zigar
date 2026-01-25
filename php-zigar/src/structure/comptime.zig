const std = @import("std");

const accessor = @import("../accessor.zig");
const ByteBuffer = @import("../buffer.zig").ByteBuffer;
const ZigClass = @import("../class.zig").ZigClass;
const php = @import("../php.zig");
const HashTable = php.HashTable;
const Value = php.Value;
const Object = php.Object;
const String = php.String;
const structure = @import("../structure.zig");

pub const Comptime = struct {
    slots: Value = undefined,
    circular_ref: bool = false,

    const Super = structure.Parent(@This());
    pub const Static = struct {
        value_acc: *accessor.Any = undefined,

        pub fn init(self: *@This(), class: *ZigClass) !void {
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

    pub const fromObject = Super.fromObject;
    pub const setStorage = Super.setStorage;
    pub const freeObject = Super.freeObject;
    pub const readProperty = Super.readProperty;
    pub const writeProperty = Super.writeProperty;
};
