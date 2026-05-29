const std = @import("std");

pub const StructA = struct {
    number1: i32,
    number2: i32,

    pub fn print(self: StructA) void {
        std.debug.print("{any}\n", .{self});
    }
};

pub const StructB = struct {
    child: StructA,
    ptr: *StructA,
};

pub var a: StructA = .{ .number1 = 1, .number2 = 2 };
pub var b: StructB = .{
    .child = .{ .number1 = -1, .number2 = -2 },
    .ptr = &a,
};

pub fn change() void {
    b.ptr.* = .{ .number1 = 123, .number2 = 456 };
    a.print();
}
