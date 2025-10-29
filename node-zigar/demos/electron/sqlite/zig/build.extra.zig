const std = @import("std");

pub fn getImports(b: *std.Build, args: anytype) []const std.Build.Module.Import {
    const sqlite = b.dependency("sqlite", .{
        .target = args.target,
        .optimize = args.optimize,
    }).module("sqlite");
    return &.{
        .{ .name = "sqlite", .module = sqlite },
    };
}
