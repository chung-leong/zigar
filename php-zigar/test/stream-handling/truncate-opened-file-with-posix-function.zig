const std = @import("std");

const c = @import("c");

pub fn truncate(file: std.fs.File, len: c_long) !void {
    const fd = switch (@typeInfo(@TypeOf(file.handle))) {
        .pointer => c._open_osfhandle(@bitCast(@intFromPtr(file.handle)), 0),
        else => file.handle,
    };
    if (c.ftruncate(fd, len) != 0) return error.UnableToTruncate;
}
