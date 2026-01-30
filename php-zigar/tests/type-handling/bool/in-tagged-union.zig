pub const TagType = enum { state, number };

pub const UnionA = union(TagType) {
    state: bool,
    number: i32,
};

pub var union_a: UnionA = .{ .state = true };
