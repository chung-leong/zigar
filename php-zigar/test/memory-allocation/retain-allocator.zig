const std = @import("std");

const F64Map = std.StringArrayHashMap(f64);

pub const Duplicator = struct {
    allocator: std.mem.Allocator,

    pub fn dupe(self: *@This(), string: []const u8) ![]const u8 {
        return self.allocator.dupe(u8, string);
    }
};

pub fn create(allocator: std.mem.Allocator) Duplicator {
    return .{ .allocator = allocator };
}
