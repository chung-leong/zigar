const std = @import("std");

pub const StructA = struct {
    number1: u32,
    comptime number2: i32 = 77,
    //comptime string: []const u8 = "Hello",
    //comptime number3: comptime_int = 77,
};

test "StructA" {
    var test_struct: StructA = .{};
    std.debug.print("\n{any}\n", .{test_struct});
}

const StructB = struct {
    comptime number1: i32 = 77,
    comptime number_type: type = i32,
    comptime number2: i32 = 123,
};
