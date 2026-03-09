pub const UnionA = union {
    text: []const u8,
    number: i32,
};
pub var alt_text: []const u8 = "World";

pub var union_a: UnionA = .{ .text = "Hello" };
