const std = @import("std");
const expectEqual = std.testing.expectEqual;

const slice = @import("slice.zig");
const Slice = slice.Slice;
pub const Sentinel = slice.Sentinel;

fn ElementType(comptime T: type) type {
    return if (slice.is(T))
        T.ElementType
    else switch (@typeInfo(T)) {
        inline .array, .vector => |ar| ar.child,
        else => @compileError("Not an array, vector, or slice"),
    };
}

pub fn get(comptime T: type) ?Sentinel(ElementType(T)) {
    return if (comptime slice.is(T))
        T.sentinel
    else switch (@typeInfo(T)) {
        inline .array => |ar| if (ar.sentinel_ptr) |opaque_ptr| sentinel: {
            const ptr: *const ar.child = @ptrCast(opaque_ptr);
            break :sentinel .{ .value = ptr.*, .is_required = true };
        } else null,
        else => @compileError("Not an array or slice"),
    };
}

test "get" {
    try expectEqual(0, get(Slice(u8, .{ .value = 0 })).?.value);
    try expectEqual(7, get(Slice(i32, .{ .value = 7 })).?.value);
    try expectEqual(-2, get(Slice(i32, .{ .value = -2 })).?.value);
    try expectEqual(null, get(Slice(i32, null)));
}
