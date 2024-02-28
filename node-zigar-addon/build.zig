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
            const node_api = try std.fmt.bufPrint(&node_api_buffer, "node_api.{s}", .{
                try getArchName(arch),
            });
            lib.linkSystemLibrary(node_api);
        },
        .macos => {
            lib.linker_allow_shlib_undefined = true;
        },
        else => {},
    }
    lib.linkLibC();
    const wf = b.addWriteFiles();
    const output_path = try std.fmt.bufPrint(&output_path_buffer, "./build/{s}.{s}.node", .{
        try getPlatformName(os),
        try getArchName(arch),
    });
    wf.addCopyFileToSource(lib.getEmittedBin(), output_path);
    wf.step.dependOn(&lib.step);
    b.getInstallStep().dependOn(&wf.step);
}

const Error = error{Unsupported};
var output_path_buffer: [256]u8 = undefined;
var node_api_buffer: [64]u8 = undefined;

fn getArchName(arch: std.Target.Cpu.Arch) ![]const u8 {
    return switch (arch) {
        .arm, .armeb => "arm",
        .aarch64, .aarch64_be, .aarch64_32 => "arm64",
        .x86 => "ia32",
        .loongarch64 => "loong64",
        .mips => "mips",
        .mipsel => "mipsel",
        .powerpc, .powerpcle => "ppc",
        .powerpc64, .powerpc64le => "ppc64",
        .riscv64 => "riscv64",
        .s390x => "s390x",
        .x86_64 => "x64",
        else => Error.Unsupported,
    };
}

fn getPlatformName(os: std.Target.Os.Tag) ![]const u8 {
    return switch (os) {
        .aix => "aix",
        .macos => "darwin",
        .freebsd, .kfreebsd => "freebsd",
        .linux => "linux",
        .openbsd => "openbsd",
        .solaris => "sunos",
        .windows => "win32",
        else => Error.Unsupported,
    };
}
