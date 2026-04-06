const std = @import("std");

const accessor = @import("../accessor.zig");
const ObjectTransform = accessor.ObjectTransform;
const ByteBuffer = @import("../buffer.zig").ByteBuffer;
const ZigClassEntry = @import("../class-entry.zig").ZigClassEntry;
const php = @import("../php.zig");
const Object = php.Object;
const Value = php.Value;
const structure = @import("../structure.zig");

pub const Primitive = struct {
    buffer: *ByteBuffer = undefined,

    const Super = structure.Parent(@This());

    pub const Static = struct {
        value_acc: *accessor.Any = undefined,

        pub fn init(self: *@This(), class_obj: *Object) !void {
            const class = ZigClassEntry.fromObject(class_obj);
            const member = try class.getMember(.instance, 0);
            self.value_acc = &member.accessors;
        }
    };

    pub fn getValue(self: *@This(), transform: ObjectTransform) !Value {
        if (transform == .to_bytes) return try self.returnBytes();
        const class = ZigClassEntry.fromStructure(self);
        const static = class.getStaticData(@This());
        var value = try static.value_acc.get(self);
        try transform.apply(&value);
        return value;
    }

    pub fn setValue(self: *@This(), value: *const Value) !void {
        const class = ZigClassEntry.fromStructure(self);
        const static = class.getStaticData(@This());
        return try static.value_acc.set(self, value);
    }

    pub const getExtent = Super.getExtent;
    pub const setStorage = Super.setStorage;
    pub const initialize = Super.initialize;
    pub const finalize = Super.finalize;
    pub const externalize = Super.externalize;
    pub const checkArguments = Super.checkArguments;
    pub const visitPointers = Super.visitPointers;
    pub const freeObject = Super.freeObject;
    pub const castObject = Super.castObject;
    pub const readProperty = Super.readProperty;
    pub const writeProperty = Super.writeProperty;
    pub const getReferencedObjects = Super.getReferencedObjects;
    const fromObject = Super.fromObject;
    const returnBytes = Super.returnBytes;
};
