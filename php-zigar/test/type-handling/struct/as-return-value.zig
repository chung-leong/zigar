pub const Struct = packed struct {
    number1: i12,
    number2: i12,
};

pub fn getStruct() Struct {
    return .{ .number1 = 1, .number2 = 2 };
}
