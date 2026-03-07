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
    bytes: *ByteBuffer = undefined,
    slots: Value = undefined,

    const Super = structure.Parent(@This());
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
        return switch (transform) {
            .to_value => self.returnSelf(),
            .to_plain => create: {
                var iter = class.getMemberIterator(.instance);
                const ht = php.createArray();
                while (iter.next()) |member| {
                    const name = iter.currentName() orelse return error.Unexpected;
                    var value = try member.accessors.get(self);
                    try transform.apply(&value);
                    php.setHashEntry(ht, name, &value);
                }
                var value = php.createValueArray(ht);
                try php.convertValue(&value, .object);
                break :create value;
            },
            .to_integer => get: {
                // TODO: handle packed struct
                break :get error.Unsupported;
            },
            .to_string => error.Unsupported,
        };
    }

    pub const setStorage = Super.setStorage;
    pub const getExtent = Super.getExtent;
    pub const writeSelf = Super.writeContainer;
    pub const freeObject = Super.freeObject;
    pub const castObject = Super.castObject;
    pub const readProperty = Super.readContainerProperty;
    pub const writeProperty = Super.writeContainerProperty;
    pub const getProperties = Super.getContainerProperties;
    pub const getPropertyPointer = Super.getPropertyPointer;
    pub const getReferencedObjects = Super.getReferencedObjects;
    const fromObject = Super.fromObject;
    const returnSelf = Super.returnSelf;
    const readMember = Super.readMember;
    const writeMember = Super.writeMember;
    const throwFieldError = Super.throwFieldError;
};
