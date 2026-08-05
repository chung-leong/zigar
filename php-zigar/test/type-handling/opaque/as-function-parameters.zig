const std = @import("std");

pub const Orange = opaque {};
var number: i32 = 1234;

pub var orange_ptr: *Orange = @ptrCast(&number);

pub fn print(ptr: *Orange) void {
    const int_ptr: *i32 = @ptrCast(@alignCast(ptr));
    std.debug.print("Value = {d}\n", .{int_ptr.*});
}
