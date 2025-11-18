const std = @import("std");

pub const Uint8 = u8;
pub const Uint16 = u16;
pub const Uint32 = u32;
pub const Uint64 = u64;
pub const Uint128 = u128;

pub fn printUnsigned(bits: u8, count: usize, ...) callconv(.c) void {
    var va_list = @cVaStart();
    for (0..count) |_| {
        inline for (.{ u8, u16, u32, u64, u128 }) |T| {
            if (bits == @bitSizeOf(T)) {
                const number = @cVaArg(&va_list, T);
                std.debug.print("{d}\n", .{number});
            }
        }
    }
    @cVaEnd(&va_list);
}
