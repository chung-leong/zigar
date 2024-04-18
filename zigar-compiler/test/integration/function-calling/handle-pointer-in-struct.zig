const std = @import("std");

pub const User = struct {
    name: []const u8,
    age: u32,

    pub fn print1(self: User) void {
        std.debug.print("{s}\n", .{self.name});
    }

    pub fn print2(self: *User) void {
        std.debug.print("{s}\n", .{self.name});
    }

    pub fn print3(self: *const User) void {
        std.debug.print("{s} {d}\n", .{ self.name, self.age });
    }
};
