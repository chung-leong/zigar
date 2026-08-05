const std = @import("std");

pub const Vector4 = @Vector(4, i32);

pub fn hello(text: []const u8, vector: *Vector4) void {
    std.debug.print("{any}\n", .{text});
    std.debug.print("{any}\n", .{vector.*});
}

pub fn world(vector: *Vector4, text: []const u8) void {
    std.debug.print("{any}\n", .{text});
    std.debug.print("{any}\n", .{vector.*});
}
