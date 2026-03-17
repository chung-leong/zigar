const std = @import("std");

const accessor = @import("../accessor.zig");
const ObjectTransform = accessor.ObjectTransform;
const ByteBuffer = @import("../buffer.zig").ByteBuffer;
const ZigClassEntry = @import("../class-entry.zig").ZigClassEntry;
const php = @import("../php.zig");
const Object = php.Object;
const Value = php.Value;
const structure = @import("../structure.zig");

pub const Opaque = struct {
    bytes: *ByteBuffer = undefined,

    const Super = structure.Parent(@This());

    pub const Static = struct {
        class_obj: *Object = undefined,

        pub fn init(self: *@This(), class_obj: *Object) !void {
            // because methods are really static functions, we need to maintain a ref on the class object
            self.class_obj = class_obj;
            php.addRef(self.class_obj);
        }

        pub fn deinit(self: *@This()) void {
            php.release(self.class_obj);
        }
    };

    pub fn readSelf(self: *@This(), transform: ObjectTransform) !Value {
        if (transform == .to_bytes) return try self.returnBytes();
        return self.throwException();
    }

    pub fn writeSelf(self: *@This(), value: *const Value) !void {
        _ = value;
        return self.throwException();
    }

    fn throwException(self: *@This()) error{ExceptionThrown} {
        const class = ZigClassEntry.fromStructure(self);
        return php.throwExceptionFmt("cannot access opaque structure '{s}' (zig)", .{
            class.getName(),
        });
    }

    pub const setStorage = Super.setStorage;
    pub const getExtent = Super.getExtent;
    pub const copyArguments = Super.copyArguments;
    pub const freeObject = Super.freeObject;
    pub const castObject = Super.castObject;
    pub const readProperty = Super.readProperty;
    pub const writeProperty = Super.writeProperty;
    pub const getReferencedObjects = Super.getReferencedObjects;
    const returnBytes = Super.returnBytes;
};
