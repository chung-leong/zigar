const std = @import("std");

const accessor = @import("../accessor.zig");
const Error = accessor.Error;
const byte_buffer = @import("../byte-buffer.zig");
const ByteBuffer = byte_buffer.ByteBuffer;
const php = @import("../php.zig");
const Value = php.Value;

pub const Attributes = struct {};

pub fn get(comptime _: Attributes, params: accessor.Null.Parameters) accessor.Null {
    const ns = struct {
        pub fn get(_: *const accessor.Null) Error!Value {
            return php.createValueNull();
        }

        pub fn set(_: *const accessor.Null, value: *Value) Error!void {
            try php.getValueNull(value);
        }
    };
    return .{ .getter = &ns.get, .setter = &ns.set, .params = params };
}
