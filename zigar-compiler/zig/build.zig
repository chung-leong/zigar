const std = @import("std");
const Import = std.Build.Module.Import;
const builtin = @import("builtin");

const cfg = @import("build.cfg.zig");
const extra = @import("build.extra.zig");

pub fn build(b: *std.Build) !void {
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
    const zigar_imports: []const Import = &.{.{ .name = "zigar", .module = zigar }};
    const extra_imports: []const Import = switch (@hasDecl(extra, "getImports")) {
        true => @call(.always_inline, extra.getImports, .{ b, .{
            .library = lib,
            .target = target,
            .optimize = optimize,
        } }),
        false => &.{},
    };
    const imports = try std.mem.concat(b.allocator, Import, &.{ zigar_imports, extra_imports });
    const mod = b.createModule(.{
        .root_source_file = .{ .cwd_relative = cfg.module_path },
        .imports = imports,
    });
    mod.addIncludePath(.{ .cwd_relative = cfg.module_dir });
    lib.root_module.addImport("module", mod);
    const extra_c_files: []const []const u8 = switch (@hasDecl(extra, "getCSourceFiles")) {
        true => @call(.always_inline, extra.getCSourceFiles, .{ b, .{
            .library = lib,
            .module = mod,
            .target = target,
            .optimize = optimize,
        } }),
        false => &.{},
    };
    for (extra_c_files) |file| {
        const path = try std.fs.path.resolve(b.allocator, &.{ cfg.module_dir, file });
        lib.addCSourceFile(.{ .file = .{ .cwd_relative = path } });
    }
    const extra_include_paths: []const []const u8 = switch (@hasDecl(extra, "getIncludePaths")) {
        true => @call(.always_inline, extra.getIncludePaths, .{ b, .{
            .library = lib,
            .module = mod,
            .target = target,
            .optimize = optimize,
        } }),
        false => &.{},
    };
    for (extra_include_paths) |inc_path| {
        const path = try std.fs.path.resolve(b.allocator, &.{ cfg.module_dir, inc_path });
        lib.addIncludePath(.{ .file = .{ .cwd_relative = path } });
    }
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
        lib.stack_size = cfg.stack_size;
        lib.max_memory = cfg.max_memory;
    } else if (cfg.use_redirection) {
        lib.addCSourceFile(.{ .file = .{ .cwd_relative = cfg.zigar_src_path ++ "hooks.c" } });
    }
    const options = b.addOptions();
    options.addOption(comptime_int, "eval_branch_quota", cfg.eval_branch_quota);
    options.addOption(bool, "omit_functions", cfg.omit_functions);
    options.addOption(bool, "omit_variables", cfg.omit_variables);
    options.addOption(bool, "use_redirection", cfg.use_redirection);
    lib.root_module.addOptions("./export-options.zig", options);
    const wf = b.addUpdateSourceFiles();
    wf.addCopyFileToSource(lib.getEmittedBin(), cfg.output_path);
    if (@TypeOf(cfg.pdb_path) != @TypeOf(null) and optimize == .Debug) {
        wf.addCopyFileToSource(lib.getEmittedPdb(), cfg.pdb_path);
    }
    wf.step.dependOn(&lib.step);
    b.getInstallStep().dependOn(&wf.step);
}
