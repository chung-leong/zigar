pub const TagType = enum { state, number };

pub const UnionA = union(TagType) {
    state: bool,
    number: f64,
};

pub var union_a: UnionA = .{ .number = 3.456 };
