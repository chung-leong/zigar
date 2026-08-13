const std = @import("std");

pub fn get(id: std.c.clockid_t) !i64 {
    var spec: std.c.timespec = undefined;
    if (std.c.clock_gettime(id, &spec) < 0) return error.UnableToGetTime;
    return spec.sec * 1000000000 + spec.nsec;
}
