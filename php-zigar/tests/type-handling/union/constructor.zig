pub const TaggedUnion = union(enum) {
    number1: i32,
    number2: i32,
};
pub const ExternUnion = extern union {
    number1: i32,
    number2: i32,
};
