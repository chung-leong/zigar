const std = @import("std");
const cfg = @import("./build-cfg.zig");

pub fn build(b: *std.Build) void {
    const target = b.standardTargetOptions(.{});
    const optimize = b.standardOptimizeOption(.{});
    const lib = b.addSharedLibrary(.{
        .name = cfg.module_name,
        .root_source_file = lazyPath(b, cfg.stub_path),
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
    const mod = b.createModule(.{
        .root_source_file = lazyPath(b, cfg.module_path),
        .imports = &imports,
    });
    mod.addIncludePath(lazyPath(b, cfg.module_dir));
    lib.root_module.addImport("module", mod);
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

fn lazyPath(b: *std.Build, path: []const u8) std.Build.LazyPath {
    if (@hasField(std.Build.LazyPath, "src_path")) {
        // 0.13.0
        return .{ .src_path = .{ .owner = b, .sub_path = path } };
    } else {
        // 0.12.0
        return .{ .path = path };
    }
}
