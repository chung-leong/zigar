const std = @import("std");

pub fn get(id: std.posix.clockid_t) !i64 {
    var spec: std.posix.timespec = undefined;
    try std.posix.clock_getres(id, &spec);
    return spec.nsec;
}
