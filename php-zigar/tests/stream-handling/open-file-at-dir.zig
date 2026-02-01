const std = @import("std");

pub fn print(dir: std.fs.Dir, name: []const u8) !void {
    const file = try dir.openFile(name, .{});
    defer file.close();
    var stderr_buffer: [1024]u8 = undefined;
    var stderr_writer = std.fs.File.stdout().writer(&stderr_buffer);
    const stderr = &stderr_writer.interface;
    while (true) {
        var buffer: [8]u8 = undefined;
        const len = try file.read(&buffer);
        if (len == 0) break;
        _ = try stderr.write(buffer[0..len]);
    }
    try stderr.flush();
}
