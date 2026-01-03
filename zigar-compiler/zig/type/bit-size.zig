const std = @import("std");
const expectEqual = std.testing.expectEqual;

pub fn get(comptime T: type) ?usize {
    return switch (@typeInfo(T)) {
        .null, .undefined, .@"fn" => 0,
        .@"opaque" => null,
        .error_set => @bitSizeOf(anyerror),
        else => return @bitSizeOf(T),
    };
}

test "getBitSize" {
    try expectEqual(0, get(void));
    try expectEqual(0, get(@TypeOf(null)));
    try expectEqual(8, get(u8));
}
