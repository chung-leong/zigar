const std = @import("std");

const accessor = @import("../accessor.zig");
const ByteBuffer = @import("../buffer.zig").ByteBuffer;
const ZigClassEntry = @import("../class-entry.zig").ZigClassEntry;
const php = @import("../php.zig");
const HashTable = php.HashTable;
const Value = php.Value;
const Object = php.Object;
const String = php.String;
const structure = @import("../structure.zig");

pub const Comptime = struct {
    slots: Value = undefined,

    const Super = structure.Parent(@This());
    pub const Static = struct {
        value_acc: *accessor.Any = undefined,

        pub fn init(self: *@This(), class_obj: *Object) !void {
            const class = ZigClassEntry.fromObject(class_obj);
            const member = try class.getMember(.instance, 0);
            self.value_acc = &member.accessors;
        }
    };

    pub fn getExtent(_: *@This()) Super.ByteExtent {
        return .{ .address = 0 };
    }

    pub fn readSelf(self: *@This()) !Value {
        const class = ZigClassEntry.fromStructure(self);
        const static = class.getStaticData(@This());
        return try static.value_acc.get(self);
    }

    pub fn writeSelf(self: *@This(), value: *const Value) !void {
        const class = ZigClassEntry.fromStructure(self);
        const static = class.getStaticData(@This());
        return try static.value_acc.set(self, value);
    }

    pub fn stringify(self: *@This()) !Value {
        var value = try self.readSelf();
        php.convertValueToString(&value);
        return value;
    }

    pub const setStorage = Super.setStorage;
    pub const freeObject = Super.freeObject;
    const fromObject = Super.fromObject;
};
