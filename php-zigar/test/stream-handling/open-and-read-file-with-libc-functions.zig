const std = @import("std");

pub fn hash(path: [:0]const u8) ![std.crypto.hash.Sha1.digest_length * 2]u8 {
    const file = std.c.fopen(path, "r") orelse return error.UnableToOpenFile;
    defer _ = std.c.fclose(file);
    var buffer: [128]u8 = undefined;
    var sha1: std.crypto.hash.Sha1 = .init(.{});
    var count: u32 = 0;
    while (true) {
        const read = std.c.fread(&buffer, 1, buffer.len, file);
        if (read == 0) break;
        sha1.update(buffer[0..read]);
        count += 1;
    }
    const digest = sha1.finalResult();
    return std.fmt.bytesToHex(digest, .lower);
}
