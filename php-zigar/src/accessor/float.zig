const std = @import("std");

const accessor = @import("../accessor.zig");
const Primitive = accessor.Primitive;
const Error = accessor.Error;
const byte_buffer = @import("../byte-buffer.zig");
const ByteBuffer = byte_buffer.ByteBuffer;
const php = @import("../php.zig");
const Value = php.Value;

pub const Attributes = struct {
    bit_offset: ?u3,
    bit_size: usize,

    pub fn Type(self: @This()) type {
        return @Type(.{
            .float = .{ .bits = self.bit_size },
        });
    }
};

pub fn get(comptime attrs: Attributes) Primitive {
    const T = attrs.Type();
    _ = T;
    const ns = struct {
        fn get(self: *const Primitive, buffer: *ByteBuffer) Error!Value {
            _ = self;
            _ = buffer;
            unreachable;
        }

        fn set(self: *const Primitive, buffer: *ByteBuffer, value: *Value) Error!void {
            _ = self;
            _ = buffer;
            _ = value;
            unreachable;
        }
    };
    return .{ .getter = &ns.get, .setter = &ns.set };
}
