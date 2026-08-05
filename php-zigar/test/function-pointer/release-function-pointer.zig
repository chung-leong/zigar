const std = @import("std");

const zigar = @import("zigar");

pub const Callback = fn () void;

var callback: ?*const Callback = null;

pub fn foo() void {
    std.debug.print("foo\n", .{});
}

pub fn set(cb: *const Callback) void {
    callback = cb;
}

pub fn call() void {
    if (callback) |cb| cb();
}

pub fn release() void {
    if (callback) |cb| {
        zigar.function.release(cb);
        callback = null;
    }
}
