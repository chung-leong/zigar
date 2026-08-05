const std = @import("std");

const c = @import("c");

pub fn makeDirectory(path: [*:0]const u8, name: [*:0]const u8) !void {
    const dirfd = c.open(path, c.O_DIRECTORY | c.O_RDONLY);
    if (dirfd < 0) return error.UnableToOpenDirectory;
    defer _ = c.close(dirfd);
    const result = c.mkdirat(dirfd, name, 0o777);
    if (result < 0) return error.UnableToCreateDirectory;
}
