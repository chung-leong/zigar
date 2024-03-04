pub const TagType = enum { state, number };

pub const UnionA = union(TagType) {
    state: bool,
    number: comptime_int,
};

pub const union_a: UnionA = .{ .number = 123 };
