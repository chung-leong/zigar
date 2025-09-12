const std = @import("std");

pub fn getImports(b: *std.Build, args: anytype) []const std.Build.Module.Import {
    const libffmpeg = b.dependency("libffmpeg", .{
        .target = args.target,
        .optimize = args.optimize,
    });
    const ffmpeg = libffmpeg.artifact("ffmpeg");
    args.library.linkLibrary(ffmpeg);
    return &.{};
}
