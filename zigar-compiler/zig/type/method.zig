const std = @import("std");
const expectEqual = std.testing.expectEqual;

pub fn is(comptime Self: type, comptime T: type, instance: bool) bool {
    switch (@typeInfo(T)) {
        .@"fn" => |f| {
            if (f.params.len > 0) {
                if (f.params[0].type) |PT| {
                    if (PT == Self) return true;
                    if (instance) return false;
                    return switch (@typeInfo(PT)) {
                        .pointer => |pt| pt.child == Self,
                        else => false,
                    };
                }
            }
        },
        else => {},
    }
    return false;
}

test "is" {
    const A = struct {
        number: i32 = 0,

        fn a() void {}
        fn b(_: i32) void {}
        fn c(_: @This()) void {}
        fn d(_: *@This()) void {}
        fn e(_: *const @This()) void {}
    };
    const B = struct {};
    try expectEqual(false, is(A, @TypeOf(A.a), false));
    try expectEqual(false, is(A, @TypeOf(A.b), false));
    try expectEqual(true, is(A, @TypeOf(A.c), false));
    try expectEqual(true, is(A, @TypeOf(A.d), false));
    try expectEqual(true, is(A, @TypeOf(A.e), false));
    try expectEqual(false, is(A, @TypeOf(A.e), true));
    try expectEqual(false, is(B, u32, false));
}
