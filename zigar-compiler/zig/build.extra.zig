const std = @import("std");

pub fn getImports(b: *std.Build, args: anytype) []const std.Build.Module.Import {
    _ = b;
    _ = args;
    return &.{};
}

pub fn getCSourceFiles(b: *std.Build, args: anytype) []const []const u8 {
    _ = b;
    _ = args;
    return &.{};
}
