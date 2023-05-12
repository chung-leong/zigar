const print = @import("std").debug.print;

pub const pi = 3.14;

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
