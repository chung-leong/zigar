pub const TagType = enum { Type, number };

pub const UnionA = union(TagType) {
    Type: type,
    number: i32,
};

pub const union_a: UnionA = .{ .Type = bool };
