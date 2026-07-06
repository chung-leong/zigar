const std = @import("std");

const c = @import("c");

pub fn print() !void {
    while (true) {
        const result = c.getchar();
        if (result < 0) break;
        const char: u8 = @intCast(result);
        std.debug.print("{c}", .{char});
    }
}
