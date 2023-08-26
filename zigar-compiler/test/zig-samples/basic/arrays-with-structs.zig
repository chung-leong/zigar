const StructA = struct {
    number1: i32,
    number2: i32,
};

const StructB = struct {
    good: bool,
    numbers: [4]i32,
};

pub const array_a: [4]StructA = .{
    .{ .number1 = 1, .number2 = 2 },
    .{ .number1 = 3, .number2 = 4 },
    .{ .number1 = 5, .number2 = 6 },
    .{ .number1 = 7, .number2 = 8 },
};

pub const array_b: [3]StructB = .{
    .{ .good = true, .numbers = .{ 1, 2, 3, 4 } },
    .{ .good = false, .numbers = .{ 3, 4, 5, 6 } },
    .{ .good = false, .numbers = .{ 2, 2, 7, 7 } },
};
