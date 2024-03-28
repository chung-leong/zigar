pub const Error = error{ goldfish_died, no_money };

pub const UnionA = union {
    state: bool,
    number: Error!i32,
};

pub var union_a: UnionA = .{ .number = 3456 };
