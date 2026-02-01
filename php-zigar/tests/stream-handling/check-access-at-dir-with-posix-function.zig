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

pub fn check(dir: std.fs.Dir, path: [*:0]const u8, flags: Flags) !bool {
    var mode: c_int = 0;
    if (flags.read) mode |= c.R_OK;
    if (flags.write) mode |= c.W_OK;
    if (flags.execute) mode |= c.X_OK;
    const result = c.faccessat(dir.fd, path, mode, 0);
    return result == 0;
}
