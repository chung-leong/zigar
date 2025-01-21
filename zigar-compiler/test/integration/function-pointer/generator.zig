const std = @import("std");
const zigar = @import("zigar");

pub const JSError = error{Unexpected};

pub const Callback = *const fn (generator: zigar.function.Generator(JSError!?i32)) void;

pub fn receive(ptr: ?*anyopaque, arg: JSError!?i32) bool {
    const number_ptr: *const u32 = @ptrCast(@alignCast(ptr));
    if (arg) |value_maybe| {
        std.debug.print("number = {d}, value = {any}\n", .{ number_ptr.*, value_maybe });
        if (value_maybe) |value| {
            if (value >= 10) return false;
        }
    } else |err| {
        std.debug.print("number = {d}, error = {s}\n", .{ number_ptr.*, @errorName(err) });
    }
    return true;
}

var number: u32 = 1234;

pub fn call(f: Callback) void {
    f(.{ .ptr = &number, .callback = receive });
}
