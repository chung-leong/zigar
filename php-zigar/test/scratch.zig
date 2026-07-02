const std = @import("std");

const zigar = @import("zigar");

pub const Function = fn () void;
pub const Callback = *const fn () callconv(.c) void;

pub fn call(count: usize, ...) callconv(.c) void {
    var va_list = @cVaStart();
    defer @cVaEnd(&va_list);
    for (0..count) |_| {
        const cb = @cVaArg(&va_list, Callback);
        cb();
        zigar.function.release(cb);
    }
}
