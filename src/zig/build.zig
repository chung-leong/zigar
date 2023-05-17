const std = @import("std");

pub fn build(b: *std.Build) void {
    const target = b.standardTargetOptions(.{});
    const optimize = b.standardOptimizeOption(.{});
    const exporter = b.createModule(.{
        .source_file = .{ .path = "${EXPORTER_PATH}" },
    });
    const lib = b.addSharedLibrary(.{
        .name = "${PACKAGE_NAME}",
        .root_source_file = .{ .path = "./stub.zig" },
        .target = target,
        .optimize = optimize,
    });
    lib.emit_bin = .{ .emit_to = "${LIBRARY_PATH}" };
    lib.addModule("exporter", exporter);
}
