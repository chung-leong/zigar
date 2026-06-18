const std = @import("std");
const CityHash64 = std.hash.cityhash.CityHash64;

const Options = struct {
    seed: ?u64 = null,
    seeds: ?[2]u64 = null,
    uppercase: bool = false,
};

pub fn hash(allocator: std.mem.Allocator, data: []const u8, options: Options) ![]const u8 {
    const value = if (options.seeds) |seeds|
        CityHash64.hashWithSeeds(data, seeds[0], seeds[1])
    else if (options.seed) |seed|
        CityHash64.hashWithSeed(data, seed)
    else
        CityHash64.hash(data);
    return if (options.uppercase)
        try std.fmt.allocPrint(allocator, "{X}", .{value})
    else
        try std.fmt.allocPrint(allocator, "{x}", .{value});
}

const module_ns = @This();
pub const @"meta(zigar)" = struct {
    pub fn isDeclString(comptime T: type, comptime name: std.meta.DeclEnum(T)) bool {
        return switch (T) {
            module_ns => switch (name) {
                .hash => true,
                else => false,
            },
            else => false,
        };
    }
};
