pub const Error = error{ GoldfishDied, NoMoney };

pub const UnionA = union {
    state: bool,
    number: Error!i32,
};

pub var union_a: UnionA = .{ .number = 3456 };
