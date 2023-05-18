const std = @import("std");

pub fn build(b: *std.Build) void {
    const target = b.standardTargetOptions(.{});
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
    b.installArtifact(lib);
}
