const std = @import("std");

pub fn getImports(b: *std.Build, args: anytype) []const std.Build.Module.Import {
    const libqt6zig = b.dependency("libqt6zig", .{
        .target = args.target,
        .optimize = args.optimize,
    }).module("libqt6zig");
    return &.{
        .{ .name = "libqt6zig", .module = libqt6zig },
    };
}
