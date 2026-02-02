pub const UnionA = union {
    empty: @TypeOf(null),
    number: i32,
};

pub const union_a: UnionA = .{ .empty = null };
