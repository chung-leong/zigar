const std = @import("std");

pub const Fn = fn () void;

pub fn call(ptr: *const Fn) void {
    ptr();
}

// to ensure that wasi_snapshot_preview1 exists as an import for test coverage purpose
pub fn hello() void {
    std.debug.print("Hello world\n", .{});
}
