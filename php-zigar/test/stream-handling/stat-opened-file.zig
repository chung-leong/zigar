const std = @import("std");

pub fn print(file: std.fs.File) !void {
    const info = try file.stat();
    std.debug.print("size = {d}\n", .{info.size});
    std.debug.print("ctime = {d}\n", .{info.ctime});
    std.debug.print("mtime = {d}\n", .{info.mtime});
    std.debug.print("atime = {d}\n", .{info.atime});
}
