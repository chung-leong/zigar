const std = @import("std");
const cfg = @import("./build-cfg.zig");

pub fn build(b: *std.Build) void {
    const target = b.standardTargetOptions(.{});
    const optimize = b.standardOptimizeOption(.{});
    const arch = if (@hasDecl(@TypeOf(target), "getCpuArch")) target.getCpuArch() else target.result.cpu.arch;
    const is_wasm = switch (arch) {
        .wasm32, .wasm64 => true,
        else => false,
    };
    const lib = b.addSharedLibrary(.{
        .name = cfg.package_name,
        .root_source_file = .{ .path = cfg.stub_path },
        .target = target,
        .optimize = optimize,
    });
    if (is_wasm) {
        lib.rdynamic = true;
    }
    const imports = .{};
    if (@hasDecl(std.Build.Step.Compile, "addModule")) {
        // Zig 0.11.0
        lib.addModule("exporter", b.createModule(.{
            .source_file = .{ .path = cfg.exporter_path },
        }));
        lib.addModule("package", b.createModule(.{
            .source_file = .{ .path = cfg.package_path },
            .dependencies = &imports,
        }));
    } else if (@hasField(std.Build.Step.Compile, "root_module")) {
        // Zig 0.12.0
        lib.root_module.addImport("exporter", b.createModule(.{
            .root_source_file = .{ .path = cfg.exporter_path },
        }));
        lib.root_module.addImport("package", b.createModule(.{
            .root_source_file = .{ .path = cfg.package_path },
            .imports = &imports,
        }));
        if (is_wasm) {
            // WASM needs to be compiled as exe
            lib.kind = .exe;
            lib.linkage = .static;
            lib.entry = .disabled;
        }
    }
    if (cfg.use_libc) {
        lib.linkLibC();
    }
    const wf = b.addWriteFiles();
    wf.addCopyFileToSource(lib.getEmittedBin(), cfg.output_path);
    wf.step.dependOn(&lib.step);
    b.getInstallStep().dependOn(&wf.step);
}
