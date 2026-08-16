const std = @import("std");

const cfg = @import("build.cfg.zig");

pub fn getCSourceFiles(_: *std.Build, _: anytype) []const []const u8 {
    return &.{
        cfg.module_dir ++ "pthread.c",
    };
}
