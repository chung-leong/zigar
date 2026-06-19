const std = @import("std");

pub fn build(b: *std.Build) !void {
    const optimize = b.standardOptimizeOption(.{});
    const target = b.standardTargetOptions(.{});

    const php_debug = b.option(bool, "php_debug", "Whether PHP executable has debug enabled") orelse false;
    const php_thread_safe = b.option(bool, "php_thread_safe", "Whether PHP executable was compiled with thread-safety enabled") orelse false;
    const php_path = b.option([]const u8, "php_include", "Path to PHP header files") orelse {
        return error.MissingIncludePath;
    };

    // define for include/c.h
    const os_specific_macro = if (target.result.os.tag == .linux)
        "ZIGAR_LINUX"
    else if (target.result.os.tag.isDarwin())
        "ZIGAR_DARWIN"
    else if (target.result.os.tag == .windows)
        "ZIGAR_WIN32"
    else
        unreachable;
    const translate_c = b.addTranslateC(.{
        .root_source_file = b.path("src/include/c.h"),
        .target = target,
        .optimize = optimize,
    });
    translate_c.defineCMacro(os_specific_macro, null);
    translate_c.defineCMacro("ZIGAR_TARGET_OS", @tagName(target.result.os.tag));
    translate_c.defineCMacro("ZEND_DEBUG", if (php_debug) "1" else "0");
    if (php_thread_safe) translate_c.defineCMacro("ZTS", null);

    const mod = b.createModule(.{
        .root_source_file = b.path("src/extension.zig"),
        .target = target,
        .optimize = optimize,
        .single_threaded = false,
        .link_libc = true,
        .imports = &.{
            .{
                .name = "c",
                .module = translate_c.createModule(),
            },
        },
    });
    mod.stack_check = false;

    const lib = b.addLibrary(.{
        .linkage = .dynamic,
        .name = "php_zigar",
        .root_module = mod,
        .version = .{ .major = 1, .minor = 0, .patch = 1 },
        .use_llvm = true,
    });
    var c_flags: std.ArrayList([]const u8) = .empty;
    try c_flags.append(b.allocator, if (php_debug) "-DZEND_DEBUG=1" else "-DZEND_DEBUG=0");
    if (php_thread_safe) try c_flags.append(b.allocator, "-DZTS");
    lib.addCSourceFile(.{
        .file = b.path("src/extension.c"),
        .flags = c_flags.items,
    });

    inline for (.{ translate_c, mod }) |c| {
        const os_specific = if (target.result.os.tag == .linux)
            "src/include/linux"
        else if (target.result.os.tag.isDarwin())
            "src/include/darwin"
        else if (target.result.os.tag == .windows)
            "src/include/win32"
        else
            unreachable;
        c.addIncludePath(b.path(os_specific));
        c.addIncludePath(.{ .cwd_relative = php_path });
        c.addIncludePath(.{ .cwd_relative = try std.fs.path.join(b.allocator, &.{ php_path, "/main" }) });
        c.addIncludePath(.{ .cwd_relative = try std.fs.path.join(b.allocator, &.{ php_path, "/TSRM" }) });
        c.addIncludePath(.{ .cwd_relative = try std.fs.path.join(b.allocator, &.{ php_path, "/Zend" }) });
    }

    const wf = b.addUpdateSourceFiles();
    wf.addCopyFileToSource(lib.getEmittedBin(), "modules/php_zigar.so");
    if (target.result.os.tag == .windows and optimize == .Debug)
        wf.addCopyFileToSource(lib.getEmittedPdb(), "modules/php_zigar.pdb");
    wf.step.dependOn(&lib.step);
    b.getInstallStep().dependOn(&wf.step);
    b.installArtifact(lib);
}
