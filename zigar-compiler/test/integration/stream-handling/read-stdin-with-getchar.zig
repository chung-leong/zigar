const std = @import("std");

const stdio = @cImport({
    @cInclude("stdio.h");
});

pub fn print() !void {
    while (true) {
        const result = stdio.getchar();
        if (result < 0) break;
        const c: u8 = @intCast(result);
        std.debug.print("{c}", .{c});
    }
}
