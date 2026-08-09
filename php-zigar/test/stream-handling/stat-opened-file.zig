const std = @import("std");
var threaded_io = std.Io.Threaded.init_single_threaded;

const io = threaded_io.io();

pub fn print(file: std.Io.File) !void {
    const info = try file.stat(io);
    std.debug.print("size = {d}\n", .{info.size});
    std.debug.print("ctime = {d}\n", .{info.ctime});
    std.debug.print("mtime = {d}\n", .{info.mtime});
    std.debug.print("atime = {?d}\n", .{info.atime});
}
