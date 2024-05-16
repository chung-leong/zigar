const std = @import("std");
const cfg = @import("./build-cfg.zig");

pub fn build(b: *std.Build) void {
    const target = b.standardTargetOptions(.{});
    const optimize = b.standardOptimizeOption(.{});
    const lib = b.addSharedLibrary(.{
        .name = cfg.module_name,
        .root_source_file = .{ .path = cfg.stub_path },
        .target = target,
        .optimize = optimize,
    });
    const ziglua = b.dependency("ziglua", .{
        .target = target,
        .optimize = optimize,
    });
    const imports = .{
        .{ .name = "ziglua", .module = ziglua.module("ziglua") },
    };
    lib.root_module.addImport("module", b.createModule(.{
        .root_source_file = .{ .path = cfg.module_path },
        .imports = &imports,
    }));
    if (cfg.use_libc) {
        lib.linkLibC();
    }
    const wf = b.addWriteFiles();
    wf.addCopyFileToSource(lib.getEmittedBin(), cfg.output_path);
    wf.step.dependOn(&lib.step);
    b.getInstallStep().dependOn(&wf.step);
}
