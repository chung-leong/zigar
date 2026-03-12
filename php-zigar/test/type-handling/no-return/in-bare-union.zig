pub const UnionA = union {
    empty: noreturn,
    number: i32,
};

pub const union_a: UnionA = .{ .empty = unreachable };
