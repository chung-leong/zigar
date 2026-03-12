const std = @import("std");

pub fn md5(bytes: []const u8) [std.crypto.hash.Md5.digest_length]u8 {
    var digest: [std.crypto.hash.Md5.digest_length]u8 = undefined;
    std.crypto.hash.Md5.hash(bytes, &digest, .{});
    return digest;
}
