const std = @import("std");

pub fn getImports(b: *std.Build, args: anytype) []const std.Build.Module.Import {
    const lua_wrapper = b.dependency("lua_wrapper", .{
        .target = args.target,
        .optimize = args.optimize,
    }).module("lua_wrapper");
    return &.{
        .{ .name = "lua_wrapper", .module = lua_wrapper },
    };
}
