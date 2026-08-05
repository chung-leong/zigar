const std = @import("std");

pub fn getCSourceFiles(_: *std.Build, _: anytype) []const []const u8 {
    return &.{"tests.c"};
}
