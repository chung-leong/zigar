pub const StructA = struct {
    number1: u32,
    comptime number2: i32 = 77,
    comptime number_type: type = i32,
    comptime string: []const u8 = "Hello",
    comptime number3: comptime_int = 0x10_0000_0000_000,
};

pub const StructB = struct {
    comptime number1: i32 = 77,
    comptime number_type: type = i32,
    comptime number2: comptime_int = 123,
};
