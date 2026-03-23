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
const Value = php.Value;
const Promise = @import("../promise.zig").Promise;
const structure = @import("../structure.zig");

pub const Struct = struct {
    slots: Value = undefined,
    bytes: *ByteBuffer = undefined,

    const Super = structure.StructLike(@This());

    pub const Static = struct {
        required_field_count: usize = 0,
        class_obj: *Object = undefined,
        callback: ?*Object = null,

        pub fn init(self: *@This(), class_obj: *Object) !void {
            const class = ZigClassEntry.fromObject(class_obj);
            var iter = class.getMemberIterator(.instance);
            while (iter.next()) |member| {
                if (member.flags.is_required) self.required_field_count += 1;
            }
            // because methods are really static functions, we need to maintain a ref on the class object
            self.class_obj = class_obj;
            php.addRef(self.class_obj);
            switch (class.purpose) {
                .promise => {
                    const closure = Promise.getHandler();
                    const ptr_member = try class.getMember(.instance, "ptr");
                    const ptr_class = ptr_member.class orelse return error.Unexpected;
                    if (ptr_class.type != .optional) return error.Unexpected;
                    const cb_member = try class.getMember(.instance, "callback");
                    const cb_class = cb_member.class orelse return error.Unexpected;
                    if (cb_class.type != .pointer) return error.Unexpected;
                    const cb_obj = try cb_class.obtainNewObject();
                    const cb_struct = ZigObject(structure.Pointer).fromObject(cb_obj).structure();
                    try cb_struct.writeSelf(&closure);
                    self.callback = cb_obj;
                },
                else => {},
            }
        }

        pub fn deinit(self: *@This()) void {
            php.release(self.class_obj);
            if (self.callback) |cb| php.release(cb);
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
        if (php.getType(value) == .pointer) {
            const class = ZigClassEntry.fromStructure(self);
            switch (class.purpose) {
                .allocator => {
                    const allocator = try php.getValuePointer(*std.mem.Allocator, value);
                    try self.bytes.copyBytes(std.mem.asBytes(allocator));
                    return;
                },
                .promise => {
                    const static = class.getStaticData(@This());
                    try Super.writeMember(self, php.persistent("ptr"), value, null);
                    var cb_value = php.createValueObject(static.callback.?);
                    try Super.writeMember(self, php.persistent("callback"), &cb_value, null);
                    return;
                },
                else => {},
            }
        }
        return try Super.writeSelf(self, value);
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
};
