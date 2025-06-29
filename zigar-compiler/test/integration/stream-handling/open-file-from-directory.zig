const std = @import("std");

pub fn print(dir: std.fs.Dir) !void {
    var iter = dir.iterate();
    var stderr = std.io.getStdErr();
    while (try iter.next()) |entry| {
        if (entry.kind == .file) {
            std.debug.print("{s}:\n", .{entry.name});
            const file = try dir.openFile(entry.name, .{});
            defer file.close();
            while (true) {
                var buffer: [8]u8 = undefined;
                const len = try file.read(&buffer);
                if (len == 0) break;
                _ = try stderr.write(buffer[0..len]);
            }
            std.debug.print("\n", .{});
        }
    }
}
