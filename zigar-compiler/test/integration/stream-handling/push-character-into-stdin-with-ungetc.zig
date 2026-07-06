const std = @import("std");
const builtin = @import("builtin");

const c = @import("c");

const os = switch (builtin.target.os.tag) {
    .linux => .linux,
    .driverkit, .ios, .macos, .tvos, .visionos, .watchos => .darwin,
    .windows => .windows,
    else => .unknown,
};

pub fn push(c: c_int) void {
    const stdin = switch (os) {
        .darwin => c.stdin(),
        .windows => c.__acrt_iob_func(0),
        else => c.stdin,
    };
    _ = c.ungetc(c, stdin);
}

pub fn get() c_int {
    return c.getchar();
}
