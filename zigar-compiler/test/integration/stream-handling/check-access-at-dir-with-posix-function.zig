const std = @import("std");

const c = @cImport({
    @cInclude("unistd.h");
    @cInclude("fcntl.h");
});

const Flags = struct {
    read: bool = false,
    write: bool = false,
    execute: bool = false,
};

pub fn check(dir_path: [*:0]const u8, path: [*:0]const u8, flags: Flags) !bool {
    const dirfd = c.open(dir_path, c.O_DIRECTORY);
    if (dirfd == -1) return error.UnableToOpenDirectory;
    defer _ = c.close(dirfd);
    var mode: c_int = 0;
    if (flags.read) mode |= c.R_OK;
    if (flags.write) mode |= c.W_OK;
    if (flags.execute) mode |= c.X_OK;
    const result = c.faccessat(dirfd, path, c.AT_SYMLINK_NOFOLLOW, mode);
    return result == 0;
}
