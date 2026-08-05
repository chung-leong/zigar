const std = @import("std");

pub const Opaque = opaque {};

var number1: i32 = 1234;
var number2: i32 = 4567;

pub var optional: ?*Opaque = @ptrCast(&number1);
pub var alt_ptr: *Opaque = @ptrCast(&number2);

pub fn print() void {
    if (optional) |ptr| {
        const int_ptr: *i32 = @ptrCast(@alignCast(ptr));
        std.debug.print("{any}\n", .{int_ptr.*});
    } else {
        std.debug.print("null\n", .{});
    }
}
