pub const TagType = enum { unknown, number };

pub const UnionA = union(TagType) {
    unknown: anyopaque,
    number: i32,
};

pub var union_a: UnionA = .{ .unknown = opaque {} };
