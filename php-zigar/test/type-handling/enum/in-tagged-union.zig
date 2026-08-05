pub const TagType = enum { pet, number };

pub const Pet = enum {
    dog,
    cat,
    monkey,
};
pub const UnionA = union(TagType) {
    pet: Pet,
    number: i32,
};

pub var union_a: UnionA = .{ .pet = Pet.cat };
