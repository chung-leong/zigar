const std = @import("std");

fn show(comptime T: type) void {
    switch (@typeInfo(T)) {
        .Array => |ar| {
            std.debug.print("Array {d}\n", .{ar.len});
        },
        .Pointer => |pt| {
            std.debug.print("Pointer {s} {s}\n", .{ @typeName(pt.child), @tagName(pt.size) });
        },
        else => {},
    }
}

test "Something" {
    std.debug.print("\n", .{});
    const a: []const u8 = "Hello";
    const b: [4]u8 = a[0..4].*;
    show(@TypeOf(b));
}
