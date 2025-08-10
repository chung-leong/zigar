const std = @import("std");

const c = @cImport({
    @cInclude("sys/stat.h");
    @cInclude("unistd.h");
});

pub fn print(path: []const u8) !void {
    const fd = try std.c.open(path, .{ .ACCMODE = .RDONLY }, 0);
    defer std.c.close(fd);
    var info: c.struct_stat = undefined;
    const result = c.fstat(fd, &info);
    if (result != 0) return error.UnableToGetStat;
    std.debug.print("size = {d}\n", .{info.st_size});
    std.debug.print("ctime = {d},{d}\n", .{ info.st_ctim.tv_sec, info.st_ctim.tv_nsec });
    std.debug.print("mtime = {d},{d}\n", .{ info.st_mtim.tv_sec, info.st_mtim.tv_nsec });
    std.debug.print("atime = {d},{d}\n", .{ info.st_atim.tv_sec, info.st_atim.tv_nsec });
}
