pub const TagType = enum { structure, number };
pub const Struct = packed struct {
    number1: i12,
    number2: i12,
};
pub const UnionA = union(TagType) {
    structure: Struct,
    number: i32,
};

pub var union_a: UnionA = .{ .structure = .{ .number1 = 100, .number2 = 200 } };
