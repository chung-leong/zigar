pub const TagType = enum { empty, number };

pub const UnionA = union(TagType) {
    empty: @TypeOf(null),
    number: i32,
};

pub const union_a: UnionA = .{ .empty = null };
