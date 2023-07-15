const std = @import("std");

pub fn build(b: *std.Build) void {
    const wasm = "${FOR_WASM}"[0] == 'y';
    const target = b.standardTargetOptions(.{
        .default_target = switch (wasm) {
            true => .{
                .cpu_arch = .wasm32,
                .os_tag = .freestanding,
            },
            false => .{},
        },
    });
    const optimize = b.standardOptimizeOption(.{});
    const lib = b.addSharedLibrary(.{
        .name = "${PACKAGE_NAME}",
        .root_source_file = .{ .path = "./stub.zig" },
        .target = target,
        .optimize = optimize,
    });
    lib.addModule("exporter", b.createModule(.{
        .source_file = .{ .path = "${EXPORTER_PATH}" },
    }));
    lib.addModule("package", b.createModule(.{
        .source_file = .{ .path = "${PACKAGE_PATH}" },
    }));
    if ("${USE_CLIB}"[0] == 'y') {
        lib.linkLibC();
    }
    if (wasm) {
        lib.use_lld = false;
        lib.rdynamic = true;
    }
    b.installArtifact(lib);
}
