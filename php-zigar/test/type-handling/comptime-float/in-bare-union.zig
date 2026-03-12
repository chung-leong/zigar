pub const UnionA = union {
    number: comptime_float,
    state: bool,
};

pub const union_a: UnionA = .{ .number = 1.23 };
