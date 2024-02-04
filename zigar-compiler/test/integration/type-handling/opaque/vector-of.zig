const std = @import("std");

var number: i32 = 1234;

pub var vector: @Vector(4, *anyopaque) = .{
    @ptrCast(&number),
    @ptrCast(&number),
    @ptrCast(&number),
    @ptrCast(&number),
};

pub fn print() void {
    std.debug.print("{any}\n", .{vector});
}
