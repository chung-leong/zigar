pub const TagType = enum { state, number };
pub const Error = error{ GoldfishDied, NoMoney };

pub const UnionA = union(TagType) {
    state: bool,
    number: Error!i32,
};

pub var union_a: UnionA = .{ .number = 3456 };
