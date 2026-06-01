const std = @import("std");
const CityHash64 = std.hash.cityhash.CityHash64;

// pub fn hash(data: []const u8) ![16]u8 {
//     const value = std.hash.cityhash.CityHash64.hash(data);
//     var buf: [16]u8 = undefined;
//     _ = try std.fmt.bufPrint(&buf, "{x}", .{value});
//     return buf;
// }

const Options = struct {
    seed: ?u64 = null,
    seeds: ?[2]u64 = null,
    uppercase: bool = false,
};

pub fn hash(data: []const u8, options: Options) ![16]u8 {
    const value = if (options.seeds) |seeds|
        CityHash64.hashWithSeeds(data, seeds[0], seeds[1])
    else if (options.seed) |seed|
        CityHash64.hashWithSeed(data, seed)
    else
        CityHash64.hash(data);
    var buf: [16]u8 = undefined;
    if (options.uppercase) {
        _ = try std.fmt.bufPrint(&buf, "{X}", .{value});
    } else {
        _ = try std.fmt.bufPrint(&buf, "{x}", .{value});
    }
    return buf;
}
