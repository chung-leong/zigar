const std = @import("std");
const expectEqual = std.testing.expectEqual;

const slice = @import("slice.zig");

pub fn get(comptime T: type) ?usize {
    if (comptime slice.is(T) and T.is_opaque) {
        // opaque types have unknown size
        return null;
    }
    return switch (@typeInfo(T)) {
        .null, .undefined, .@"fn" => 0,
        .@"opaque" => null,
        .error_set => @sizeOf(anyerror),
        else => return @sizeOf(T),
    };
}

test "get" {
    try expectEqual(0, get(void));
    try expectEqual(0, get(@TypeOf(null)));
    try expectEqual(1, get(u8));
    try expectEqual(null, get(slice.Slice(anyopaque, null)));
}
