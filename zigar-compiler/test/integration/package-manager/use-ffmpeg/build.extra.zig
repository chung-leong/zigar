const std = @import("std");

pub fn getCSourceFiles(b: *std.Build, args: anytype) []const []const u8 {
    const libffmpeg = b.dependency("libffmpeg", .{
        .target = args.target,
        .optimize = args.optimize,
    });
    args.library.linkLibrary(libffmpeg.artifact("ffmpeg"));
    args.module.addIncludePath(libffmpeg.path("."));
    const target = args.target.result;
    const avconfig_h = b.addConfigHeader(.{
        .style = .blank,
        .include_path = "libavutil/avconfig.h",
    }, .{
        .AV_HAVE_BIGENDIAN = target.cpu.arch.endian() == .big,
        .AV_HAVE_FAST_UNALIGNED = switch (target.cpu.arch) {
            .x86_64 => true,
            else => false,
        },
    });
    args.module.addConfigHeader(avconfig_h);
    return &.{};
}
