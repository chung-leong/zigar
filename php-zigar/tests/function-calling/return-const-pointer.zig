const std = @import("std");

pub const Address = struct {
    street: []const u8,
    city: []const u8,
    state: []const u8,
    zip: u32,
};
pub const User = struct {
    name: []const u8,
    age: u32,
    address: ?Address,
};

pub fn getUser(allocator: std.mem.Allocator) !*const User {
    var user = try allocator.create(User);
    user.name = try allocator.dupe(u8, "Bobby Smith");
    user.age = 19;
    user.address = .{
        .street = try allocator.dupe(u8, "123 Seasame street"),
        .city = try allocator.dupe(u8, "Springfield"),
        .state = try allocator.dupe(u8, "IL"),
        .zip = 12345,
    };
    return user;
}
