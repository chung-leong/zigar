const std = @import("std");
const expectEqual = std.testing.expectEqual;

const error_offset = @import("error-offset.zig");
const selector = @import("selector.zig");
const selector_offset = @import("selector-offset.zig");

pub fn get(comptime T: type) comptime_int {
    return switch (@typeInfo(T)) {
        .@"union" => if (selector.get(T)) |TT| switch (selector_offset.get(T)) {
            0 => @sizeOf(TT) * 8,
            else => 0,
        } else 0,
        .optional => 0,
        .error_union => switch (error_offset.get(T)) {
            0 => @sizeOf(anyerror) * 8,
            else => 0,
        },
        else => @compileError("Not a union, error union, or optional"),
    };
}

test "get" {
    const Union = union(enum) {
        cat: i32,
        dog: i32,
    };
    try expectEqual(0, get(Union));
}
