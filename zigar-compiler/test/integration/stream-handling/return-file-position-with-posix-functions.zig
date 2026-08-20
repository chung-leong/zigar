const std = @import("std");
const builtin = @import("builtin");

const c = @import("c");

const lseek = switch (builtin.target.cpu.arch.isWasm()) {
    true => @extern(*const fn (c_int, c.off_t, c_int) callconv(.c) c.off_t, .{
        .name = "__lseek",
    }),
    false => c.lseek,
};

pub fn seek(path: [*:0]const u8, offset: isize) !isize {
    const fd = c.open(path, c.O_RDONLY);
    if (fd < 0) return error.UnableToOpenFile;
    defer _ = c.close(fd);
    const pos = lseek(fd, @intCast(offset), c.SEEK_END);
    if (pos < 0) return error.UnableToSeekFile;
    return @intCast(lseek(fd, 0, c.SEEK_CUR));
}
