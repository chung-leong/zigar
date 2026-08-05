const std = @import("std");

pub fn sha1(bytes: []const u8) [std.crypto.hash.Sha1.digest_length]u8 {
    var digest: [std.crypto.hash.Sha1.digest_length]u8 = undefined;
    std.crypto.hash.Sha1.hash(bytes, &digest, .{});
    return digest;
}
