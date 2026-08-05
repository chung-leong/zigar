const std = @import("std");

pub const Pet = enum {
    dog,
    cat,
    monkey,
};
pub var optional: ?Pet = Pet.cat;

pub fn print() void {
    std.debug.print("{any}\n", .{optional});
}
