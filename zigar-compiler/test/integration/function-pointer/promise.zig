const std = @import("std");

const zigar = @import("zigar");

pub const JSError = error{Unexpected};

pub const Callback = *const fn (promise: zigar.function.Promise(JSError!i32)) void;

pub fn receive(ptr: ?*anyopaque, arg: JSError!i32) void {
    const number_ptr: *const u32 = @ptrCast(@alignCast(ptr));
    if (arg) |value| {
        std.debug.print("number = {d}, value = {d}\n", .{ number_ptr.*, value });
    } else |err| {
        std.debug.print("number = {d}, error = {s}\n", .{ number_ptr.*, @errorName(err) });
    }
}

var number: u32 = 1234;

pub fn call(f: Callback) void {
    f(.{ .ptr = &number, .callback = receive });
}
