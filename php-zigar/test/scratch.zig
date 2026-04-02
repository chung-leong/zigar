const std = @import("std");

pub const Iterator = struct {
    index: usize = 0,

    pub fn next(self: *@This()) ?usize {
        defer self.index += 1;
        return if (self.index < 10) self.index * 10 else null;
    }
};

pub fn get() Iterator {
    return .{};
}

pub const array: [4]i32 = .{ 1, 2, 3, 4 };

pub const object: struct {
    number1: i32 = 123,
    number2: i32 = 456,
} = .{};
