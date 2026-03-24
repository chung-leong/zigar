const std = @import("std");

var gpa = std.heap.GeneralPurposeAllocator(.{}){};
var allocator = gpa.allocator();

pub fn createSlice(count: usize) ![]i32 {
    return try allocator.alloc(i32, count);
}

pub fn freeSlice(slice: []i32) void {
    allocator.free(slice);
}

pub fn printSlice(slice: []i32) void {
    for (slice) |number| {
        std.debug.print("{d}\n", .{number});
    }
}
