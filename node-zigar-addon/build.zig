const std = @import("std");

pub fn build(b: *std.Build) !void {
    const target = b.standardTargetOptions(.{});
    const optimize = b.standardOptimizeOption(.{});
    const os = if (@hasDecl(@TypeOf(target), "getOsTag")) target.getOsTag() else target.result.os.tag;
    const arch = if (@hasDecl(@TypeOf(target), "getCpuArch")) target.getCpuArch() else target.result.cpu.arch;
    const lib = b.addSharedLibrary(.{
        .name = "node-zigar-addon",
        .target = target,
        .optimize = optimize,
    });
    lib.addIncludePath(.{ .path = "./node_modules/node-api-headers/include" });
    lib.addCSourceFile(.{ .file = .{ .path = "./src/addon-node.c" }, .flags = &.{} });
    lib.addCSourceFile(.{ .file = .{ .path = "./src/addon.c" }, .flags = &.{} });
    switch (os) {
        .windows => {
            lib.addCSourceFile(.{ .file = .{ .path = "./src/win32-shim.c" }, .flags = &.{} });
            lib.linkSystemLibrary("dbghelp");
            lib.addLibraryPath(.{ .path = "./lib" });
            lib.linkSystemLibrary(switch (arch) {
                .arm => "node_api.arm",
                .aarch64 => "node_api.arm64",
                .x86 => "node_api.ia32",
                .x86_64 => "node_api.x64",
                else => @panic("Unknown architecture"),
            });
        },
        .macos => {
            lib.linker_allow_shlib_undefined = true;
        },
        else => {},
    }
    lib.linkLibC();
    if (b.option([]const u8, "output", "Path to which library is written")) |output_path| {
        const wf = b.addWriteFiles();
        wf.addCopyFileToSource(lib.getEmittedBin(), output_path);
        wf.step.dependOn(&lib.step);
        b.getInstallStep().dependOn(&wf.step);
    } else {
        std.debug.print("Parameter \"output\" is required\n", .{});
    }
}
