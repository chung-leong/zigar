const std = @import("std");

const c = @cImport({
    @cInclude("unistd.h");
    @cInclude("fcntl.h");
    @cInclude("sys/stat.h");
});

pub fn stat(dir_path: [*:0]const u8, path: [*:0]const u8) !void {
    const dirfd = c.open(dir_path, c.O_DIRECTORY);
    if (dirfd == -1) return error.UnableToOpenDirectory;
    defer _ = c.close(dirfd);
    var info: c.struct_stat = undefined;
    if (c.fstatat(dirfd, path, &info, 0) != 0) return error.UnableToGetStat;
    std.debug.print("size = {d}\n", .{info.st_size});
    std.debug.print("ctime = {d},{d}\n", .{ info.st_ctim.tv_sec, info.st_ctim.tv_nsec });
    std.debug.print("mtime = {d},{d}\n", .{ info.st_mtim.tv_sec, info.st_mtim.tv_nsec });
    std.debug.print("atime = {d},{d}\n", .{ info.st_atim.tv_sec, info.st_atim.tv_nsec });
}
