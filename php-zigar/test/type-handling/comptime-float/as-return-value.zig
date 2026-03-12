const std = @import("std");

pub fn getComptimeFloat() comptime_float {
    return std.math.pi;
}
