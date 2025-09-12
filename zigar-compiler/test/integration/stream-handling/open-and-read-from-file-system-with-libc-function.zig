const std = @import("std");

const c = @cImport({
    @cInclude("stdio.h");
});

pub fn hash(path: [*:0]const u8) ![std.crypto.hash.Sha1.digest_length * 2]u8 {
    const file = c.fopen(path, "r");
    if (file == null) return error.UnableToOpenFile;
    defer _ = c.fclose(file);
    var buffer: [128]u8 = undefined;
    var sha1: std.crypto.hash.Sha1 = .init(.{});
    while (true) {
        const read = c.fread(&buffer, 1, buffer.len, file);
        if (read == 0) break;
        const end: usize = @intCast(read);
        sha1.update(buffer[0..end]);
    }
    const digest = sha1.finalResult();
    return std.fmt.bytesToHex(digest, .lower);
}
