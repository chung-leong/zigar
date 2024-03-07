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
    const output_path = b.option([]const u8, "output", "Path to which library is written") orelse {
        std.debug.print("Parameter \"output\" is required\n", .{});
        return;
    };
    const exe_name = b.option([]const u8, "exe", "Windows exe to link against") orelse {
        std.debug.print("Parameter \"exe\" is required\n", .{});
        return;
    };
    switch (os) {
        .windows => {
            lib.addCSourceFile(.{ .file = .{ .path = "./src/win32-shim.c" }, .flags = &.{} });
            lib.linkSystemLibrary("dbghelp");
            lib.addLibraryPath(.{ .path = "./lib" });
            const arch_name = switch (arch) {
                .arm => "arm",
                .aarch64 => "arm64",
                .x86 => "ia32",
                .x86_64 => "x64",
                else => "unknown",
            };
            const lib_name = try std.fmt.allocPrint(b.allocator, "{s}.{s}", .{ exe_name, arch_name });
            lib.linkSystemLibrary(lib_name);
        },
        .macos => {
            lib.linker_allow_shlib_undefined = true;
        },
        else => {},
    }
    lib.linkLibC();
    const wf = b.addWriteFiles();
    wf.addCopyFileToSource(lib.getEmittedBin(), output_path);
    wf.step.dependOn(&lib.step);
    b.getInstallStep().dependOn(&wf.step);
}
