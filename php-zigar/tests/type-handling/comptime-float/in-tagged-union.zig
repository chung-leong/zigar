pub const TagType = enum { state, number };

pub const UnionA = union(TagType) {
    state: bool,
    number: comptime_float,
};

pub const union_a: UnionA = .{ .number = 1.23 };
