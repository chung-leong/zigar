const std = @import("std");

pub fn getImports(b: *std.Build, args: anytype) []const std.Build.Module.Import {
    const zzz = b.dependency("zzz", .{
        .target = args.target,
        .optimize = args.optimize,
    }).module("zzz");
    return &.{
        .{ .name = "zzz", .module = zzz },
    };
}
