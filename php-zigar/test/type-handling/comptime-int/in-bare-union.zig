pub const UnionA = union {
    number: comptime_int,
    state: bool,
};

pub const union_a: UnionA = .{ .number = 123 };
