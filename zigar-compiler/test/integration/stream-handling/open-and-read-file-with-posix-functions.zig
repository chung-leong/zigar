const std = @import("std");

pub fn hash(path: []const u8) ![std.crypto.hash.Sha1.digest_length * 2]u8 {
    const fd = try std.posix.open(path, .{ .ACCMODE = .RDONLY }, 0);
    defer std.posix.close(fd);
    var buffer: [128]u8 = undefined;
    var sha1: std.crypto.hash.Sha1 = .init(.{});
    var count: u32 = 0;
    while (true) {
        const read = try std.posix.read(fd, &buffer);
        if (read == 0) break;
        sha1.update(buffer[0..read]);
        count += 1;
    }
    const digest = sha1.finalResult();
    return std.fmt.bytesToHex(digest, .lower);
}
