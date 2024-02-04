const std = @import("std");

pub const AnyOpaque = anyopaque;

var number1: i32 = 123;
var number2: i32 = 345;
var number3: i32 = 567;
var number4: i32 = 789;
var number5: i32 = 5555;

pub var array: [4]*anyopaque = .{
    @ptrCast(&number1),
    @ptrCast(&number2),
    @ptrCast(&number3),
    @ptrCast(&number4),
};
pub var alt_ptr: *anyopaque = @ptrCast(&number5);

pub fn print() void {
    var numbers: [4]i32 = undefined;
    for (array, 0..) |ptr, index| {
        const int_ptr: *i32 = @ptrCast(@alignCast(ptr));
        numbers[index] = int_ptr.*;
    }
    std.debug.print("{any}\n", .{numbers});
}
