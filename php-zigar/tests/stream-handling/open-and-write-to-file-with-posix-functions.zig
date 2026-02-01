const c = @cImport({
    @cInclude("fcntl.h");
    @cInclude("unistd.h");
});

pub fn save(path: [*:0]const u8, data: []const u8) !usize {
    const fd = c.open(path, c.O_WRONLY | c.O_CREAT | c.O_TRUNC, @as(c_uint, 0o666));
    if (fd < 0) return error.UnableToOpenFile;
    defer _ = c.close(fd);
    const count = c.write(fd, data.ptr, @intCast(data.len));
    if (count < 0) return error.UnableToWriteToFile;
    return @intCast(count);
}
