const std = @import("std");

pub fn print(file: std.fs.File) !void {
    const info = try file.stat();
    std.debug.print("size = {d}\n", .{info.size});
    if (@hasField(@TypeOf(info), "st_ctime")) {
        std.debug.print("ctime = {d},{d}\n", .{ info.st_ctim.tv_sec, info.st_ctim.tv_nsec });
        std.debug.print("mtime = {d},{d}\n", .{ info.st_mtim.tv_sec, info.st_mtim.tv_nsec });
        std.debug.print("atime = {d},{d}\n", .{ info.st_atim.tv_sec, info.st_atim.tv_nsec });
    } else if (@hasField(@TypeOf(info), "st_ctimespec")) {
        // MacOS
        std.debug.print("ctime = {d},{d}\n", .{ info.st_ctimespec.tv_sec, info.st_ctimespec.tv_nsec });
        std.debug.print("mtime = {d},{d}\n", .{ info.st_mtimespec.tv_sec, info.st_mtimespec.tv_nsec });
        std.debug.print("atime = {d},{d}\n", .{ info.st_atimespec.tv_sec, info.st_atimespec.tv_nsec });
    }
}
