const std = @import("std");

pub const Pet = enum {
    Dog,
    Cat,
    Monkey,
};
pub var optional: ?Pet = Pet.Cat;

pub fn print() void {
    std.debug.print("{any}\n", .{optional});
}
