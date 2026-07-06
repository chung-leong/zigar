const std = @import("std");

pub fn build(b: *std.Build) !void {
    const optimize = b.standardOptimizeOption(.{});
    const target = b.standardTargetOptions(.{});

    const php_include = b.option([]const u8, "php-include", "Directory containing PHP header files") orelse "php-devel";
    const php_extension = b.option([]const u8, "php-extension", "Directory where the extension will be saved") orelse "extensions";
    const php_debug = b.option(bool, "php-debug", "Whether PHP executable has debug enabled") orelse false;
    const php_ts = b.option(bool, "php-ts", "Whether PHP executable was compiled with thread-safety enabled") orelse false;

    const translate_c = b.addTranslateC(.{
        .root_source_file = b.path("src/include/c.h"),
        .target = target,
        .optimize = optimize,
    });
    translate_c.defineCMacro("ZEND_COMPILE_DL_EXT", null);
    translate_c.defineCMacro("ZEND_DEBUG", if (php_debug) "1" else "0");
    if (php_ts) translate_c.defineCMacro("ZTS", null);

    const mod = b.createModule(.{
        .root_source_file = b.path("src/extension.zig"),
        .target = target,
        .optimize = optimize,
        .single_threaded = false,
        .link_libc = true,
        .imports = &.{
            .{ .name = "c", .module = translate_c.createModule() },
        },
    });
    mod.stack_check = false;
    if (target.result.os.tag == .windows) {
        mod.linkSystemLibrary("dbghelp", .{});
    }

    const lib = b.addLibrary(.{
        .linkage = .dynamic,
        .name = "php_zigar",
        .root_module = mod,
        .version = .{ .major = 1, .minor = 0, .patch = 1 },
        .use_llvm = true,
    });
    var c_flags: std.ArrayList([]const u8) = .empty;
    try c_flags.append(b.allocator, "-DZEND_COMPILE_DL_EXT");
    try c_flags.append(b.allocator, if (php_debug) "-DZEND_DEBUG=1" else "-DZEND_DEBUG=0");
    if (php_ts) try c_flags.append(b.allocator, "-DZTS");
    lib.addCSourceFile(.{
        .file = b.path("src/extension.c"),
        .flags = c_flags.items,
    });
    if (target.result.os.tag.isDarwin()) {
        // allow symbols from php executable to be undefined
        lib.linker_allow_shlib_undefined = true;
    }

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
        c.addIncludePath(.{ .cwd_relative = php_include });
        c.addIncludePath(.{ .cwd_relative = try std.fs.path.join(b.allocator, &.{ php_include, "main" }) });
        c.addIncludePath(.{ .cwd_relative = try std.fs.path.join(b.allocator, &.{ php_include, "TSRM" }) });
        c.addIncludePath(.{ .cwd_relative = try std.fs.path.join(b.allocator, &.{ php_include, "Zend" }) });
    }

    const wf = b.addUpdateSourceFiles();
    const filename = if (target.result.os.tag == .linux)
        "php_zigar.so"
    else if (target.result.os.tag.isDarwin())
        "php_zigar.dylib"
    else if (target.result.os.tag == .windows)
        "php_zigar.dll"
    else
        unreachable;
    wf.addCopyFileToSource(lib.getEmittedBin(), try std.fs.path.join(b.allocator, &.{ php_extension, filename }));
    if (target.result.os.tag == .windows and optimize == .Debug) {
        wf.addCopyFileToSource(lib.getEmittedPdb(), try std.fs.path.join(b.allocator, &.{ php_extension, "php_zigar.pdb" }));
    }
    wf.step.dependOn(&lib.step);
    b.getInstallStep().dependOn(&wf.step);
    b.installArtifact(lib);
}
