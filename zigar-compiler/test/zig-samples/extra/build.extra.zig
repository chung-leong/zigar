const std = @import("std");

const cfg = @import("build.cfg.zig");

pub fn getImports(b: *std.Build, args: anytype) []const std.Build.Module.Import {
    const number = b.createModule(.{
        .root_source_file = .{ .cwd_relative = cfg.module_dir ++ "modules/number.zig" },
        .target = args.target,
        .optimize = args.optimize,
    });
    return &.{
        .{ .name = "number", .module = number },
    };
}
