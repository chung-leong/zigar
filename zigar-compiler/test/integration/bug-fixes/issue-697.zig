const std = @import("std");

const zigar = @import("zigar");

pub const Callback = fn (i32, []const u8) void;

pub fn none(_: i32, _: []const u8) void {}

var callback: *const Callback = &none;

pub fn setCallback(cb: ?*const Callback) void {
    zigar.function.release(callback);
    callback = cb orelse &none;
}

pub fn runCallback() void {
    callback(123, "Hello world");
}
