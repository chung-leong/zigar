const std = @import("std");

const accessor = @import("../accessor.zig");
const ObjectTransform = accessor.ObjectTransform;
const ByteBuffer = @import("../buffer.zig").ByteBuffer;
const ZigClassEntry = @import("../class-entry.zig").ZigClassEntry;
const php = @import("../php.zig");
const Object = php.Object;
const Value = php.Value;
const structure = @import("../structure.zig");

pub const Optional = struct {
    table: Value = undefined,
    buffer: *ByteBuffer = undefined,

    const Super = structure.Parent(@This());

    pub const Static = struct {
        payload_acc: *accessor.Any = undefined,
        payload_transform: ?ObjectTransform = null,
        present_acc: *accessor.Primitive = undefined,

        pub fn init(self: *@This(), class_obj: *Object) !void {
            const class = ZigClassEntry.fromObject(class_obj);
            const member0 = try class.getMember(.instance, 0);
            self.payload_acc = &member0.accessors;
            self.payload_transform = member0.objectTransform();
            const member1 = try class.getMember(.instance, 1);
            if (member1.accessors != .primitive) return error.InvalidAccessor;
            self.present_acc = &member1.accessors.primitive;
        }
    };

    pub fn getValue(self: *@This(), transform: ObjectTransform) !Value {
        const class = ZigClassEntry.fromStructure(self);
        const static = class.getStaticData(@This());
        const present = try static.present_acc.get(self.buffer);
        if (try php.getValueLong(&present) == 0) {
            return php.createValueNull();
        }
        var value = try static.payload_acc.get(self);
        if (static.payload_transform) |ot| {
            try ot.apply(&value);
        } else if (transform != .to_value) {
            try transform.apply(&value);
        }
        return value;
    }

    pub fn setValue(self: *@This(), value: *const Value) !void {
        if (try self.copySelf(value)) return;
        const class = ZigClassEntry.fromStructure(self);
        const static = class.getStaticData(@This());
        const is_present = if (php.getValueNull(value)) false else |_| true;
        if (is_present) {
            try static.payload_acc.set(self, value);
        } else {
            const null_value = php.createValueNull();
            try static.payload_acc.set(self, &null_value);
        }
        if (class.flags.optional.has_selector) {
            // optionals of error sets and pointers don't use a separate present flag
            // non-zero value indiciate whether a value is present or not
            const present_flag = php.createValueLong(if (is_present) 1 else 0);
            try static.present_acc.set(self.buffer, &present_flag);
        }
    }

    pub fn visitPointers(self: *@This(), cb: anytype, args: anytype, comptime options: structure.VisitOptions) accessor.Error!void {
        const class = ZigClassEntry.fromStructure(self);
        if (class.flags.common.has_pointer) {
            const static = class.getStaticData(@This());
            const present = try static.present_acc.get(self.buffer);
            if (try php.getValueLong(&present) != 0) {
                const value = try static.payload_acc.get(self);
                defer php.release(&value);
                const obj = php.getValueObject(&value) catch return;
                try structure.invokeMethod(obj, "visitPointers", .{ cb, args, options });
            }
        }
    }

    pub const getExtent = Super.getExtent;
    pub const setStorage = Super.setStorage;
    pub const initialize = Super.initialize;
    pub const finalize = Super.finalize;
    pub const externalize = Super.externalize;
    pub const checkArguments = Super.checkArguments;
    pub const freeObject = Super.freeObject;
    pub const castObject = Super.castObject;
    pub const readProperty = Super.readProperty;
    pub const writeProperty = Super.writeProperty;
    pub const hasProperty = Super.hasProperty;
    pub const getReferencedObjects = Super.getReferencedObjects;
    const fromObject = Super.fromObject;
    const copySelf = Super.copySelf;
};
