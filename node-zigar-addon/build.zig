const std = @import("std");

pub fn build(b: *std.Build) !void {
    const target = b.standardTargetOptions(.{});
    const optimize = b.standardOptimizeOption(.{});
    const output_path = b.option([]const u8, "output", "Path to which library is written") orelse {
        std.debug.print("Parameter \"output\" is required\n", .{});
        return;
    };
    const os = if (@hasDecl(@TypeOf(target), "getOsTag")) target.getOsTag() else target.result.os.tag;
    const lib = b.addSharedLibrary(.{
        .name = "node-zigar-addon",
        .target = target,
        .optimize = optimize,
    });
    lib.addIncludePath(b.path("../node-api-headers/include"));
    lib.addIncludePath(b.path("./node_modules/node-api-headers/include"));
    lib.addCSourceFile(.{ .file = b.path("./src/addon-node.c"), .flags = &.{} });
    lib.addCSourceFile(.{ .file = b.path("./src/addon.c"), .flags = &.{} });
    lib.addCSourceFile(.{ .file = b.path("./src/redirect.c"), .flags = &.{} });
    switch (os) {
        .windows => {
            lib.addCSourceFile(.{ .file = b.path("./src/win32-shim.c"), .flags = &.{} });
            lib.linkSystemLibrary("dbghelp");
        },
        .macos => {
            lib.linker_allow_shlib_undefined = true;
        },
        else => {},
    }
    lib.linkLibC();
    const wf = b.addWriteFiles();
    _ = wf.addCopyFile(lib.getEmittedBin(), cfg.output_path);
    wf.step.dependOn(&lib.step);
    b.getInstallStep().dependOn(&wf.step);
}
