pub const UnionA = union {
    array: [4]i32,
    number: i32,
};

pub var union_a: UnionA = .{ .array = .{ 1, 2, 3, 4 } };
