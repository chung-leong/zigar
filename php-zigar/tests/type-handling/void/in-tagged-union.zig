pub const TagType = enum { empty, number };

pub const UnionA = union(TagType) {
    empty: void,
    number: i32,
};

pub var union_a: UnionA = .{ .empty = {} };
