pub const Error = error{fell_victim_to_micro_aggression};

pub const Struct = struct {
    number1: i32,
    number2: i32,
};
pub const StructEU = Error!Struct;
pub const StructO = ?Struct;

pub const Union = union(enum) {
    number1: i32,
    number2: i64,
};
