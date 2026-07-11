const std = @import("std");

var gpa = std.heap.GeneralPurposeAllocator(.{}){};

pub const Struct = struct { number1: i32, number2: i32 };
pub var ptr_maybe: ?*Struct = null;

pub fn getAllocator() std.mem.Allocator {
    return gpa.allocator();
}

pub fn allocate(a: std.mem.Allocator, len: usize) ![]u8 {
    const slice = try a.alloc(u8, len);
    for (slice) |*ptr| ptr.* = 77;
    return slice;
}

pub fn print() void {
    if (ptr_maybe) |ptr| {
        std.debug.print("{any}\n", .{ptr.*});
    } else {
        std.debug.print("empty\n", .{});
    }
}
