const std = @import("std");

const accessor = @import("../accessor.zig");
const ObjectTransform = accessor.ObjectTransform;
const ByteBuffer = @import("../buffer.zig").ByteBuffer;
const ZigClassEntry = @import("../class-entry.zig").ZigClassEntry;
const php = @import("../php.zig");
const ClassEntry = php.ClassEntry;
const HashTableIterator = php.HashTableIterator;
const Object = php.Object;
const ObjectIterator = php.ObjectIterator;
const Value = php.Value;
const structure = @import("../structure.zig");

pub const Vector = struct {
    table: Value = undefined,
    buffer: *ByteBuffer = undefined,

    const Super = structure.ArrayLike(@This());

    pub const Static = struct {
        value_acc: *accessor.Any = undefined,

        pub fn init(self: *@This(), class_obj: *Object) !void {
            const class = ZigClassEntry.fromObject(class_obj);
            if (class.length == null) return error.Unexpected;
            // fetch the accessor in advance since we know it can only be a of the vector type
            const member = try class.getMember(.instance, 0);
            self.value_acc = &member.accessors;
        }
    };

    pub fn getLength(self: *@This()) usize {
        const class = ZigClassEntry.fromStructure(self);
        return class.length.?;
    }

    pub fn getElement(self: *@This(), index: usize, comptime _: bool) !Value {
        const class = ZigClassEntry.fromStructure(self);
        const static = class.getStaticData(@This());
        return try static.value_acc.getElement(self, index);
    }

    pub fn setElement(self: *@This(), index: usize, value: *Value) !void {
        const class = ZigClassEntry.fromStructure(self);
        const static = class.getStaticData(@This());
        try static.value_acc.setElement(self, index, value);
    }

    pub const getExtent = Super.getExtent;
    pub const setStorage = Super.setStorage;
    pub const initialize = Super.initialize;
    pub const finalize = Super.finalize;
    pub const externalize = Super.externalize;
    pub const checkArguments = Super.checkArguments;
    pub const getValue = Super.getValue;
    pub const setValue = Super.setValue;
    pub const visitPointers = Super.Super.visitPointers;
    pub const readElement = Super.readElement;
    pub const writeElement = Super.writeElement;
    pub const hasElement = Super.hasElement;
    pub const countElements = Super.countElements;
    pub const readProperty = Super.readProperty;
    pub const writeProperty = Super.writeProperty;
    pub const hasProperty = Super.hasProperty;
    pub const getProperties = Super.getProperties;
    pub const freeObject = Super.freeObject;
    pub const castObject = Super.castObject;
    pub const getReferencedObjects = Super.getReferencedObjects;
    pub const getIterator = Super.getIterator;
    const getIndex = Super.getIndex;
};
