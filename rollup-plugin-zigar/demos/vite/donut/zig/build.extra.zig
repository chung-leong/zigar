const std = @import("std");

const cfg = @import("build.cfg.zig");

pub fn getCSourceFiles(_: *std.Build, args: anytype) []const []const u8 {
    args.module.addCSourceFile(.{
        .file = .{ .cwd_relative = cfg.module_dir ++ "donut.c" },
        .flags = &.{"-std=c89"},
    });
    return &.{};
}
