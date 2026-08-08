const std = @import("std");
const expectEqual = std.testing.expectEqual;

const comptime_only = @import("comptime-only.zig");
const ComptimeFree = @import("comptime-free.zig").ComptimeFree;
const slice = @import("slice.zig");

pub fn get(comptime T: type) ?usize {
    if (comptime slice.is(T) and T.is_opaque) {
        // opaque types have unknown size
        return null;
    }
    if (comptime comptime_only.is(T)) {
        const CT = ComptimeFree(T);
        return @bitSizeOf(CT);
    }
    return switch (@typeInfo(T)) {
        .null, .undefined, .@"fn" => 0,
        .@"opaque", .type => null,
        .error_set => @bitSizeOf(anyerror),
        else => return @bitSizeOf(T),
    };
}

test "getBitSize" {
    try expectEqual(0, get(void));
    try expectEqual(0, get(@TypeOf(null)));
    try expectEqual(8, get(u8));
}
