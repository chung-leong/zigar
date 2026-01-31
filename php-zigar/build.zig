const std = @import("std");

pub fn build(b: *std.Build) !void {
    const optimize = b.standardOptimizeOption(.{});
    const target = b.standardTargetOptions(.{});

    const mod = b.createModule(.{
        .root_source_file = b.path("src/extension.zig"),
        .target = target,
        .optimize = optimize,
        .single_threaded = true,
        .link_libc = true,
    });
    // mod.stack_check = false;

    const lib = b.addLibrary(.{
        .linkage = .dynamic,
        .name = "php_zigar",
        .root_module = mod,
        .version = .{ .major = 1, .minor = 0, .patch = 1 },
        // .use_llvm = true,
    });

    // TODO: find a way to determine the path dynamically
    const php_path = "/home/cleong/php-src";
    lib.addIncludePath(.{ .cwd_relative = php_path });
    lib.addIncludePath(.{ .cwd_relative = php_path ++ "/main" });
    lib.addIncludePath(.{ .cwd_relative = php_path ++ "/TSRM" });
    lib.addIncludePath(.{ .cwd_relative = php_path ++ "/Zend" });
    lib.addCSourceFile(.{ .file = b.path("src/extension.c") });

    const wf = b.addUpdateSourceFiles();
    wf.addCopyFileToSource(lib.getEmittedBin(), "modules/php_zigar.so");
    if (target.result.os.tag == .windows and optimize == .Debug)
        wf.addCopyFileToSource(lib.getEmittedPdb(), "modules/php_zigar.pdb");
    wf.step.dependOn(&lib.step);
    b.getInstallStep().dependOn(&wf.step);

    b.installArtifact(lib);

    // create tarball of the zig directory
    _ = try std.process.Child.run(.{
        .allocator = b.allocator,
        .argv = &.{
            "tar",
            "-h", // follow symlink
            "-I zstd -19", // use zstd, max compression level
            "-cf", // create archive, specifying filename
            "./src/zig.tar.zstd",
            "-C", // change to directory first
            "./zig",
            ".",
        },
    });
}
