const std = @import("std");
const builtin = @import("builtin");

const c = @import("c");

pub fn check(file: std.fs.File) bool {
    const fd = switch (builtin.target.os.tag) {
        .windows => c._open_osfhandle(
            @bitCast(@intFromPtr(file.handle)),
            c._O_BINARY | c._O_RDONLY,
        ),
        else => file.handle,
    };
    return c.isatty(fd) != 0;
}
