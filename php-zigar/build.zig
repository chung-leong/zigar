const std = @import("std");

pub fn build(b: *std.Build) void {
    const optimize = b.standardOptimizeOption(.{});
    const target = b.standardTargetOptions(.{});

    const mod = b.createModule(.{
        .root_source_file = b.path("src/extension.zig"),
        .target = target,
        .optimize = optimize,
        .link_libc = true,
    });
    const lib = b.addLibrary(.{
        .linkage = .static,
        .name = "php_zigar",
        .root_module = mod,
        .version = .{ .major = 1, .minor = 0, .patch = 1 },
    });

    // TODO: find a way to determine the path dynamically
    lib.addIncludePath(.{ .cwd_relative = "/usr/include/php/20210902" });
    lib.addIncludePath(.{ .cwd_relative = "/usr/include/php/20210902/main" });
    lib.addIncludePath(.{ .cwd_relative = "/usr/include/php/20210902/TSRM" });
    lib.addIncludePath(.{ .cwd_relative = "/usr/include/php/20210902/Zend" });

    b.installArtifact(lib);
}
