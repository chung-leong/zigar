pub const Pet = enum {
    dog,
    cat,
    monkey,
};
pub const UnionA = union {
    pet: Pet,
    number: i32,
};

pub var union_a: UnionA = .{ .pet = Pet.cat };
