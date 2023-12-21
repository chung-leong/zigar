pub const TagType = enum { variant, number };
const ValueType = enum { String, Integer, Float };
pub const Variant = union(ValueType) {
    String: []const u8,
    Integer: u32,
    Float: f64,
};
pub const UnionA = union(TagType) {
    variant: Variant,
    number: i32,
};

pub var union_a: UnionA = .{ .variant = .{ .String = "Hello" } };
