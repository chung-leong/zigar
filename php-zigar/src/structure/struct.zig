const std = @import("std");

const accessor = @import("../accessor.zig");
const Error = accessor.Error;
const ObjectTransform = accessor.ObjectTransform;
const ByteBuffer = @import("../buffer.zig").ByteBuffer;
const ZigClassEntry = @import("../class-entry.zig").ZigClassEntry;
const php = @import("../php.zig");
const HashTable = php.HashTable;
const HashTableIterator = php.HashTableIterator;
const Object = php.Object;
const Value = php.Value;
const structure = @import("../structure.zig");

pub const Struct = struct {
    slots: Value = undefined,
    bytes: *ByteBuffer = undefined,

    const Super = structure.StructLike(@This());

    pub const Static = struct {
        required_field_count: usize = 0,
        class_obj: *Object = undefined,

        pub fn init(self: *@This(), class_obj: *Object) !void {
            const class = ZigClassEntry.fromObject(class_obj);
            var iter = class.getMemberIterator(.instance);
            while (iter.next()) |member| {
                if (member.flags.is_required) self.required_field_count += 1;
            }
            // because methods are really static functions, we need to maintain a ref on the class object
            self.class_obj = class_obj;
            php.addRef(self.class_obj);
        }

        pub fn deinit(self: *@This()) void {
            php.release(self.class_obj);
        }
    };
    pub const constructor_args = "an array as argument or named arguments";

    pub fn copyArguments(self: *@This(), arg_iter: *php.ArgumentIterator) !void {
        if (arg_iter.len == 0) {
            // check if the struct has default values for all fields
            const class = ZigClassEntry.fromStructure(self);
            const static = class.getStaticData(@This());
            if (static.required_field_count == 0) return;
            // let the parent implementation throw an exception
        }
        return try Super.copyArguments(self, arg_iter);
    }

    pub fn readSelf(self: *@This(), transform: ObjectTransform) !Value {
        const class = ZigClassEntry.fromStructure(self);
        if (transform == .to_integer) {
            const flags = class.getFlags(@This());
            if (flags.is_packed) {
                // TODO: handle packed struct
                @panic("TODO");
            }
        }
        return Super.readSelf(self, transform);
    }

    pub fn writeSelf(self: *@This(), value: *const Value) !void {
        const class = ZigClassEntry.fromStructure(self);
        switch (class.purpose) {
            .allocator => {
                const allocator = php.getValuePointer(*std.mem.Allocator, value) catch unreachable;
                try self.bytes.copyBytes(std.mem.asBytes(allocator));
                return;
            },
            else => try Super.writeSelf(self, value),
        }
    }

    pub const setStorage = Super.setStorage;
    pub const getExtent = Super.getExtent;
    pub const freeObject = Super.freeObject;
    pub const castObject = Super.castObject;
    pub const readProperty = Super.readProperty;
    pub const writeProperty = Super.writeProperty;
    pub const hasProperty = Super.hasProperty;
    pub const getProperties = Super.getProperties;
    pub const getPropertyPointer = Super.getPropertyPointer;
    pub const getReferencedObjects = Super.getReferencedObjects;
    const fromObject = Super.fromObject;
    const readContainer = Super.readContainer;
};
