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
    if (@hasField(c.struct_stat, "st_ctim")) {
        std.debug.print("ctime = {d},{d}\n", .{ info.st_ctim.tv_sec, info.st_ctim.tv_nsec });
        std.debug.print("mtime = {d},{d}\n", .{ info.st_mtim.tv_sec, info.st_mtim.tv_nsec });
        std.debug.print("atime = {d},{d}\n", .{ info.st_atim.tv_sec, info.st_atim.tv_nsec });
    } else if (@hasField(c.struct_stat, "st_ctimespec")) {
        // MacOS
        std.debug.print("ctime = {d},{d}\n", .{ info.st_ctimespec.tv_sec, info.st_ctimespec.tv_nsec });
        std.debug.print("mtime = {d},{d}\n", .{ info.st_mtimespec.tv_sec, info.st_mtimespec.tv_nsec });
        std.debug.print("atime = {d},{d}\n", .{ info.st_atimespec.tv_sec, info.st_atimespec.tv_nsec });
    } else if (@hasField(c.struct_stat, "st_ctime")) {
        // Windows
        std.debug.print("ctime = {d},{d}\n", .{ info.st_ctime, 0 });
        std.debug.print("mtime = {d},{d}\n", .{ info.st_mtime, 0 });
        std.debug.print("atime = {d},{d}\n", .{ info.st_atime, 0 });
    }
}
