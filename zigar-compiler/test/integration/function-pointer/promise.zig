const std = @import("std");
const zigar = @import("zigar");

pub const JSError = error{Unexpected};

pub const Callback = *const fn (promise: zigar.function.Promise(JSError!i32)) void;

pub fn receive(_: ?*anyopaque, arg: JSError!i32) void {
    if (arg) |value| {
        std.debug.print("value = {d}\n", .{value});
    } else |err| {
        std.debug.print("error = {s}\n", .{@errorName(err)});
    }
}

pub fn call(f: Callback) void {
    f(.{ .callback = receive });
}
