// struct-pointer.zig
const std = @import("std");

const StructA = struct {
    dog: i32,
    cat: i32,
};

pub fn printStruct(s: *const StructA) void {
    std.debug.print("{any}\n", .{s.*});
}
