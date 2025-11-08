const std = @import("std");

pub const Int32 = i32;

pub fn printI32(count: usize, ...) callconv(.c) void {
    var va_list = @cVaStart();
    defer @cVaEnd(&va_list);
    for (0..count) |_| {
        const number = @cVaArg(&va_list, i32);
        std.debug.print("{d}\n", .{number});
    }
}

pub fn call(f: *const fn (usize, ...) callconv(.c) void) void {
    f(3, @as(i32, 123), @as(i32, 456), @as(i32, 789));
}
