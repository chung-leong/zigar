const print = @import("std").debug.print;

pub const pi = 3.14;

pub const Types = enum { Dog, Cat, Bear };

pub fn hello(number: i32) void {
    print("Hello world ({d})\n", .{number});
}

pub fn world(number1: i16, number2: u32, number3: ?i32) void {
    print("World ({d}, {d}, {?})\n", .{ number1, number2, number3 });
}

pub const a = 5;
pub const b: u32 = 1234;

pub const value: Types = .Bear;

pub const c = 47;
