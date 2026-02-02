pub const UnionA = union {
    state: bool,
    number: ?i32,
};

pub var union_a: UnionA = .{ .number = 1234 };
