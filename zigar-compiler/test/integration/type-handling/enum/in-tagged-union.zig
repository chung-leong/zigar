pub const TagType = enum { pet, number };

pub const Pet = enum {
    Dog,
    Cat,
    Monkey,
};
pub const UnionA = union(TagType) {
    pet: Pet,
    number: i32,
};

pub var union_a: UnionA = .{ .pet = Pet.Cat };
