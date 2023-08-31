const std = @import("std");

var gpa = std.heap.GeneralPurposeAllocator(.{}){};
var allocator = gpa.allocator();

pub fn createSlice(count: usize) ![]i32 {
    const slice = try allocator.alloc(i32, count);
    std.debug.print("Address: {x}\n", .{@intFromPtr(slice.ptr)});
    return slice;
}

pub fn freeSlice(slice: []i32) void {
    std.debug.print("Address: {x}\n", .{@intFromPtr(slice.ptr)});
    allocator.free(slice);
}

pub fn printSlice(slice: []i32) void {
    for (slice) |number| {
        std.debug.print("{d}\n", .{number});
    }
}
