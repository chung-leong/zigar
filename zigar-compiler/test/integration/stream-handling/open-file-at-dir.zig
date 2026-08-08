const std = @import("std");
var threaded_io = std.Io.Threaded.init_single_threaded;

const io = threaded_io.io();

pub fn print(dir: std.Io.Dir, name: []const u8) !void {
    const file = try dir.openFile(io, name, .{});
    defer file.close(io);
    var stderr_buffer: [1024]u8 = undefined;
    var stderr_writer = std.Io.File.stdout().writer(io, &stderr_buffer);
    const stderr = &stderr_writer.interface;
    while (true) {
        var buffer: [8]u8 = undefined;
        const slices: [1][]u8 = .{&buffer};
        const len = file.readStreaming(io, slices[0..]) catch |err| switch (err) {
            error.EndOfStream => break,
            else => return err,
        };
        _ = try stderr.write(buffer[0..len]);
    }
    try stderr.flush();
}
