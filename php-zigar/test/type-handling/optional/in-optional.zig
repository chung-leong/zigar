const std = @import("std");

pub var optional: ??i32 = 3000;

pub fn print() void {
    std.debug.print("{any}\n", .{optional});
}
