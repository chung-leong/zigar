pub const TagType = enum { literal, number };

pub const UnionA = union(TagType) {
    literal: @TypeOf(.enum_literal),
    number: i32,
};

pub const union_a: UnionA = .{ .literal = .hello };
