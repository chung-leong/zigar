const std = @import("std");

const accessor = @import("../accessor.zig");
const ObjectTransform = accessor.ObjectTransform;
const ByteBuffer = @import("../buffer.zig").ByteBuffer;
const ZigClassEntry = @import("../class-entry.zig").ZigClassEntry;
const Iterator = @import("../iterator.zig").Iterator;
const php = @import("../php.zig");
const ClassEntry = php.ClassEntry;
const HashTableIterator = php.HashTableIterator;
const Object = php.Object;
const ObjectIterator = php.ObjectIterator;
const Value = php.Value;
const structure = @import("../structure.zig");

pub const Vector = struct {
    bytes: *ByteBuffer = undefined,

    const Super = structure.Parent(@This());

    pub const Static = struct {
        value_acc: *accessor.Vector = undefined,

        pub fn init(self: *@This(), class_obj: *Object) !void {
            const class = ZigClassEntry.fromObject(class_obj);
            if (class.length == null) return error.Unexpected;
            // fetch the accessor in advance since we know it can only be a of the vector type
            const member = try class.getMember(.instance, 0);
            if (member.accessors != .vector) return error.InvalidAccessor;
            self.value_acc = &member.accessors.vector;
        }
    };

    pub fn getLength(self: *@This()) !usize {
        const class = ZigClassEntry.fromStructure(self);
        return class.length orelse return error.Unexpected;
    }

    pub fn getElement(self: *@This(), index: usize) !Value {
        const class = ZigClassEntry.fromStructure(self);
        const static = class.getStaticData(@This());
        return try static.value_acc.get(self.bytes, index);
    }

    pub fn setElement(self: *@This(), index: usize, value: *Value) !void {
        const class = ZigClassEntry.fromStructure(self);
        const static = class.getStaticData(@This());
        try static.value_acc.set(self.bytes, index, value);
    }

    pub const setStorage = Super.setStorage;
    pub const getExtent = Super.getExtent;
    pub const copyArguments = Super.copyArguments;
    pub const readSelf = Super.readVector;
    pub const writeSelf = Super.writeVector;
    pub const readElement = Super.readVectorElement;
    pub const writeElement = Super.writeVectorElement;
    pub const hasElement = Super.hasVectorElement;
    pub const countElements = Super.countVectorElements;
    pub const readProperty = Super.readGenericProperty;
    pub const writeProperty = Super.writeGenericProperty;
    pub const hasProperty = Super.hasGenericProperty;
    pub const getProperties = Super.getVectorProperties;
    pub const freeObject = Super.freeObject;
    pub const castObject = Super.castObject;
    pub const getIterator = Super.getVectorIterator;
    pub const getReferencedObjects = Super.getReferencedObjects;
    const getIndex = Super.getIndex;
};
