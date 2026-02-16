const std = @import("std");
const builtin = @import("builtin");

const accessor = @import("../accessor.zig");
const Error = accessor.Error;
const ByteBuffer = @import("../buffer.zig").ByteBuffer;
const php = @import("../php.zig");
const Value = php.Value;
var gmp_import: Value = php.empty_value;
var gmp_export: Value = php.empty_value;
var gmp_neg: Value = php.empty_value;
var gmp_sign: Value = php.empty_value;

pub const Attributes = struct {
    signedness: std.builtin.Signedness,
    bit_offset: ?u3,

    pub fn Type(self: @This()) type {
        return @Type(.{
            .int = .{ .bits = self.bit_size, .signedness = self.signedness },
        });
    }
};

pub fn get(comptime attrs: Attributes, params: accessor.Primitive.Parameters) accessor.Primitive {
    const ns = struct {
        pub fn get(acc: *const accessor.Primitive, buffer: *ByteBuffer) Error!Value {
            const be = builtin.target.cpu.arch.endian() == .big;
            const bytes: []u8 = buffer.bytes;
            const extra = if (attrs.bit_offset != null and attrs.bit_offset != 0) 1 else 0;
            const byte_count = (acc.params.bit_size + 7) / 8;
            const str = php.createStringWithLength(byte_count);
            defer php.release(str);
            const dest = @constCast(php.getStringContent(str));
            if (acc.params.byte_offset + byte_count + extra > bytes.len) return error.OutOfBound;
            var offset = acc.params.byte_offset + if (be) 0 else byte_count - 1;
            var dest_offset: usize = 0;
            var negate = false;
            // read the most significant byte first
            const msb_bits = acc.params.bit_size - (byte_count - 1) * 8;
            inline for (.{ 1, 2, 3, 4, 5, 6, 7, 8 }) |bits| {
                if (msb_bits == bits) {
                    const T = @Type(.{ .int = .{ .bits = bits, .signedness = attrs.signedness } });
                    const AT = accessor.WithBitOffset(T, attrs.bit_offset);
                    const ptr: *align(1) AT = @ptrCast(&bytes[offset]);
                    const int = if (comptime AT == T) ptr.* else ptr.value;
                    if (attrs.signedness == .signed and int < 0) {
                        dest[dest_offset] = @intCast(@as(T, -1) ^ int);
                        negate = true;
                    } else {
                        dest[dest_offset] = @intCast(int);
                    }
                    break;
                }
            }
            if (attrs.signedness == .signed) {
                const mask: u8 = if (negate) 0xff else 0;
                while (dest_offset < byte_count - 1) {
                    if (be) offset += 1 else offset -= 1;
                    dest_offset += 1;
                    const U = accessor.WithBitOffset(u8, attrs.bit_offset);
                    const ptr: *align(1) U = @ptrCast(&bytes[offset]);
                    const int = if (comptime U == u8) ptr.* else ptr.value;
                    dest[dest_offset] = mask ^ int;
                }
                if (negate) {
                    // need to add one
                    while (true) {
                        dest[dest_offset] +%= 1;
                        if (dest[dest_offset] != 0) break;
                        if (dest_offset == 0) break;
                        // keep carry to next digit
                        dest_offset -= 1;
                    }
                }
            }
            const str_value = php.createValueString(str);
            if (php.getType(&gmp_import) != .string) {
                const name = php.createPersistentString("gmp_import");
                gmp_import = php.createValueString(name);
            }
            var value = try php.invokeFunction(&gmp_import, &.{str_value});
            if (attrs.signedness == .signed and negate) {
                if (php.getType(&gmp_neg) != .string) {
                    const name = php.createPersistentString("gmp_neg");
                    gmp_neg = php.createValueString(name);
                }
                const pos_value = value;
                value = try php.invokeFunction(&gmp_neg, &.{pos_value});
                php.release(&pos_value);
            }
            return if (acc.params.transform) |t| try t.toValue(&value) else value;
        }

        pub fn set(acc: *const accessor.Primitive, buffer: *ByteBuffer, value: *const Value) Error!void {
            _ = acc;
            _ = buffer;
            _ = value;
        }
    };
    return .{ .getter = &ns.get, .setter = &ns.set, .params = params };
}
