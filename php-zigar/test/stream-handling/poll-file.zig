const std = @import("std");

const zigar = @import("zigar");

var gpa = std.heap.GeneralPurposeAllocator(.{}){};

pub fn poll(file1: std.fs.File, file2: std.fs.File) !c_int {
    var files: [2]std.c.pollfd = .{
        .{ .fd = file1.handle, .events = std.c.POLL.IN, .revents = 0 },
        .{ .fd = file2.handle, .events = std.c.POLL.IN, .revents = 0 },
    };
    return std.c.poll(&files, files.len, 1000);
}
