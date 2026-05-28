const std = @import("std");

const accessor = @import("../accessor.zig");
const Transform = accessor.Transform;
const ByteBuffer = @import("../buffer.zig").ByteBuffer;
const cache = @import("../cache.zig");
const ZigClassEntry = @import("../class-entry.zig").ZigClassEntry;
const php = @import("../php.zig");
const ClassEntry = php.ClassEntry;
const HashTableIterator = php.HashTableIterator;
const Object = php.Object;
const ObjectIterator = php.ObjectIterator;
const String = php.String;
const Value = php.Value;
const structure = @import("../structure.zig");

pub const Vector = struct {
    table: Value = undefined,
    buffer: *ByteBuffer = undefined,

    pub const Super = structure.ArrayLike(@This());
    pub const Static = struct {
        value_acc: *accessor.Any = undefined,
        element_class: *ZigClassEntry = undefined,
        is_bool_element: bool = undefined,

        pub const StaticPropCache = cache.IdCache(.{ .child, .len }, "__", .{});

        pub fn init(self: *@This(), class_obj: *Object) !void {
            const class = ZigClassEntry.fromObject(class_obj);
            if (class.length == null) return error.Unexpected;
            // fetch the accessor in advance since we know it can only be a of the vector type
            const member = try class.getMember(.instance, 0);
            self.value_acc = &member.accessors;
            self.element_class = member.class;
            self.is_bool_element = member.type == .bool;
        }

        pub fn getStaticProperty(self: *@This(), name: *String, cache_slot: ?[*]?*anyopaque) !Value {
            if (StaticPropCache.idFromString(name, cache_slot)) |id| {
                const class = ZigClassEntry.fromStatic(self);
                return switch (id) {
                    .child => get: {
                        php.addRef(self.element_class.object);
                        break :get php.createValueObject(self.element_class.object);
                    },
                    .len => php.createValueAnyInt(class.length.?),
                };
            } else {
                return error.Missing;
            }
        }

        pub fn staticPropertyExists(_: *@This(), name: *String, cache_slot: ?[*]?*anyopaque) bool {
            return StaticPropCache.idFromString(name, cache_slot) != null;
        }
    };

    pub fn setStorage(self: *@This(), buffer: *ByteBuffer, table: *const Value) !void {
        try Super.setStorage(self, buffer, table);
        const class = ZigClassEntry.fromStructure(self);
        const static = class.getStaticData(@This());
        if (static.is_bool_element) {
            // boolean vectors are always packed
            buffer.markPackedData();
        }
    }

    pub fn getLength(self: *@This()) usize {
        const class = ZigClassEntry.fromStructure(self);
        return class.length.?;
    }

    pub fn getElement(self: *@This(), index: usize) !Value {
        const class = ZigClassEntry.fromStructure(self);
        const static = class.getStaticData(@This());
        return try static.value_acc.getElement(self, index);
    }

    pub fn getElementEx(self: *@This(), index: usize, transform: ?accessor.Transform) !Value {
        const class = ZigClassEntry.fromStructure(self);
        const static = class.getStaticData(@This());
        return try static.value_acc.getElementEx(self, index, transform);
    }

    pub fn setElement(self: *@This(), index: usize, value: *const Value) !void {
        const class = ZigClassEntry.fromStructure(self);
        const static = class.getStaticData(@This());
        try static.value_acc.setElement(self, index, value);
    }

    pub const getExtent = Super.getExtent;
    pub const initialize = Super.initialize;
    pub const finalize = Super.finalize;
    pub const externalize = Super.externalize;
    pub const checkArguments = Super.checkArguments;
    pub const getValue = Super.getValue;
    pub const setValue = Super.setValue;
    pub const getProperty = Super.getProperty;
    pub const setProperty = Super.setProperty;
    pub const propertyExists = Super.propertyExists;
    pub const visitPointers = Super.Super.visitPointers;
    pub const getConstructor = Super.getConstructor;
    pub const readElement = Super.readElement;
    pub const writeElement = Super.writeElement;
    pub const hasElement = Super.hasElement;
    pub const countElements = Super.countElements;
    pub const freeObject = Super.freeObject;
    pub const castObject = Super.castObject;
    pub const readProperty = Super.readProperty;
    pub const writeProperty = Super.writeProperty;
    pub const hasProperty = Super.hasProperty;
    pub const getProperties = Super.getProperties;
    pub const getPropertyPointer = Super.getPropertyPointer;
    pub const compare = Super.compare;
    pub const getGarbageCollection = Super.getGarbageCollection;
    pub const getIterator = Super.getIterator;
    const getIndex = Super.getIndex;
};
