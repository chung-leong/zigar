const std = @import("std");
const builtin = @import("builtin");
const cfg = @import("build-cfg.zig");

pub fn build(b: *std.Build) void {
    if (builtin.zig_version.major != 0 or builtin.zig_version.minor != 14) {
        @compileError("Unsupported Zig version");
    }
    const host_type = if (cfg.is_wasm) "wasm" else "napi";
    const target = b.standardTargetOptions(.{});
    const optimize = b.standardOptimizeOption(.{});
    const lib = b.addSharedLibrary(.{
        .name = cfg.module_name,
        .root_source_file = .{ .cwd_relative = cfg.zigar_src_path ++ "stub-" ++ host_type ++ ".zig" },
        .target = target,
        .optimize = optimize,
        .single_threaded = !cfg.multithreaded,
    });
    const zigar = b.createModule(.{
        .root_source_file = .{ .cwd_relative = cfg.zigar_src_path ++ "zigar.zig" },
    });
    const zuckdb = b.dependency("zuckdb", .{
        .target = target,
        .optimize = optimize,
    }).module("zuckdb");
    lib.addLibraryPath(.{ .cwd_relative = cfg.module_dir ++ "/../lib" });
    const imports = [_]std.Build.Module.Import{
        .{ .name = "zigar", .module = zigar },
        .{ .name = "zuckdb", .module = zuckdb },
    };
    const mod = b.createModule(.{
        .root_source_file = .{ .cwd_relative = cfg.module_path },
        .imports = &imports,
    });
    mod.addIncludePath(.{ .cwd_relative = cfg.module_dir });
    lib.root_module.addImport("module", mod);
    if (cfg.use_libc) {
        lib.linkLibC();
    }
    if (cfg.is_wasm) {
        // WASM needs to be compiled as exe
        lib.kind = .exe;
        lib.linkage = .static;
        lib.entry = .disabled;
        lib.rdynamic = true;
        lib.wasi_exec_model = .reactor;
        lib.import_memory = true;
        lib.import_table = true;
        lib.max_memory = cfg.max_memory;
    }
    const wf = switch (@hasDecl(std.Build, "addUpdateSourceFiles")) {
        true => b.addUpdateSourceFiles(),
        false => b.addWriteFiles(),
    };
    wf.addCopyFileToSource(lib.getEmittedBin(), cfg.output_path);
    wf.step.dependOn(&lib.step);
    b.getInstallStep().dependOn(&wf.step);
}
