const std = @import("std");
const expectEqual = std.testing.expectEqual;

const slice = @import("slice.zig");
const Slice = slice.Slice;

pub fn get(comptime T: type) type {
    return switch (@typeInfo(T)) {
        .pointer => |pt| switch (pt.size) {
            .one => if (pt.child == anyopaque) Slice(anyopaque, null) else pt.child,
            else => define: {
                if (pt.sentinel_ptr) |ptr| {
                    const sentinel_ptr: *const pt.child = @ptrCast(@alignCast(ptr));
                    break :define Slice(pt.child, .{ .value = sentinel_ptr.* });
                } else if (pt.size == .c and (pt.child == u8 or pt.child == u16)) {
                    break :define Slice(pt.child, .{ .value = 0, .is_required = false });
                } else {
                    break :define Slice(pt.child, null);
                }
            },
        },
        else => @compileError("Not a pointer"),
    };
}

test "get" {
    try expectEqual(Slice(i32, null), get([]i32));
    try expectEqual(Slice(anyopaque, null), get(*const anyopaque));
    try expectEqual(i32, get(*i32));
}
