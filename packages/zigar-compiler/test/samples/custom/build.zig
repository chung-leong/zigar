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
    lib.addModule("exporter", b.createModule(.{
        .source_file = .{ .path = cfg.exporter_path },
    }));
    const module = b.createModule(.{
        .source_file = .{ .path = cfg.package_root ++ "/modules/module.zig" },
    });
    lib.addModule("module", module);
    const dependencies: [1]std.Build.ModuleDependency = .{
        .{ .name = "module", .module = module },
    };
    lib.addModule("package", b.createModule(.{
        .source_file = .{ .path = cfg.package_path },
        .dependencies = &dependencies,
    }));
    if (cfg.use_libc) {
        lib.linkLibC();
    }
    if (cfg.target.cpu_arch == .wasm32) {
        lib.use_lld = false;
        lib.rdynamic = true;
    }
    b.installArtifact(lib);
}
