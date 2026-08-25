const std = @import("std");
const builtin = @import("builtin");

const c = @import("c");

pub fn truncate(file: std.Io.File, len: c_long) !void {
    const fd = switch (builtin.target.os.tag) {
        .windows => c._open_osfhandle(@as(isize, @bitCast(@intFromPtr(file.handle))), 0),
        else => file.handle,
    };
    if (c.ftruncate(fd, len) != 0) return error.UnableToTruncate;
}
