const std = @import("std");
const expectEqual = std.testing.expectEqual;

pub fn has(comptime T: type) bool {
    return check(T, .{});
}

fn check(comptime T: type, comptime checking: anytype) bool {
    return switch (@typeInfo(T)) {
        .pointer => true,
        .error_union => |eu| check(eu.payload, checking),
        inline .array, .vector, .optional => |ar| check(ar.child, checking),
        .@"struct" => |st| inline for (st.field_types, 0..) |FieldType, i| {
            if (!st.field_attrs[i].@"comptime") {
                if (check(FieldType, checking ++ .{T})) break true;
            }
        } else false,
        .@"union" => |un| inline for (un.field_types) |FieldType| {
            if (check(FieldType, checking ++ .{T})) break true;
        } else false,
        else => false,
    };
}

test "has" {
    try expectEqual(true, has(*i32));
    try expectEqual(true, has(struct { a: *i32 }));
    try expectEqual(true, has(struct { a: i32, b: *@This() }));
    try expectEqual(false, has(struct { a: i32 }));
}

pub fn is(comptime T: type) bool {
    return switch (@typeInfo(T)) {
        .pointer => true,
        else => false,
    };
}

test "is" {
    try expectEqual(true, is(*i32));
}
