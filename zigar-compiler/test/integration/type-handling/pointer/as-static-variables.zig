const std = @import("std");

pub var int32_array: [3]i32 = .{ 123, 456, 789 };
pub const int32_slice: []const i32 = &int32_array;
pub const u8_slice: []const u8 = "Hello world";

pub var uint32_array4: [4]u32 = .{ 1, 2, 3, 4 };
pub var uint32_slice = uint32_array4[1..4];

pub fn print() void {
    std.debug.print("{any}\n", .{uint32_array4});
}

pub var text: []const u8 = "Hello world";
pub var alt_text: []const u8 = "Goodbye cruel world";

pub fn printText() void {
    std.debug.print("{s}\n", .{text});
}

var gpa = std.heap.GeneralPurposeAllocator(.{}){};
var allocator = gpa.allocator();

pub fn allocText(src: []const u8) ![]const u8 {
    const dest = try allocator.alloc(u8, src.len);
    @memcpy(dest, src);
    return dest;
}

pub fn freeText(dest: []const u8) void {
    allocator.free(dest);
}

pub const u8_slice_w_sentinel: [*:0]const u8 = "Hello world";
const i64_array: [10]i64 = .{ 0, 1, 2, 3, 4, 5, 6, 7, 8, 9 };
pub const i64_slice_w_sentinel: [*:7]const i64 = @ptrCast(&i64_array);
