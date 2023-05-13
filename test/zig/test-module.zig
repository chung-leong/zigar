const print = @import("std").debug.print;

const private = 1234;

pub const uint8: u8 = 150;
pub const int16: i16 = 1234;
pub const uint32: u32 = 69000;
pub const float = 3.14;

pub const Types = enum { Dog, Cat, Bear };

pub fn hello(number: f16) void {
    print("Hello world ({d})\n", .{number});
}

pub fn world(s: []const u16) void {
    print("World ({d}, {d})\n", .{ s[0], s[1] });
}

pub const a = 5;
pub const b: u32 = 1234;

pub const value: Types = .Bear;

pub const c = 47;
