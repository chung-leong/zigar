const std = @import("std");

pub const AnyOpaque = anyopaque;

var number1: i32 = 1234;
var number2: i32 = 4567;
var number3: i32 = 8888;
var number4: i32 = 9999;

pub const StructA = struct {
    ptr1: *anyopaque = &number1,
    ptr2: *anyopaque = &number2,
};

pub const alt_ptr1: *anyopaque = @ptrCast(&number3);
pub const alt_ptr2: *anyopaque = @ptrCast(&number4);

pub var struct_a: StructA = .{ .ptr1 = alt_ptr1, .ptr2 = alt_ptr2 };

pub fn print() void {
    const int_ptr1: *i32 = @ptrCast(@alignCast(struct_a.ptr1));
    const int_ptr2: *i32 = @ptrCast(@alignCast(struct_a.ptr2));
    std.debug.print("{d} {d}\n", .{ int_ptr1.*, int_ptr2.* });
}
