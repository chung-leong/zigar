const std = @import("std");

pub const Element = struct {
    number1: i32 = 1234,
    number2: i32 = 4567,
};

pub const Struct = struct {
    elements: []*Element,
    text: []u8,
};

var gpa: std.heap.DebugAllocator(.{}) = .init;

pub const allocator = gpa.allocator();

pub fn free(s: *Struct) void {
    for (s.elements) |e| allocator.destroy(e);
    allocator.free(s.elements);
    allocator.free(s.text);
    return allocator.destroy(s);
}
