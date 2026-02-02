pub const TagType = enum { empty, number };

pub const UnionA = union(TagType) {
    empty: @TypeOf(undefined),
    number: i32,
};

pub const union_a: UnionA = .{ .empty = undefined };
