const std = @import("std");

const accessor = @import("../accessor.zig");
const Error = accessor.Error;
const ByteBuffer = @import("../buffer.zig").ByteBuffer;
const php = @import("../php.zig");
const Value = php.Value;

pub const Attributes = struct {};

pub fn get(comptime _: Attributes, params: accessor.Primitive.Parameters) accessor.Primitive {
    const ns = struct {
        pub fn get(_: *const accessor.Primitive, _: *ByteBuffer) Error!Value {
            return php.createValueNull();
        }

        pub fn set(_: *const accessor.Primitive, buffer: *ByteBuffer, value: *const Value) Error!void {
            _ = try buffer.data(0, true);
            try php.getValueNull(value);
        }
    };
    return .{ .getter = &ns.get, .setter = &ns.set, .params = params };
}
