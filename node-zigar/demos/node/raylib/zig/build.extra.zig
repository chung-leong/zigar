const std = @import("std");

pub fn getCSourceFiles(b: *std.Build, args: anytype) []const []const u8 {
    const raylib = b.dependency("raylib", .{
        .target = args.target,
        .optimize = args.optimize,
    });
    args.library.linkLibrary(raylib.artifact("raylib"));
    args.module.addIncludePath(raylib.path("src"));
    return &.{};
}
