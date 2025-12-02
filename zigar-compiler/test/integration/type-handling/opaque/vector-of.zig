const std = @import("std");

var number1: i32 = 1234;
var number2: i32 = 2456;

pub var vector: @Vector(4, *anyopaque) = .{
    @ptrCast(&number1),
    @ptrCast(&number1),
    @ptrCast(&number1),
    @ptrCast(&number1),
};
pub const vector_const: @Vector(4, *anyopaque) = .{
    @ptrCast(&number1),
    @ptrCast(&number1),
    @ptrCast(&number1),
    @ptrCast(&number1),
};

pub fn change(i: i32) void {
    if (i == 1) {
        vector = .{
            @ptrCast(&number1),
            @ptrCast(&number1),
            @ptrCast(&number1),
            @ptrCast(&number1),
        };
    } else if (i == 2) {
        vector = .{
            @ptrCast(&number2),
            @ptrCast(&number2),
            @ptrCast(&number2),
            @ptrCast(&number2),
        };
    }
}

pub fn print(v: @Vector(4, *anyopaque)) void {
    var array: [4]i32 = undefined;
    inline for (0..4) |i| {
        const int_ptr: *i32 = @ptrCast(@alignCast(v[i]));
        array[i] = int_ptr.*;
    }
    std.debug.print("{any}\n", .{array});
}
