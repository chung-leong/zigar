const std = @import("std");
const expect = std.testing.expect;

pub fn Sentinel(comptime T: type) type {
    const ET = switch (@typeInfo(T)) {
        .@"opaque" => u8,
        else => T,
    };
    return struct {
        value: ET,
        is_required: bool = true,
    };
}

pub fn Slice(comptime T: type, comptime s: ?Sentinel(T)) type {
    const ET = switch (@typeInfo(T)) {
        .@"opaque" => u8,
        else => T,
    };
    return struct {
        pub const ElementType = ET;
        pub const sentinel = s;
        pub const is_opaque = ET != T;

        element: ET,
    };
}

test "Slice" {
    const A = Slice(u8, null);
    const B = Slice(u8, null);
    const C = Slice(u8, .{ .value = 0 });
    try expect(A == B);
    try expect(C != B);
}
