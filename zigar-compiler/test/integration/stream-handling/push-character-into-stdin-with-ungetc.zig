const std = @import("std");
const builtin = @import("builtin");

const stdio = @cImport({
    @cInclude("stdio.h");
});

const os = switch (builtin.target.os.tag) {
    .linux => .linux,
    .driverkit, .ios, .macos, .tvos, .visionos, .watchos => .darwin,
    .windows => .windows,
    else => .unknown,
};

pub fn push(c: c_int) void {
    const stdin = switch (os) {
        .darwin => stdio.stdin(),
        .windows => stdio.__acrt_iob_func(0),
        else => stdio.stdin,
    };
    _ = stdio.ungetc(c, stdin);
}

pub fn get() c_int {
    return stdio.getchar();
}
