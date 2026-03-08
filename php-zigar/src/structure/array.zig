const std = @import("std");

const accessor = @import("../accessor.zig");
const ObjectTransform = accessor.ObjectTransform;
const ByteBuffer = @import("../buffer.zig").ByteBuffer;
const ZigClassEntry = @import("../class-entry.zig").ZigClassEntry;
const php = @import("../php.zig");
const ClassEntry = php.ClassEntry;
const HashTable = php.HashTable;
const HashTableIterator = php.HashTableIterator;
const Object = php.Object;
const String = php.String;
const Value = php.Value;
const structure = @import("../structure.zig");

pub const Array = struct {
    bytes: *ByteBuffer = undefined,
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

    pub fn getLength(self: *@This()) !usize {
        const class = ZigClassEntry.fromStructure(self);
        return class.length orelse return error.Unexpected;
    }

    pub fn getElement(self: *@This(), index: usize) !Value {
        const class = ZigClassEntry.fromStructure(self);
        const static = class.getStaticData(@This());
        return try static.value_acc.getElement(self, index);
    }

    pub fn setElement(self: *@This(), index: usize, value: *Value) !void {
        const class = ZigClassEntry.fromStructure(self);
        const static = class.getStaticData(@This());
        try static.value_acc.setElement(self, index, value);
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
    pub const getProperties = Super.getVectorProperties;
    pub const freeObject = Super.freeObject;
    pub const castObject = Super.castObject;
    pub const getIterator = Super.getVectorIterator;
    pub const getReferencedObjects = Super.getReferencedObjects;
    const fromObject = Super.fromObject;
    const getIndex = Super.getIndex;
};
