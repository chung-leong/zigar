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

pub const vector: @Vector(4, f64) = .{
    1 * std.math.pi,
    2 * std.math.pi,
    3 * std.math.pi,
    4 * std.math.pi,
};

pub const slice: []const i32 = &array;

pub const struct_instance: struct {
    number1: i32 = 123,
    number2: i32 = 456,

    pub fn @"get chicken"(_: *@This()) i32 {
        return 777;
    }

    pub fn @"get\t \tduck"(_: *@This()) i32 {
        return 778;
    }

    pub fn @"get\t\nquail "(_: *@This()) i32 {
        return 779;
    }
} = .{};

pub const Union = union(enum) {
    number1: i32,
    number2: i32,
};
pub const union_instance: Union = .{ .number2 = 123 };

pub const UnionPtr = *Union;

pub const bare_union_instance: union {
    number1: i32,
    number2: i32,
} = .{ .number2 = 123 };

pub const namespace = struct {
    pub const number1: i32 = 123;
    pub const number2: i32 = 456;
    pub const number3: i32 = 789;

    pub fn foo() void {}
};
