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

    pub const Super = structure.StructLike(@This());

    pub fn compare(a: *Value, b: *Value) !c_int {
        const obj_a = php.getValueObject(a) catch return -1;
        const obj_b = php.getValueObject(b) catch return 1;
        if (obj_a == obj_b) return 0;
        if (obj_a.ce != obj_b.ce) {
            return if (@intFromPtr(obj_a.ce) < @intFromPtr(obj_b.ce)) -1 else 1;
        }
        const struct_a = fromObject(obj_a);
        const struct_b = fromObject(obj_b);
        const address_a = @intFromPtr(struct_a.buffer.bytes.ptr);
        const address_b = @intFromPtr(struct_b.buffer.bytes.ptr);
        return if (address_a == address_b) 0 else if (address_a < address_b) -1 else 1;
    }

    fn throwException(self: *@This()) error{Unexpected} {
        const class = ZigClassEntry.fromStructure(self);
        return failure.report("cannot access opaque structure '{s}'", .{
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
    pub const propertyExists = Super.propertyExists;
    pub const visitPointers = Super.visitPointers;
    pub const getConstructor = Super.getConstructor;
    pub const freeObject = Super.freeObject;
    pub const castObject = Super.castObject;
    pub const getMethod = Super.getMethod;
    pub const readProperty = Super.readProperty;
    pub const writeProperty = Super.writeProperty;
    pub const hasProperty = Super.hasProperty;
    pub const getProperties = Super.getProperties;
    pub const getPropertyPointer = Super.getPropertyPointer;
    pub const getGarbageCollection = Super.getGarbageCollection;
    pub const getIterator = Super.getIterator;
    const fromObject = Super.fromObject;
};
