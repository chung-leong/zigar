const std = @import("std");

var gpa = std.heap.GeneralPurposeAllocator(.{}){};

pub const Struct = struct { number1: i32, number2: i32 };
pub var ptr_maybe: ?*Struct = null;

pub fn getAllocator() std.mem.Allocator {
    return gpa.allocator();
}

pub fn print() void {
    if (ptr_maybe) |ptr| {
        std.debug.print("{any}\n", .{ptr.*});
    } else {
        std.debug.print("empty\n", .{});
    }
}
