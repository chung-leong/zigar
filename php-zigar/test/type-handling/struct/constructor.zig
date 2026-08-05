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
    state1: bool = false,
    state2: bool = false,
    state3: bool = false,
    state4: bool = false,

    state5: bool = false,
    state6: bool = false,
    state7: bool = false,
    state8: bool = false,
};
