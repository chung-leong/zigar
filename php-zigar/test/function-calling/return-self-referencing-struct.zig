const std = @import("std");

const Struct = struct {
    number1: i32,
    number2: i32,
    self: *@This(),
};

pub fn getStruct(allocator: std.mem.Allocator) !*Struct {
    const ptr = try allocator.create(Struct);
    ptr.number1 = 123;
    ptr.number2 = 456;
    ptr.self = ptr;
    return ptr;
}
