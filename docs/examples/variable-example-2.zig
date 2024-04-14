const std = @import("std");

pub const User = struct {
    name: []const u8,
    role: []const u8,
};

pub const default_user: User = .{
    .name = "nobody",
    .role = "none",
};
pub var current_user: *const User = &default_user;

pub fn printCurrentUser() void {
    std.debug.print("{s} ({s})\n", .{ current_user.name, current_user.role });
}
