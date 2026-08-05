const c = @import("c");

pub fn dump(path: [*:0]const u8) !void {
    const fd = c.open(path, c.O_RDONLY);
    if (fd < 0) return error.UnableToOpenFile;
    defer _ = c.close(fd);
    while (true) {
        var buf: [128]u8 = undefined;
        const read = c.read(fd, &buf, buf.len);
        if (read < 0) return error.UnableToReadFile;
        if (read == 0) break;
        _ = c.write(2, &buf, @intCast(read));
    }
}
