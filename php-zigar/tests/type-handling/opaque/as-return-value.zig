const std = @import("std");

const Struct = struct {
    number1: i32,
    number2: i32,
};

pub fn create(allocator: std.mem.Allocator, a: i32, b: i32) !*anyopaque {
    const s = try allocator.create(Struct);
    s.number1 = a;
    s.number2 = b;
    return @ptrCast(s);
}

pub fn print(ptr: *anyopaque) void {
    const struct_ptr: *Struct = @ptrCast(@alignCast(ptr));
    std.debug.print("{any}\n", .{struct_ptr.*});
}
