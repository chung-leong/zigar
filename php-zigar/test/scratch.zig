const std = @import("std");

pub const Struct = struct {
    number1: i32,
    number2: i32,
};

pub fn print(ptr: *const Struct) void {
    std.debug.print("{}\n", .{ptr.*});
}
