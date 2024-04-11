pub const WeirdStruct = packed struct {
    state: bool = false,
    number: u128 = 123456789000000,
};

pub const weird_struct: WeirdStruct = .{};
