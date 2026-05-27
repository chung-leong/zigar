const std = @import("std");

pub const Address = struct {
    street: []const u8,
    city: []const u8,
    state: [2]u8,
    zipCode: u32,
};
pub const User = struct {
    id: u64,
    name: []const u8,
    email: []const u8,
    age: ?u32 = null,
    popularity: i64 = -1,
    address: ?Address,

    pub fn print(self: User) void {
        std.debug.print("Name: {s}\n", .{self.name});
        std.debug.print("E-mail: {s}\n", .{self.email});
        if (self.age) |age| {
            std.debug.print("Age: {d}\n", .{age});
        }
        std.debug.print("Popularity: {d}\n", .{self.popularity});
        if (self.address) |address| {
            std.debug.print("Street: {s}\n", .{address.street});
            std.debug.print("City: {s}\n", .{address.city});
            std.debug.print("State: {s}\n", .{address.state});
            std.debug.print("ZIP code: {d}\n", .{address.zipCode});
        }
    }
};
