const std = @import("std");

const c = @cImport({
    @cInclude("unistd.h");
});

const Flags = struct {
    read: bool = false,
    write: bool = false,
    execute: bool = false,
};

pub fn check(path: [*:0]const u8, flags: Flags) bool {
    var mode: c_int = 0;
    if (flags.read) mode |= c.R_OK;
    if (flags.write) mode |= c.W_OK;
    if (flags.execute) mode |= c.X_OK;
    const result = c.access(path, mode);
    return result == 0;
}
