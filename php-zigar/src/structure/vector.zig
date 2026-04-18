const std = @import("std");

const accessor = @import("../accessor.zig");
const Transform = accessor.Transform;
const ByteBuffer = @import("../buffer.zig").ByteBuffer;
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

    const Super = structure.ArrayLike(@This());

    pub const Static = struct {
        value_acc: *accessor.Any = undefined,
        element_class: *ZigClassEntry = undefined,

        pub const StaticPropId = enum { child };
        pub const StaticPropCacheEntry = struct {
            id: usize,
            prop_id: StaticPropId,

            const name = "static:vector";

            pub inline fn find(cache_slot: ?[*]?*anyopaque) !?StaticPropId {
                const self: *@This() = if (cache_slot) |ptr| @ptrCast(ptr) else return null;
                return if (self.id == @intFromPtr(name))
                    self.prop_id
                else if (self.id != 0)
                    error.ForAnotherCache
                else
                    null;
            }

            pub inline fn set(cache_slot: ?[*]?*anyopaque, prop_id: StaticPropId) void {
                const self: *@This() = if (cache_slot) |ptr| @ptrCast(ptr) else return;
                self.* = .{ .id = @intFromPtr(name), .prop_id = prop_id };
            }
        };

        pub fn init(self: *@This(), class_obj: *Object) !void {
            const class = ZigClassEntry.fromObject(class_obj);
            if (class.length == null) return error.Unexpected;
            // fetch the accessor in advance since we know it can only be a of the vector type
            const member = try class.getMember(.instance, 0);
            self.value_acc = &member.accessors;
            self.element_class = member.class;
        }

        pub fn getStaticProperty(self: *@This(), name: *String, cache_slot: ?[*]?*anyopaque) !Value {
            if (findStaticPropId(name, cache_slot)) |id| {
                const prop_obj = switch (id) {
                    .child => self.element_class.object,
                };
                php.addRef(prop_obj);
                return php.createValueObject(prop_obj);
            } else {
                return error.Missing;
            }
        }

        pub fn staticPropertyExists(_: *@This(), name: *String, cache_slot: ?[*]?*anyopaque) bool {
            return findStaticPropId(name, cache_slot) != null;
        }

        fn findStaticPropId(name: *String, cache_slot: ?[*]?*anyopaque) ?StaticPropId {
            if (StaticPropCacheEntry.find(cache_slot) catch return null) |id| return id;
            inline for (std.meta.fields(StaticPropId)) |field| {
                if (php.matchString(name, "__" ++ field.name)) {
                    const id = @field(StaticPropId, field.name);
                    StaticPropCacheEntry.set(cache_slot, id);
                    return id;
                }
            }
            return null;
        }
    };

    pub fn setStorage(self: *@This(), buffer: *ByteBuffer, table: *const Value) !void {
        try Super.setStorage(self, buffer, table);
        const class = ZigClassEntry.fromStructure(self);
        const static = class.getStaticData(@This());
        if (static.value_acc.getType() == .bool) {
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

    pub fn setElement(self: *@This(), index: usize, value: *Value) !void {
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
    pub const getGarbageCollection = Super.getGarbageCollection;
    pub const getIterator = Super.getIterator;
    const getIndex = Super.getIndex;
};
