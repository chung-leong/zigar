const std = @import("std");

pub const comptime_struct = struct {
    pub const input = .{
        .src = .{ .channels = 4 },
        .params = .{ 0, 1, 2, 3 },
    };
};

pub const tuple = .{ 123, 3.14, .evil };
