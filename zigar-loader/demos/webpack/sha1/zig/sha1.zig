const std = @import("std");

pub fn sha1(bytes: []const u8) [std.crypto.hash.Sha1.digest_length * 2]u8 {
    var digest: [std.crypto.hash.Sha1.digest_length]u8 = undefined;
    std.crypto.hash.Sha1.hash(bytes, &digest, .{});
    return std.fmt.bytesToHex(digest, .lower);
}

pub const @"meta(zigar)" = struct {
    pub fn isDeclString(comptime T: type, comptime _: std.meta.DeclEnum(T)) bool {
        return true;
    }

    pub fn isFieldString(comptime T: type, comptime _: std.meta.FieldEnum(T)) bool {
        return true;
    }
};
