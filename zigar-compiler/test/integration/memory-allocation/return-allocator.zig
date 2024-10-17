const std = @import("std");

var gpa = std.heap.GeneralPurposeAllocator(.{}){};

pub fn getAllocator() std.mem.Allocator {
    return gpa.allocator();
}
