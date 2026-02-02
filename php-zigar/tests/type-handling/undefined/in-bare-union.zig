pub const UnionA = union {
    empty: @TypeOf(undefined),
    number: i32,
};

pub const union_a: UnionA = .{ .empty = undefined };
