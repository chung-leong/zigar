const std = @import("std");

pub fn getImports(b: *std.Build, args: anytype) []const std.Build.Module.Import {
    const sqlite = b.dependency("sqlite", .{
        .target = args.target,
        .optimize = args.optimize,
        .threadsafe = 1,
        .fts5 = true,
    });
    return &.{
        .{ .name = "sqlite", .module = sqlite.module("sqlite") },
    };
}
