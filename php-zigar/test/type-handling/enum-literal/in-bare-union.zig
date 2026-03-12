pub const UnionA = union {
    literal: @TypeOf(.enum_literal),
    number: i32,
};

pub const union_a: UnionA = .{ .literal = .hello };
