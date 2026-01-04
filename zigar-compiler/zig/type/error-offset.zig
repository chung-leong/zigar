const std = @import("std");
const expectEqual = std.testing.expectEqual;

pub fn get(comptime T: type) comptime_int {
    return switch (@typeInfo(T)) {
        // value is placed after the error number if its alignment is smaller than that of anyerror
        .error_union => |eu| if (@alignOf(anyerror) > @alignOf(eu.payload)) 0 else @sizeOf(eu.payload) * 8,
        else => @compileError("Not an error union"),
    };
}

test "get" {
    try expectEqual(0, get(anyerror!u8));
    try expectEqual(32, get(anyerror!u32));
}
