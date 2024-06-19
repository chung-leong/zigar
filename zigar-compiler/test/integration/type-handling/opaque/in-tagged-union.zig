const std = @import("std");

pub const TagType = enum { ptr, number };

var number1: i32 = 1234;
var number2: i32 = 4567;

pub const Opaque = opaque {};

pub const UnionA = union(TagType) {
    ptr: *Opaque,
    number: i32,
};
pub var alt_ptr: *Opaque = @ptrCast(&number2);

pub var union_a: UnionA = .{ .ptr = @ptrCast(&number1) };

pub fn print() void {
    const int_ptr: *i32 = @ptrCast(@alignCast(union_a.ptr));
    std.debug.print("Value = {d}\n", .{int_ptr.*});
}
