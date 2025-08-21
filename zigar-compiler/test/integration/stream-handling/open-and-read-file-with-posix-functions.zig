const std = @import("std");

const c = @cImport({
    @cInclude("fcntl.h");
    @cInclude("unistd.h");
});

pub fn hash(path: [*:0]const u8) ![std.crypto.hash.Sha1.digest_length * 2]u8 {
    const fd = c.open(path, c.O_RDONLY);
    if (fd <= 0) return error.UnableTOpenFile;
    defer _ = c.close(fd);
    var buffer: [128]u8 = undefined;
    var sha1: std.crypto.hash.Sha1 = .init(.{});
    var count: u32 = 0;
    while (true) {
        const read = c.read(fd, &buffer, buffer.len);
        if (read == 0) break;
        sha1.update(buffer[0..@intCast(read)]);
        count += 1;
    }
    const digest = sha1.finalResult();
    return std.fmt.bytesToHex(digest, .lower);
}
