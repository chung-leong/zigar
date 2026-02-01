const std = @import("std");

const c = @cImport({
    @cInclude("fcntl.h");
    @cInclude("unistd.h");
});

pub fn hash(path: [*:0]const u8) ![std.crypto.hash.Sha1.digest_length * 2]u8 {
    const fd = c.open(path, c.O_RDONLY);
    if (fd < 0) return error.UnableToOpenFile;
    defer _ = c.close(fd);
    var buffer: [128]u8 = undefined;
    var sha1: std.crypto.hash.Sha1 = .init(.{});
    while (true) {
        const read = c.read(fd, &buffer, buffer.len);
        if (read == 0) break;
        const end: usize = @intCast(read);
        sha1.update(buffer[0..end]);
    }
    const digest = sha1.finalResult();
    return std.fmt.bytesToHex(digest, .lower);
}
