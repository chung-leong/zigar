const print = @import("std").debug.print;

pub const pi = 3.14;

pub const Types = enum { Dog, Cat, Bear };

pub fn hello() void {
    print("Hello world\n", .{});
}

pub fn world() void {
    print("World\n", .{});
}

pub const a = 5;
pub const b: u32 = 1234;

pub const value: Types = .Bear;

pub const c = 47;
