pub const TagType = enum { vector, number };

pub const UnionA = union(TagType) {
    vector: @Vector(4, i32),
    number: i32,
};

pub var union_a: UnionA = .{ .vector = .{ 1, 2, 3, 4 } };
