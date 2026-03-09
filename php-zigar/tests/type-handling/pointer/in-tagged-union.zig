pub const TagType = enum { text, number };

pub const UnionA = union(TagType) {
    text: []const u8,
    number: i32,
};
pub var alt_text: []const u8 = "World";

pub var union_a: UnionA = .{ .text = "Hello" };
