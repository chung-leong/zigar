const std = @import("std");
const expectEqual = std.testing.expectEqual;

const selector = @import("selector.zig");

pub fn get(comptime T: type) comptime_int {
    return switch (@typeInfo(T)) {
        .@"union" => get: {
            const TT = selector.get(T).?;
            const fields = @typeInfo(T).@"union".fields;
            // selector comes first unless content needs larger align
            comptime var offset = 0;
            inline for (fields) |field| {
                if (@alignOf(field.type) > @alignOf(TT)) {
                    const new_offset = @sizeOf(field.type) * 8;
                    if (new_offset > offset) {
                        offset = new_offset;
                    }
                }
            }
            break :get offset;
        },
        .optional => |op| switch (@typeInfo(op.child)) {
            .pointer, .error_set => 0, // offset of the pointer/error itself
            else => @sizeOf(op.child) * 8,
        },
        else => @compileError("Not a union or optional"),
    };
}

test "get" {
    const Union = union(enum) {
        cat: i32,
        dog: i32,
    };
    try expectEqual(32, get(Union));
}
