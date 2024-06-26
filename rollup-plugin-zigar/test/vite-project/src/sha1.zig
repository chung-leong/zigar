const std = @import("std");

pub fn sha1(bytes: []const u8) [std.crypto.hash.Sha1.digest_length * 2]u8 {
    var digest: [std.crypto.hash.Sha1.digest_length]u8 = undefined;
    std.crypto.hash.Sha1.hash(bytes, &digest, .{});
    return std.fmt.bytesToHex(digest, .lower);
}

const string = @cImport(
    @cInclude("string.h"),
);

pub fn getLength(s: [:0]const u8) usize {
    return string.strlen(s);
}
