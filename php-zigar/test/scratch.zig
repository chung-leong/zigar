const std = @import("std");

pub const Test = struct {
    number1: i32 = 1234,
    number2: i32 = 4567,
};

var gpa: std.heap.DebugAllocator(.{}) = .init;

pub const allocator = gpa.allocator();

pub fn free(s: *Test) void {
    return allocator.destroy(s);
}
