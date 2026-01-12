const std = @import("std");

const byte_buffer = @import("../byte-buffer.zig");
const ByteBuffer = byte_buffer.ByteBuffer;
const php = @import("../php.zig");
const Value = php.Value;
const Object = php.Object;
const String = php.String;
const HashTable = php.HashTable;
const zig_class_entry = @import("../zig-class.zig");
const ZigClass = zig_class_entry.ZigClass;

pub const Opaque = struct {
    bytes: *ByteBuffer = undefined,

    fn readProperty(obj: *Object, name: *String, prop_type: c_int, cache_slot: *?*anyopaque, retval: *Value) !*Value {
        _ = obj;
        _ = name;
        _ = prop_type;
        _ = cache_slot;
        retval.* = php.createValueLong(1234);
        return retval;
    }
};
