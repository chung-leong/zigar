const std = @import("std");

const accessor = @import("../accessor.zig");
const Error = accessor.Error;
const ByteBuffer = @import("../buffer.zig").ByteBuffer;
const php = @import("../php.zig");
const Value = php.Value;

pub const Attributes = struct {
    bit_offset: ?u3,
};

pub fn get(comptime attrs: Attributes, params: accessor.Primitive.Parameters) accessor.Primitive {
    const T = bool;
    // use a packed struct to access the boolean when there's a bit offset
    const AT = accessor.WithBitOffset(T, attrs.bit_offset);
    const ns = struct {
        pub fn get(acc: *const accessor.Primitive, buffer: *ByteBuffer) Error!Value {
            const bytes: []u8 = buffer.bytes;
            if (acc.params.byte_offset + @sizeOf(AT) > bytes.len) return error.OutOfBound;
            const ptr: *align(1) AT = @ptrCast(&bytes[acc.params.byte_offset]);
            const boolean = if (comptime AT == T) ptr.* else ptr.value;
            return php.createValueBool(boolean);
        }

        pub fn set(acc: *const accessor.Primitive, buffer: *ByteBuffer, value: *const Value) Error!void {
            const bytes: []u8 = buffer.bytes;
            if (buffer.is_read_only) return error.WriteProtected;
            if (acc.params.byte_offset + @sizeOf(AT) > bytes.len) return error.OutOfBound;
            const ptr: *align(1) AT = @ptrCast(&bytes[acc.params.byte_offset]);
            const boolean = try php.getValueBool(value);
            if (comptime AT == T) ptr.* = boolean else ptr.value = boolean;
        }

        pub fn stringify(acc: *const accessor.Primitive, buffer: *ByteBuffer) Error!Value {
            const bytes: []u8 = buffer.bytes;
            if (acc.params.byte_offset + @sizeOf(AT) > bytes.len) return error.OutOfBound;
            const ptr: *align(1) AT = @ptrCast(&bytes[acc.params.byte_offset]);
            const boolean = if (comptime AT == T) ptr.* else ptr.value;
            var buf: [64]u8 = undefined;
            const str = std.fmt.bufPrint(&buf, "{}", .{boolean}) catch unreachable;
            return php.createValueStringContent(str);
        }
    };
    return .{ .getter = &ns.get, .setter = &ns.set, .stringifier = &ns.stringify, .params = params };
}
