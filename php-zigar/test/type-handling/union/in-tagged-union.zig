pub const TagType = enum { variant, number };
const ValueType = enum { string, integer, float };
pub const Variant = union(ValueType) {
    string: []const u8,
    integer: u32,
    float: f64,
};
pub const UnionA = union(TagType) {
    variant: Variant,
    number: i32,
};

pub var union_a: UnionA = .{ .variant = .{ .string = "Hello" } };
