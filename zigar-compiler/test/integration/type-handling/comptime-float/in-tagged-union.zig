pub const TagType = enum { state, number };

pub const UnionA = union(TagType) {
    number: comptime_float,
    state: bool,
};

pub const union_a: UnionA = .{ .number = 1.23 };
