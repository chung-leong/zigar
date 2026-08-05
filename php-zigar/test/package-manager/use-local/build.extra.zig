const std = @import("std");

pub fn getImports(b: *std.Build, args: anytype) []const std.Build.Module.Import {
    const foo = b.dependency("foo", .{
        .target = args.target,
        .optimize = args.optimize,
    }).module("foo");
    return &.{
        .{ .name = "foo", .module = foo },
    };
}
