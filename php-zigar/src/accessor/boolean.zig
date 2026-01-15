const std = @import("std");

const accessor = @import("../accessor.zig");
const Primitive = accessor.Primitive;
const Error = accessor.Error;
const php = @import("../php.zig");
const Value = php.Value;

pub const Attributes = struct {
    bit_offset: ?u3,
};

pub fn get(comptime attrs: Attributes) Primitive {
    const T = bool;
    _ = T;
    _ = attrs;
    const ns = struct {
        fn get(self: *const Primitive, bytes: []u8) Error!Value {
            _ = self;
            _ = bytes;
            unreachable;
        }

        fn set(self: *const Primitive, bytes: []u8, value: *Value) Error!void {
            _ = self;
            _ = bytes;
            _ = value;
            unreachable;
        }
    };
    return .{ .get = &ns.get, .set = &ns.set };
}
