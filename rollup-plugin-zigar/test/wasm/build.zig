const std = @import("std");

pub fn build(b: *std.Build) void {
    const target = b.standardTargetOptions(.{});
    const optimize = b.standardOptimizeOption(.{});
    const lib = b.addSharedLibrary(.{
        .name = "main",
        .root_source_file = .{ .cwd_relative = "main.zig" },
        .target = target,
        .optimize = optimize,
    });
    lib.kind = .exe;
    lib.linkage = .static;
    lib.entry = .disabled;
    lib.rdynamic = true;
    lib.wasi_exec_model = .reactor;
    lib.import_table = true;
    const wf = switch (@hasDecl(std.Build, "addUpdateSourceFiles")) {
        true => b.addUpdateSourceFiles(),
        false => b.addWriteFiles(),
    };
    wf.addCopyFileToSource(lib.getEmittedBin(), "main.wasm");
    wf.step.dependOn(&lib.step);
    b.getInstallStep().dependOn(&wf.step);

    const liba = b.addSharedLibrary(.{
        .name = "auxiliary",
        .root_source_file = .{ .cwd_relative = "auxiliary.zig" },
        .target = target,
        .optimize = optimize,
    });
    liba.kind = .exe;
    liba.linkage = .static;
    liba.entry = .disabled;
    liba.rdynamic = true;
    liba.wasi_exec_model = .reactor;
    liba.import_memory = true;
    const wfa = switch (@hasDecl(std.Build, "addUpdateSourceFiles")) {
        true => b.addUpdateSourceFiles(),
        false => b.addWriteFiles(),
    };
    wfa.addCopyFileToSource(liba.getEmittedBin(), "auxiliary.wasm");
    wfa.step.dependOn(&liba.step);
    b.getInstallStep().dependOn(&wfa.step);
}
