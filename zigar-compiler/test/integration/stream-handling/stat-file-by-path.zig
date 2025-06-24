const std = @import("std");

pub fn print(path: []const u8) void {
    if (std.posix.fstatat(3, path, 0)) |info| {
        std.debug.print("size = {d}\n", .{info.size});
        std.debug.print("ctime = {d}\n", .{info.ctim.nsec});
        std.debug.print("mtime = {d}\n", .{info.mtim.nsec});
        std.debug.print("atime = {d}\n", .{info.atim.nsec});
    } else |err| {
        std.debug.print("error = {}\n", .{err});
    }
}
