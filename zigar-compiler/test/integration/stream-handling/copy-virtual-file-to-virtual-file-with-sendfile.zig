const std = @import("std");

pub fn copy(src: std.fs.File, dest: std.fs.File, len: usize) !usize {
    const sent = std.c.sendfile(dest.handle, src.handle, null, len);
    if (sent < 0) return error.UnableToSendFile;
    return @intCast(sent);
}
