const std = @import("std");

pub fn build(b: *std.Build) void {
    const optimize = b.standardOptimizeOption(.{});
    const target = b.standardTargetOptions(.{});

    const mod = b.createModule(.{
        .root_source_file = b.path("src/extension.zig"),
        .target = target,
        .optimize = optimize,
        .single_threaded = true,
        .link_libc = true,
    });

    const lib = b.addLibrary(.{
        .linkage = .static,
        .name = "php_zigar",
        .root_module = mod,
        .version = .{ .major = 1, .minor = 0, .patch = 1 },
    });

    // TODO: find a way to determine the path dynamically
    const php_path = "/home/cleong/php-src";
    lib.addIncludePath(.{ .cwd_relative = php_path });
    lib.addIncludePath(.{ .cwd_relative = php_path ++ "/main" });
    lib.addIncludePath(.{ .cwd_relative = php_path ++ "/TSRM" });
    lib.addIncludePath(.{ .cwd_relative = php_path ++ "/Zend" });

    b.installArtifact(lib);
}
