pub const UnionA = union {
    unknown: anyopaque,
    number: i32,
};

pub var union_a: UnionA = .{ .unknown = opaque {} };