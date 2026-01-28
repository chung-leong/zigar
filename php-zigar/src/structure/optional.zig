const std = @import("std");

const accessor = @import("../accessor.zig");
const ByteBuffer = @import("../buffer.zig").ByteBuffer;
const ZigClass = @import("../class.zig").ZigClass;
const php = @import("../php.zig");
const Object = php.Object;
const Value = php.Value;
const structure = @import("../structure.zig");

pub const Optional = struct {
    bytes: *ByteBuffer = undefined,
    slots: Value = undefined,

    const Super = structure.Parent(@This());
    pub const Static = struct {
        payload_acc: *accessor.Any = undefined,
        present_acc: *accessor.Primitive = undefined,

        pub fn init(self: *@This(), class: *ZigClass) !void {
            const member0 = try class.getMember(.instance, 0);
            self.payload_acc = &member0.accessors;
            const member1 = try class.getMember(.instance, 1);
            if (member1.accessors != .primitive) return error.InvalidAccessor;
            self.present_acc = &member1.accessors.primitive;
        }
    };

    pub fn readSelf(obj: *Object) !Value {
        const self = fromObject(obj);
        const class = ZigClass.fromObject(obj);
        const static = class.getStaticData(@This());
        const present = try static.present_acc.get(self.bytes);
        const is_present = try php.getValueLong(&present) != 0;
        if (is_present) {
            return try static.payload_acc.get(self);
        } else {
            return php.createValueNull();
        }
    }

    pub fn writeSelf(obj: *Object, value: *const Value) !void {
        const self = fromObject(obj);
        const class = ZigClass.fromObject(obj);
        const static = class.getStaticData(@This());
        const is_present = if (php.getValueNull(value)) false else |_| true;
        if (is_present) {
            try static.payload_acc.set(self, value);
        }
        const present_flag = php.createValueLong(if (is_present) 1 else 0);
        try static.present_acc.set(self.bytes, &present_flag);
    }

    pub const fromObject = Super.fromObject;
    pub const setStorage = Super.setStorage;
    pub const freeObject = Super.freeObject;
};
