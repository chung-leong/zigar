const std = @import("std");
const builtin = @import("builtin");

pub fn copy(src: std.fs.File, dest: std.fs.File, len: usize) !usize {
    if (builtin.target.os.tag == .linux) {
        const sent = std.c.sendfile(dest.handle, src.handle, null, len);
        if (sent < 0) return error.UnableToSendFile;
        return @intCast(sent);
    } else if (builtin.target.os.tag.isDarwin()) {
        var sent: std.c.off_t = 0;
        if (std.c.sendfile(src.handle, dest.handle, 0, &sent, null, 0) != 0) {
            return error.UnableToSendFile;
        }
        return @intCast(sent);
    } else {
        return error.NoSupport;
    }
}
