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
    const number = b.createModule(.{
        .root_source_file = .{ .path = cfg.module_dir ++ "/modules/number.zig" },
    });
    const imports = .{
        .{ .name = "number", .module = number },
    };
    lib.root_module.addImport("module", b.createModule(.{
        .root_source_file = .{ .path = cfg.module_path },
        .imports = &imports,
    }));
    if (cfg.is_wasm) {
        // WASM needs to be compiled as exe
        lib.kind = .exe;
        lib.linkage = .static;
        lib.entry = .disabled;
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
