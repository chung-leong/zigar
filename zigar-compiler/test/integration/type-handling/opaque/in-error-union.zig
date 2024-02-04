const std = @import("std");

pub const AnyOpaque = anyopaque;
pub const Error = error{ GoldfishDied, NoMoney };

var number1: i32 = 1234;
var number2: i32 = 4567;

pub var error_union: Error!*anyopaque = @ptrCast(&number1);
pub var alt_ptr: *anyopaque = @ptrCast(&number2);

pub fn print() void {
    if (error_union) |ptr| {
        const int_ptr: *i32 = @ptrCast(@alignCast(ptr));
        std.debug.print("{d}\n", .{int_ptr.*});
    } else |err| {
        std.debug.print("{any}\n", .{err});
    }
}
