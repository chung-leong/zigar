const std = @import("std");

const byte_buffer = @import("../byte-buffer.zig");
const ByteBuffer = byte_buffer.ByteBuffer;
const php = @import("../php.zig");
const Value = php.Value;
const Object = php.Object;
const String = php.String;
const HashTable = php.HashTable;
const zig_class = @import("../zig-class.zig");
const ZigClass = zig_class.ZigClass;
const zig_object = @import("../zig-object.zig");
const ZigObject = zig_object.ZigObject;

pub fn All(comptime S: type) type {
    return struct {
        pub fn setStorage(self: *S, bytes: *ByteBuffer, slots: ?*HashTable) !void {
            if (@hasField(S, "bytes")) self.bytes = bytes;
            if (@hasField(S, "slots")) self.slots = slots;
        }

        pub fn getValue(self: *S) !Value {
            // by default just return the object itself
            const obj = &ZigObject(S).fromStructure(self).php_portion;
            return php.createValueObject(obj);
        }

        pub fn freeObject(obj: *Object) void {
            const self = &ZigObject(S).fromObject(obj).zig_portion;
            const class = ZigClass.fromObject(obj);
            if (@hasField(S, "bytes")) self.bytes.release();
            if (@hasField(S, "slots")) if (self.slots) |ht| php.release(ht);
            class.release();
        }

        pub fn readProperty(obj: *Object, name: *String, prop_type: c_int, cache_slot: *?*anyopaque, retval: *Value) !*Value {
            _ = prop_type;
            _ = cache_slot;
            const name_s = php.getStringContent(name);
            std.debug.print("name = {s}\n", .{name_s});
            var value: Value = undefined;
            if (name_s.len == 1 and name_s[0] == '$') {
                const self = &ZigObject(S).fromObject(obj).zig_portion;
                value = try self.getValue();
            } else {
                value = php.createValueNull();
            }
            retval.* = value;
            php.addRef(retval);
            return retval;
        }

        pub fn fromObject(obj: *Object) *S {
            return &ZigObject(S).fromObject(obj).zig_portion;
        }
    };
}
