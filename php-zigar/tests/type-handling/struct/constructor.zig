pub const Struct = struct {
    number1: i32,
    number2: i32,
    number3: i32 = 3333,
};
pub const ExternStruct = struct {
    number1: i32 = 123,
    number2: i32 = 456,
};
pub const PackedStruct = packed struct {
    state1: bool,
    state2: bool,
    state3: bool,
    state4: bool,

    state5: bool = false,
    state6: bool,
    state7: bool,
    state8: bool,
};
