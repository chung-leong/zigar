pub const TagType = enum { state, number };

pub const UnionA = union(TagType) {
    number: comptime_int,
    state: bool,
};

pub const union_a: UnionA = .{ .number = 123 };
