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
    const sqlite = b.dependency("sqlite", .{
        .target = target,
        .optimize = optimize,
    });
    const imports = .{
        .{ .name = "sqlite", .module = sqlite.module("sqlite") },
    };
    if (@hasDecl(std.Build.Step.Compile, "addModule")) {
        // Zig 0.11.0
        lib.addModule("exporter", b.createModule(.{
            .source_file = .{ .path = cfg.exporter_path },
        }));
        lib.addModule("module", b.createModule(.{
            .source_file = .{ .path = cfg.module_path },
            .dependencies = &imports,
        }));
    } else if (@hasField(std.Build.Step.Compile, "root_module")) {
        // Zig 0.12.0
        lib.root_module.addImport("exporter", b.createModule(.{
            .root_source_file = .{ .path = cfg.exporter_path },
        }));
        lib.root_module.addImport("module", b.createModule(.{
            .root_source_file = .{ .path = cfg.module_path },
            .imports = &imports,
        }));
        if (cfg.is_wasm) {
            // WASM needs to be compiled as exe
            lib.kind = .exe;
            lib.linkage = .static;
            lib.entry = .disabled;
        }
    }
    if (cfg.is_wasm) {
        lib.rdynamic = true;
        lib.wasi_exec_model = .reactor;
    }
    if (cfg.use_libc) {
        lib.linkLibC();
    }
    const wf = b.addWriteFiles();
    wf.addCopyFileToSource(lib.getEmittedBin(), cfg.output_path);
    wf.step.dependOn(&lib.step);
    b.getInstallStep().dependOn(&wf.step);
}
