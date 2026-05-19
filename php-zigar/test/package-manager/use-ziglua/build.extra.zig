const std = @import("std");

pub fn getImports(b: *std.Build, args: anytype) []const std.Build.Module.Import {
    const zlua = b.dependency("zlua", .{
        .target = args.target,
        .optimize = args.optimize,
    }).module("zlua");
    return &.{
        .{ .name = "zlua", .module = zlua },
    };
}
