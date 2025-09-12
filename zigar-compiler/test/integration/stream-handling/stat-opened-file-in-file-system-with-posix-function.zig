const std = @import("std");

const c = @cImport({
    @cInclude("sys/stat.h");
    @cInclude("unistd.h");
    @cInclude("fcntl.h");
});

pub fn print(path: [*:0]const u8) !void {
    const fd = c.open(path, c.O_RDONLY);
    if (fd < 0) return error.UnableToOpenFile;
    defer _ = c.close(fd);
    var info: c.struct_stat = undefined;
    const result = c.fstat(fd, &info);
    if (result != 0) return error.UnableToGetStat;
    std.debug.print("size = {d}\n", .{info.st_size});
}
