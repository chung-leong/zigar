const std = @import("std");
const builtin = @import("builtin");

pub fn build(b: *std.Build) !void {
    if (builtin.zig_version.major != 0 or builtin.zig_version.minor != 15) {
        @compileError("Unsupported Zig version");
    }
    const target = b.standardTargetOptions(.{});
    const optimize = b.standardOptimizeOption(.{});
    const output_path = b.option([]const u8, "output", "Path to which library is written") orelse {
        std.debug.print("Parameter \"output\" is required\n", .{});
        return;
    };
    const os = if (@hasDecl(@TypeOf(target), "getOsTag")) target.getOsTag() else target.result.os.tag;

    const translate_c = b.addTranslateC(.{
        .root_source_file = b.path("src/include/c.h"),
        .target = target,
        .optimize = optimize,
    });
    translate_c.addIncludePath(b.path("../node-api-headers/include"));
    translate_c.addIncludePath(b.path("./node_modules/node-api-headers/include"));

    const mod = b.addModule("root", .{
        .root_source_file = b.path("src/addon.zig"),
        .target = target,
        .optimize = optimize,
        .imports = &.{
            .{
                .name = "c",
                .module = translate_c.createModule(),
            },
        },
    });

    const lib = b.addLibrary(.{
        .linkage = .dynamic,
        .name = "node-zigar-addon",
        .root_module = mod,
        .use_llvm = true,
    });
    switch (os) {
        .windows => lib.linkSystemLibrary("dbghelp"),
        .macos => lib.linker_allow_shlib_undefined = true,
        else => {},
    }
    lib.linkLibC();

    const wf = b.addUpdateSourceFiles();
    wf.addCopyFileToSource(lib.getEmittedBin(), output_path);
    wf.step.dependOn(&lib.step);
    b.getInstallStep().dependOn(&wf.step);
}
