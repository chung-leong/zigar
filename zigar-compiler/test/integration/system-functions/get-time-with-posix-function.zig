const std = @import("std");

pub fn get(id: std.posix.clockid_t) !i64 {
    const spec = try std.posix.clock_gettime(id);
    return spec.sec * 1000000000 + spec.nsec;
}
