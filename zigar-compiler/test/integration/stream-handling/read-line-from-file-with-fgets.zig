const std = @import("std");

const zigar = @import("zigar");

const stdio = @cImport({
    @cInclude("stdio.h");
});

var gpa = std.heap.GeneralPurposeAllocator(.{}){};

pub fn print(file: std.fs.File, promise: zigar.function.Promise(void)) !void {
    const thread = try std.Thread.spawn(.{
        .allocator = gpa.allocator(),
    }, run, .{ file.handle, promise });
    thread.detach();
}

fn run(fd: c_int, promise: zigar.function.Promise(void)) !void {
    const file = stdio.fdopen(fd, "r") orelse return error.UnableToCreateFile;
    var buffer: [128]u8 = undefined;
    while (true) {
        const result = stdio.fgets(&buffer, @intCast(buffer.len), file);
        if (result == null) break;
        const line: [*:0]const u8 = @ptrCast(result);
        std.debug.print("> {s}", .{line});
    }
    promise.resolve({});
}

pub fn startup() !void {
    try zigar.thread.use();
}

pub fn shutdown() void {
    zigar.thread.end();
}
