const std = @import("std");

const accessor = @import("../accessor.zig");
const ByteBuffer = @import("../buffer.zig").ByteBuffer;
const ZigClassEntry = @import("../class-entry.zig").ZigClassEntry;
const failure = @import("../failure.zig");
const iterator = @import("../iterator.zig");
const php = @import("../php.zig");
const ClassEntry = php.ClassEntry;
const Object = php.Object;
const ObjectIterator = php.ObjectIterator;
const String = php.String;
const Value = php.Value;
const structure = @import("../structure.zig");

pub const Opaque = struct {
    buffer: *ByteBuffer = undefined,

    const Super = structure.StructLike(@This());

    pub const Static = struct {
        prop_names: []*String = &.{},

        pub fn init(self: *@This(), class_obj: *Object) !void {
            // create a list of property names for use by iterator
            const class = ZigClassEntry.fromObject(class_obj);
            self.prop_names = try class.createPropertyList(.instance);
        }

        pub fn deinit(self: *@This()) void {
            if (self.prop_names.len > 0) php.allocator.free(self.prop_names);
        }
    };

    pub fn getIterator(obj: *Object) !?*ObjectIterator {
        const class = ZigClassEntry.fromObject(obj);
        const static = class.getStaticData(@This());
        return try iterator.PropertyIterator(@This()).create(obj, static.prop_names, &.{});
    }

    fn throwException(self: *@This()) error{Unexpected} {
        const class = ZigClassEntry.fromStructure(self);
        return failure.report("cannot access opaque structure '{s}' (zig)", .{
            class.getName(),
        });
    }

    pub const getExtent = Super.getExtent;
    pub const setStorage = Super.setStorage;
    pub const initialize = Super.initialize;
    pub const finalize = Super.finalize;
    pub const externalize = Super.externalize;
    pub const checkArguments = Super.checkArguments;
    pub const getValue = Super.getValue;
    pub const setValue = Super.setValue;
    pub const getProperty = Super.getProperty;
    pub const setProperty = Super.setProperty;
    pub const visitPointers = Super.visitPointers;
    pub const freeObject = Super.freeObject;
    pub const castObject = Super.castObject;
    pub const getMethod = Super.getMethod;
    pub const readProperty = Super.readProperty;
    pub const writeProperty = Super.writeProperty;
    pub const hasProperty = Super.hasProperty;
    pub const getProperties = Super.getProperties;
    pub const getPropertyPointer = Super.getPropertyPointer;
    pub const getGarbageCollection = Super.getGarbageCollection;
};
