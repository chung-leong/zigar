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
    table: Value = undefined,
    buffer: *ByteBuffer = undefined,

    const Super = structure.ArrayLike(@This());

    pub const Static = struct {
        value_acc: *accessor.Any = undefined,
        value_transform: ?ObjectTransform = null,

        pub fn init(self: *@This(), class_obj: *Object) !void {
            const class = ZigClassEntry.fromObject(class_obj);
            if (class.length == null) return error.Unexpected;
            const member = try class.getMember(.instance, 0);
            self.value_acc = &member.accessors;
            self.value_transform = member.objectTransform();
        }
    };

    pub fn getLength(self: *@This()) usize {
        const class = ZigClassEntry.fromStructure(self);
        return class.length.?;
    }

    pub fn getElement(self: *@This(), index: usize, comptime use_perform: bool) !Value {
        const class = ZigClassEntry.fromStructure(self);
        const static = class.getStaticData(@This());
        var value = try static.value_acc.getElement(self, index);
        if (use_perform) {
            if (static.value_transform) |ot| try ot.apply(&value);
        }
        return value;
    }

    pub fn setElement(self: *@This(), index: usize, value: *Value) !void {
        const class = ZigClassEntry.fromStructure(self);
        const static = class.getStaticData(@This());
        try static.value_acc.setElement(self, index, value);
    }

    pub const initialize = Super.initialize;
    pub const externalize = Super.externalize;
    pub const checkArguments = Super.checkArguments;
    pub const readSelf = Super.readSelf;
    pub const writeSelf = Super.writeSelf;
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
    pub const getIterator = Super.getIterator;
    pub const getReferencedObjects = Super.getReferencedObjects;
    const fromObject = Super.fromObject;
    const getIndex = Super.getIndex;
};
