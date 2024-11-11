const std = @import("std");
const zigar = @import("zigar");

pub const defaultAllocator = zigar.mem.getDefaultAllocator();

pub const Struct = struct { number1: i32, number2: i32 };

pub fn alloc(allocator: std.mem.Allocator) !*Struct {
    const ptr = try allocator.create(Struct);
    ptr.* = .{ .number1 = 123, .number2 = 456 };
    return ptr;
}
