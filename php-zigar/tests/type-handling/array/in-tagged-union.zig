pub const TagType = enum { array, number };

pub const UnionA = union(TagType) {
    array: [4]i32,
    number: i32,
};

pub var union_a: UnionA = .{ .array = .{ 1, 2, 3, 4 } };
