const std = @import("std");

const accessor = @import("../accessor.zig");
const Error = accessor.Error;
const ObjectTransform = accessor.ObjectTransform;
const ByteBuffer = @import("../buffer.zig").ByteBuffer;
const ZigClassEntry = @import("../class-entry.zig").ZigClassEntry;
const Closure = @import("../closure.zig").Closure;
const ZigObject = @import("../object.zig").ZigObject;
const php = @import("../php.zig");
const ArgumentIterator = php.ArgumentIterator;
const HashTable = php.HashTable;
const HashTableIterator = php.HashTableIterator;
const Object = php.Object;
const String = php.String;
const Value = php.Value;
const Promise = @import("../promise.zig").Promise;
const structure = @import("../structure.zig");

pub const Struct = struct {
    table: Value = undefined,
    buffer: *ByteBuffer = undefined,

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

    pub fn getOpaquePointer(self: *@This(), comptime T: type, name: *String) !*T {
        const value = try self.readMember(name, null);
        const obj = try php.getValueObject(&value);
        const class = ZigClassEntry.fromObject(obj);
        if (class.type != .slice or !class.flags.slice.is_opaque) {
            return error.NotOpaque;
        }
        const opaque_struct = ZigObject(structure.Slice).fromObject(obj).structure();
        return @ptrCast(@alignCast(opaque_struct.buffer.bytes.ptr));
    }

    pub const setStorage = Super.setStorage;
    pub const writeSelf = Super.writeSelf;
    pub const getExtent = Super.getExtent;
    pub const readMember = Super.readMember;
    pub const writeMember = Super.writeMember;
    pub const freeObject = Super.freeObject;
    pub const castObject = Super.castObject;
    pub const readProperty = Super.readProperty;
    pub const writeProperty = Super.writeProperty;
    pub const hasProperty = Super.hasProperty;
    pub const getProperties = Super.getProperties;
    pub const getPropertyPointer = Super.getPropertyPointer;
    pub const getReferencedObjects = Super.getReferencedObjects;
    const fromObject = Super.fromObject;
};
