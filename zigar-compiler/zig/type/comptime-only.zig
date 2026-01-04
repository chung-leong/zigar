const std = @import("std");
const expectEqual = std.testing.expectEqual;

const comptime_only = @import("./comptime-only");

pub fn is(comptime T: type) bool {
    return check(T, .{});
}

fn check(comptime T: type, comptime checking: anytype) bool {
    return switch (@typeInfo(T)) {
        .type,
        .comptime_float,
        .comptime_int,
        .enum_literal,
        .null,
        .undefined,
        => true,
        .error_union => |eu| check(eu.payload, checking),
        .pointer => |pt| inline for (checking) |C| {
            if (pt.child == C) break false;
        } else check(pt.child, checking),
        inline .array, .vector, .optional => |ar| check(ar.child, checking),
        .@"struct" => |st| inline for (st.fields) |field| {
            if (!field.is_comptime) {
                if (check(field.type, checking ++ .{T})) break true;
            }
        } else false,
        .@"union" => |un| inline for (un.fields) |field| {
            if (check(field.type, checking ++ .{T})) break true;
        } else false,
        else => false,
    };
}

test "is" {
    try expectEqual(false, is(i32));
    try expectEqual(true, is(comptime_int));
    try expectEqual(false, is(struct { a: i32 }));
    try expectEqual(true, is(struct { a: comptime_int }));
    try expectEqual(false, is(struct { comptime a: comptime_int = 123 }));
    try expectEqual(true, is(struct { self: *@This(), a: comptime_int }));
    try expectEqual(false, is(struct { self: *@This(), a: f32 }));
}
