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
    pointer: *StructA,
};

pub var a: StructA = .{ .number1 = 1, .number2 = 2 };
pub var b: StructB = .{
    .child = .{ .number1 = -1, .number2 = -2 },
    .pointer = &a,
};

pub fn change() void {
    b.pointer.* = .{ .number1 = 123, .number2 = 456 };
    a.print();
}
