const std = @import("std");
const expectEqual = std.testing.expectEqual;

const comptime_only = @import("comptime-only.zig");

pub fn is(comptime T: type) bool {
    return check(T, .{});
}

fn check(comptime T: type, comptime checking: anytype) bool {
    return switch (@typeInfo(T)) {
        .bool,
        .int,
        .float,
        .void,
        .error_set,
        .@"union",
        .@"enum",
        .@"opaque",
        .noreturn,
        .type,
        .comptime_float,
        .comptime_int,
        .enum_literal,
        .null,
        .undefined,
        => true,
        .error_union => |eu| check(eu.payload, checking),
        .pointer => |pt| inline for (checking) |C| {
            if (pt.child == C) break true;
        } else check(pt.child, checking),
        inline .array, .vector, .optional => |ar| check(ar.child, checking),
        .@"struct" => T != std.Options,
        .@"fn" => |f| inline for (f.params) |param| {
            if (param.is_generic) break false;
            if (param.type == null) break false;
        } else inline for (.{1}) |_| {
            if (f.is_generic) break false;
            const RT = f.return_type orelse break false;
            if (comptime_only.is(RT)) break false;
        } else true,
        else => false,
    };
}

test "is" {
    try expectEqual(true, is(i32));
    try expectEqual(true, is(type));
    try expectEqual(false, is(std.Options));
    try expectEqual(false, is(fn (anytype) void));
    try expectEqual(false, is(*const fn (anytype) void));
    try expectEqual(false, is(*const fn () type));
}
