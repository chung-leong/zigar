pub const TagType = enum { function, number };

pub const Fn = *const fn () void;

fn hello() void {}

pub const UnionA = union(TagType) {
    function: Fn,
    number: i32,
};

pub var union_a: UnionA = .{ .function = hello };
pub var union_b: UnionA = .{ .number = 123 };
