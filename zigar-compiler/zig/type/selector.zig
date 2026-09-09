const std = @import("std");
const expectEqual = std.testing.expectEqual;
const builtin = @import("builtin");

const util = @import("util.zig");

pub fn has(comptime T: type) bool {
    return switch (@typeInfo(T)) {
        .@"union" => get(T) != null,
        .optional => |op| switch (@typeInfo(op.child)) {
            .pointer, .error_set => false,
            else => true,
        },
        else => @compileError("Not a union or optional"),
    };
}

pub fn get(comptime T: type) ?type {
    return switch (@typeInfo(T)) {
        .@"union" => |un| un.tag_type orelse debug_tag: {
            if (builtin.mode == .safe or builtin.mode == .debug) {
                if (un.layout != .@"extern" and un.layout != .@"packed") {
                    break :debug_tag util.IntFor(un.field_names.len);
                }
            }
            break :debug_tag null;
        },
        .optional => |op| switch (@typeInfo(op.child)) {
            .pointer => usize, // size of the pointer itself
            .error_set => @Int(.unsigned, @bitSizeOf(anyerror)),
            else => u8,
        },
        else => @compileError("Not a union or optional"),
    };
}

test "get" {
    const Tag = enum { cat, dog };
    const Union = union(Tag) {
        cat: u32,
        dog: u32,
    };
    try expectEqual(Tag, get(Union));
    if (builtin.mode == .safe or builtin.mode == .debug) {
        const BareUnion = union {
            cat: u32,
            dog: u32,
        };
        try expectEqual(u8, get(BareUnion));
    }
}
