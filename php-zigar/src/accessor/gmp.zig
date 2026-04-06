const std = @import("std");
const builtin = @import("builtin");

const accessor = @import("../accessor.zig");
const Error = accessor.Error;
const ByteBuffer = @import("../buffer.zig").ByteBuffer;
const php = @import("../php.zig");
const String = php.String;
const Value = php.Value;
var gmp_import: Value = php.empty_value;
var gmp_export: Value = php.empty_value;
var gmp_init: Value = php.empty_value;
var gmp_neg: Value = php.empty_value;
var gmp_sign: Value = php.empty_value;

const Attributes = struct {
    signedness: std.builtin.Signedness,
    bit_offset: ?u3 = null,

    pub fn Type(self: @This()) type {
        return @Type(.{
            .int = .{ .bits = self.bit_size, .signedness = self.signedness },
        });
    }
};

pub fn Gmp(comptime attrs: Attributes) type {
    const be = comptime builtin.target.cpu.arch.endian() == .big;
    const extra = if (attrs.bit_offset != null and attrs.bit_offset != 0) 1 else 0;
    return struct {
        byte_offset: usize,
        bit_size: usize = 0,
        comptime type: accessor.Type = .gmp,
        comptime attributes: Attributes = attrs,

        pub fn get(self: @This(), buffer: *ByteBuffer) Error!Value {
            const byte_count = (self.bit_size + 7) / 8;
            const bytes = try buffer.data(self.byte_offset + byte_count + extra, false);
            const str = php.createStringWithLength(byte_count);
            defer php.release(str);
            const dst = @constCast(php.getStringContent(str));
            var offset = self.byte_offset + if (be) 0 else byte_count - 1;
            var dst_offset: usize = 0;
            var negate = false;
            // read the most significant byte first
            const msb_bits = self.bit_size - (byte_count - 1) * 8;
            inline for (.{ 1, 2, 3, 4, 5, 6, 7, 8 }) |bits| {
                if (msb_bits == bits) {
                    const T = @Type(.{ .int = .{ .bits = bits, .signedness = attrs.signedness } });
                    const AT = accessor.WithBitOffset(T, attrs.bit_offset);
                    const ptr: *align(1) AT = @ptrCast(&bytes[offset]);
                    var int = if (comptime AT == T) ptr.* else ptr.value;
                    if (attrs.signedness == .signed and int < 0) {
                        int = int ^ -1;
                        negate = true;
                    }
                    dst[dst_offset] = @intCast(int);
                    break;
                }
            }
            const mask: u8 = if (negate) 0xff else 0;
            while (dst_offset < byte_count - 1) {
                if (be) offset += 1 else offset -= 1;
                dst_offset += 1;
                const U = accessor.WithBitOffset(u8, attrs.bit_offset);
                const ptr: *align(1) U = @ptrCast(&bytes[offset]);
                const int = if (comptime U == u8) ptr.* else ptr.value;
                dst[dst_offset] = int ^ mask;
            }
            if (attrs.signedness == .signed and negate) {
                // need to add one
                while (true) {
                    dst[dst_offset] +%= 1;
                    if (dst[dst_offset] != 0 or dst_offset == 0) break;
                    // apply carry to previous byte
                    dst_offset -= 1;
                }
            }
            return try gmpFromString(str, negate);
        }

        pub fn set(self: @This(), buffer: *ByteBuffer, value: *const Value) Error!void {
            const byte_count = (self.bit_size + 7) / 8;
            const bytes = try buffer.data(self.byte_offset + byte_count + extra, true);
            const str, const negate = try stringFromGmp(value);
            defer php.release(str);
            const src = php.getStringContent(str);
            if (src.len > byte_count) return error.IntegerOverflow;
            const blk_offset = byte_count - src.len;
            var offset = self.byte_offset + if (be) 0 else byte_count - 1;
            var src_offset: usize = 0;
            // write the most significant byte
            const msb_bits = self.bit_size - (byte_count - 1) * 8;
            inline for (.{ 1, 2, 3, 4, 5, 6, 7, 8 }) |bits| {
                if (msb_bits == bits) {
                    const T = @Type(.{ .int = .{ .bits = bits, .signedness = attrs.signedness } });
                    const AT = accessor.WithBitOffset(T, attrs.bit_offset);
                    const ptr: *align(1) AT = @ptrCast(&bytes[offset]);
                    const byte = if (src_offset >= blk_offset) src[src_offset - blk_offset] else 0;
                    if (byte > std.math.maxInt(T)) return error.IntegerOverflow;
                    var int: T = @intCast(byte);
                    if (attrs.signedness == .signed and negate) int = int ^ -1;
                    if (comptime AT == T) ptr.* = int else ptr.value = int;
                    break;
                }
            }
            const mask: u8 = if (negate) 0xff else 0;
            while (src_offset < byte_count - 1) {
                if (be) offset += 1 else offset -= 1;
                src_offset += 1;
                const U = accessor.WithBitOffset(u8, attrs.bit_offset);
                const ptr: *align(1) U = @ptrCast(&bytes[offset]);
                const byte = if (src_offset >= blk_offset) src[src_offset - blk_offset] else 0;
                const int = byte ^ mask;
                if (comptime U == u8) ptr.* = int else ptr.value = int;
            }
            if (attrs.signedness == .signed and negate) {
                // need to shift value by one
                const last = self.byte_offset + if (be) byte_count - 1 else 0;
                while (true) {
                    bytes[offset] +%= 1;
                    if (bytes[offset] != 0 or offset == last) break;
                    // need to borrow from previous byte
                    if (be) offset += 1 else offset -= 1;
                }
            }
        }

        fn gmpFromString(str: *String, negate: bool) !Value {
            const str_value = php.createValueString(str);
            if (php.getType(&gmp_import) != .string) {
                const name = php.createPersistentString("gmp_import");
                gmp_import = php.createValueString(name);
            }
            if (attrs.signedness == .signed and negate) {
                const pos_value = try php.invokeFunction(&gmp_import, &.{str_value});
                defer php.release(&pos_value);
                if (php.getType(&gmp_neg) != .string) {
                    const name = php.createPersistentString("gmp_neg");
                    gmp_neg = php.createValueString(name);
                }
                return try php.invokeFunction(&gmp_neg, &.{pos_value});
            } else {
                return try php.invokeFunction(&gmp_import, &.{str_value});
            }
        }

        fn stringFromGmp(value: *const Value) !std.meta.Tuple(&.{ *String, bool }) {
            const gmp_value = switch (php.getType(value)) {
                .object => use: {
                    php.addRef(@constCast(value));
                    break :use value.*;
                },
                else => convert: {
                    if (php.getType(&gmp_init) != .string) {
                        const name = php.createPersistentString("gmp_init");
                        gmp_init = php.createValueString(name);
                    }
                    const not_gmp = switch (php.isNull(value)) {
                        false => value.*,
                        true => php.createValueLong(0),
                    };
                    break :convert try php.invokeFunction(&gmp_init, &.{not_gmp});
                },
            };
            defer php.release(&gmp_value);
            if (php.getType(&gmp_sign) != .string) {
                const name = php.createPersistentString("gmp_sign");
                gmp_sign = php.createValueString(name);
            }
            const sign_value = try php.invokeFunction(&gmp_sign, &.{value.*});
            const sign = try php.getValueLong(&sign_value);
            if (php.getType(&gmp_export) != .string) {
                const name = php.createPersistentString("gmp_export");
                gmp_export = php.createValueString(name);
            }
            const str_value = try php.invokeFunction(&gmp_export, &.{gmp_value});
            return .{ try php.getValueString(&str_value), sign < 0 };
        }
    };
}
