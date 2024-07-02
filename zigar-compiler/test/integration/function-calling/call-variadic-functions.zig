const std = @import("std");

pub const Int8 = i8;
pub const Int16 = i16;
pub const Int32 = i32;
pub const Int64 = i64;
pub const Int128 = i128;
pub const Float16 = f16;
pub const Float32 = f32;
pub const Float64 = f64;
pub const Float80 = f80;
pub const Float128 = f128;
pub const StrPtr = [*:0]const u8;

pub fn printIntegers(bits: u8, count: usize, ...) callconv(.C) void {
    var va_list = @cVaStart();
    defer @cVaEnd(&va_list);
    for (0..count) |_| {
        inline for (.{ i8, i16, i32, i64, i128 }) |T| {
            if (bits == @typeInfo(T).Int.bits) {
                const number = @cVaArg(&va_list, T);
                std.debug.print("{d}\n", .{number});
            }
        }
    }
}

pub fn printFloats(bits: u8, count: usize, ...) callconv(.C) void {
    var va_list = @cVaStart();
    defer @cVaEnd(&va_list);
    for (0..count) |_| {
        inline for (.{ f16, f32, f64, f80, f128 }) |T| {
            if (bits == @typeInfo(T).Float.bits) {
                const number = @cVaArg(&va_list, T);
                if (bits <= 64) {
                    std.debug.print("{d}\n", .{number});
                } else {
                    std.debug.print("{d}\n", .{@as(f64, @floatCast(number))});
                }
            }
        }
    }
}

pub fn printStrings(count: usize, ...) callconv(.C) void {
    var va_list = @cVaStart();
    defer @cVaEnd(&va_list);
    for (0..count) |_| {
        const str = @cVaArg(&va_list, [*:0]const u8);
        std.debug.print("{s}\n", .{str});
    }
}
