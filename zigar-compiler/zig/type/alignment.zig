const std = @import("std");
const expectEqual = std.testing.expectEqual;

const slice = @import("slice.zig");

pub fn get(comptime T: type) ?u16 {
    if (comptime slice.is(T) and T.is_opaque) {
        // opaque types have unknown size
        return null;
    }
    return switch (@typeInfo(T)) {
        .null, .undefined, .@"fn" => 0,
        .@"opaque" => null,
        .error_set => @alignOf(anyerror),
        else => return @alignOf(T),
    };
}

test "get" {
    try expectEqual(1, get(void));
    try expectEqual(1, get(u8));
    try expectEqual(4, get(u32));
    try expectEqual(null, get(slice.Slice(anyopaque, null)));
}
