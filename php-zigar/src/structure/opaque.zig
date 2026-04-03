const std = @import("std");

const accessor = @import("../accessor.zig");
const ObjectTransform = accessor.ObjectTransform;
const ByteBuffer = @import("../buffer.zig").ByteBuffer;
const ZigClassEntry = @import("../class-entry.zig").ZigClassEntry;
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

    const Super = structure.Parent(@This());

    pub const Static = struct {
        getter_names: []*String = &.{},
        class_obj: *Object = undefined,

        pub fn init(self: *@This(), class_obj: *Object) !void {
            // because methods are really static functions, we need to maintain a ref on the class object
            self.class_obj = class_obj;
            php.addRef(self.class_obj);
        }

        pub fn deinit(self: *@This()) void {
            php.release(self.class_obj);
            php.allocator.free(self.getter_names);
        }
    };

    pub fn getValue(self: *@This(), transform: ObjectTransform) !Value {
        if (transform == .to_bytes) return try self.returnBytes();
        return self.throwException();
    }

    pub fn setValue(self: *@This(), value: *const Value) !void {
        _ = value;
        return self.throwException();
    }

    pub fn handleGetIterator(ce: *ClassEntry, this: *Value, _: c_int) !?*ObjectIterator {
        const obj = try php.getValueObject(this);
        const class = ZigClassEntry.fromEntry(ce);
        const static = class.getStaticData(@This());
        return try iterator.PropertyIterator(@This()).create(obj, &.{}, static.getter_names);
    }

    fn throwException(self: *@This()) error{ExceptionThrown} {
        const class = ZigClassEntry.fromStructure(self);
        return php.throwExceptionFmt("cannot access opaque structure '{s}' (zig)", .{
            class.getName(),
        });
    }

    pub const getExtent = Super.getExtent;
    pub const setStorage = Super.setStorage;
    pub const initialize = Super.initialize;
    pub const finalize = Super.finalize;
    pub const externalize = Super.externalize;
    pub const checkArguments = Super.checkArguments;
    pub const getProperty = Super.getProperty;
    pub const setProperty = Super.setProperty;
    pub const visitPointers = Super.visitPointers;
    pub const freeObject = Super.freeObject;
    pub const castObject = Super.castObject;
    pub const getMethod = Super.getMethod;
    pub const readProperty = Super.readProperty;
    pub const writeProperty = Super.writeProperty;
    pub const getReferencedObjects = Super.getReferencedObjects;
    const returnBytes = Super.returnBytes;
};
