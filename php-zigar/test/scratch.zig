const std = @import("std");

const Options = struct {
    version: i32 = 2,
    uppercase: bool = true,
};

pub fn sha(allocator: std.mem.Allocator, bytes: []const u8, options: Options) ![]const u8 {
    std.debug.print("{}\n", .{options});
    return inline for (.{
        std.crypto.hash.Sha1,
        std.crypto.hash.sha2.Sha256,
        std.crypto.hash.sha3.Sha3_256,
    }, 0..) |Algo, index| {
        if (options.version == index + 1) {
            var digest: [Algo.digest_length]u8 = undefined;
            Algo.hash(bytes, &digest, .{});
            const case: std.fmt.Case = if (options.uppercase) .upper else .lower;
            const hex = std.fmt.bytesToHex(digest, case);
            return try allocator.dupe(u8, &hex);
        }
    } else error.UnrecognizedVersion;
}
