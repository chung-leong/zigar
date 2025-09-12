const std = @import("std");

const c = @cImport({
    @cInclude("unistd.h");
    @cInclude("fcntl.h");
    @cInclude("sys/stat.h");
});

pub fn stat(dir_path: [*:0]const u8, path: [*:0]const u8) !void {
    const dirfd = c.openat(c.AT_FDCWD, dir_path, c.O_DIRECTORY);
    if (dirfd < 0) return error.UnableToOpenDirectory;
    var info: c.struct_stat = undefined;
    if (c.fstatat(dirfd, path, &info, 0) != 0) return error.UnableToGetStat;
    std.debug.print("size = {d}\n", .{info.st_size});
}
