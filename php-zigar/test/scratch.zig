const Union = union(enum) {
    dog: i32,
    cat: f32,
};

pub const union_value: Union = .{ .dog = 1234 };
