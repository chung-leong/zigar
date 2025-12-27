const std = @import("std");

pub fn getImports(b: *std.Build, args: anytype) []const std.Build.Module.Import {
    _ = b;
    _ = args;
    // args contains the following:
    //
    //     library: *std.Build.Step.Compile,
    //     target: std.Build.ResolvedTarget,
    //     optimize: std.builtin.OptimizeMode,
    return &.{};
}

pub fn getCSourceFiles(b: *std.Build, args: anytype) []const []const u8 {
    _ = b;
    _ = args;
    // args contains the following:
    //
    //     library: *std.Build.Step.Compile,
    //     module: *std.Build.Module,
    //     target: std.Build.ResolvedTarget,
    //     optimize: std.builtin.OptimizeMode,
    return &.{
        "./static.cpp"
    };
}

pub fn getIncludePaths(b: *std.Build, args: anytype) []const []const u8 {
    _ = b;
    _ = args;
    // args contains the following:
    //
    //     library: *std.Build.Step.Compile,
    //     module: *std.Build.Module,
    //     target: std.Build.ResolvedTarget,
    //     optimize: std.builtin.OptimizeMode,
    return &.{};
}
