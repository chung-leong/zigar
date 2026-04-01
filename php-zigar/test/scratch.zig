const std = @import("std");

pub const TaggedUnion = union(enum) {
    number: i32,
    text: []const u8,
};

pub var tagged_union_a: TaggedUnion = .{ .number = 1234 };
pub var tagged_union_b: TaggedUnion = .{ .text = "Hello world" };

pub const BareUnion = union {
    number: i32,
    text: []const u8,
};

pub var bare_union_a: BareUnion = .{ .number = 1234 };
pub var bare_union_b: BareUnion = .{ .text = "Hello world" };

pub const Struct = struct {
    number: i32,
    text: []const u8,
};

pub const Complex = union {
    object: Struct,
    optional: ?[]const u8,
    array: [3]Struct,
};

pub var complex_a: Complex = .{
    .object = .{ .text = "Hello world", .number = 4567 },
};
pub var complex_b: Complex = .{
    .optional = null,
};
pub var complex_c: Complex = .{
    .optional = "Hello world",
};
pub var complex_d: Complex = .{
    .array = .{
        .{ .number = 1, .text = "foo" },
        .{ .number = 2, .text = "bar" },
        .{ .number = 3, .text = "foobar" },
    },
};
