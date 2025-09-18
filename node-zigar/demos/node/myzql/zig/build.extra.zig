const std = @import("std");

pub fn getImports(b: *std.Build, args: anytype) []const std.Build.Module.Import {
    const myzql = b.dependency("myzql", .{
        .target = args.target,
        .optimize = args.optimize,
    }).module("myzql");
    return &.{
        .{ .name = "myzql", .module = myzql },
    };
}
