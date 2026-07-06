const std = @import("std");

const c = @import("c");

pub fn print(f: std.fs.File) !void {
    const fd = switch (@typeInfo(@TypeOf(f.handle))) {
        .pointer => c._open_osfhandle(@bitCast(@intFromPtr(f.handle)), c.O_RDONLY),
        .int => f.handle,
        else => @compileError("Unexpected"),
    };
    const file = c.fdopen(fd, "r") orelse return error.UnableToOpenFile;
    defer _ = c.fclose(file);
    while (true) {
        const result = c.fgetc(file);
        if (result < 0) break;
        const char: u8 = @intCast(result);
        std.debug.print("{c}", .{char});
    }
}
