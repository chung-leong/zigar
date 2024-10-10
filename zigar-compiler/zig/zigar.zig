const std = @import("std");
const host = @import("root").host;

pub const function = struct {
    pub fn release(fn_ptr: anytype) void {
        host.releaseFunction(fn_ptr) catch {};
    }
};
