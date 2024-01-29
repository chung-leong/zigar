const std = @import("std");
const cfg = @import("./build-cfg.zig");

pub fn build(b: *std.Build) void {
    const target = b.standardTargetOptions(.{
        .default_target = cfg.target,
    });
    const optimize = b.standardOptimizeOption(.{});
    const lib = b.addSharedLibrary(.{
        .name = cfg.package_name,
        .root_source_file = .{ .path = cfg.stub_path },
        .target = target,
        .optimize = optimize,
    });
    const ziglua = b.dependency("ziglua", .{
        .target = target,
        .optimize = optimize,
    });
    if (@hasDecl(std.Build.Step.Compile, "addModule")) {
        // Zig 0.11.0
        const exporter = b.createModule(.{
            .source_file = .{ .path = cfg.exporter_path },
        });
        const package = b.createModule(.{
            .source_file = .{ .path = cfg.package_path },
        });
        lib.addModule("exporter", exporter);
        lib.addModule("package", package);
        lib.addModule("ziglua", ziglua.module("ziglua"));
    } else if (@hasField(std.Build.Step.Compile, "root_module")) {
        // Zig 0.12.0
        const exporter = b.createModule(.{
            .root_source_file = .{ .path = cfg.exporter_path },
        });
        const package = b.createModule(.{
            .root_source_file = .{ .path = cfg.package_path },
        });
        lib.root_module.addImport("exporter", exporter);
        lib.root_module.addImport("package", package);
        package.addImport("ziglua", ziglua.module("ziglua"));
    }
    if (cfg.use_libc) {
        lib.linkLibC();
    }
    if (cfg.target.cpu_arch == .wasm32) {
        lib.use_lld = false;
        lib.rdynamic = true;
    }
    b.installArtifact(lib);
}
