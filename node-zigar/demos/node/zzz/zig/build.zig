const std = @import("std");
const builtin = @import("builtin");
const cfg = @import("build-cfg.zig");

const host_type = if (cfg.is_wasm) "wasm" else "napi";
const zig_path = std.fmt.comptimePrint("{s}{d}.{d}{c}", .{
    cfg.zigar_src_path,
    builtin.zig_version.major,
    builtin.zig_version.minor,
    std.fs.path.sep,
});

pub fn build(b: *std.Build) void {
    const target = b.standardTargetOptions(.{});
    const optimize = b.standardOptimizeOption(.{});
    const lib = b.addSharedLibrary(.{
        .name = cfg.module_name,
        .root_source_file = .{ .cwd_relative = zig_path ++ "stub-" ++ host_type ++ ".zig" },
        .target = target,
        .optimize = optimize,
        .single_threaded = !cfg.multithreaded,
    });
    const zigar = b.createModule(.{
        .root_source_file = .{ .cwd_relative = zig_path ++ "zigar.zig" },
    });
    const zzz = b.dependency("zzz", .{
        .target = target,
        .optimize = optimize,
    }).module("zzz");
    const imports = [_]std.Build.Module.Import{
        .{ .name = "zigar", .module = zigar },
        .{ .name = "zzz", .module = zzz },
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
    const options = b.addOptions();
    options.addOption(comptime_int, "eval_branch_quota", cfg.eval_branch_quota);
    options.addOption(bool, "omit_functions", cfg.omit_functions);
    options.addOption(bool, "omit_variables", cfg.omit_variables);
    lib.root_module.addOptions("export-options.zig", options);
    const wf = switch (@hasDecl(std.Build, "addUpdateSourceFiles")) {
        true => b.addUpdateSourceFiles(),
        false => b.addWriteFiles(),
    };
    wf.addCopyFileToSource(lib.getEmittedBin(), cfg.output_path);
    wf.step.dependOn(&lib.step);
    b.getInstallStep().dependOn(&wf.step);
}
