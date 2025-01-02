const std = @import("std");
const zigar = @import("zigar");

pub const JSError = error{Unexpected};

pub const Callback = *const fn (
    allocator: std.mem.Allocator,
    promise: zigar.function.Promise(JSError![]const u8),
) void;

const allocator = zigar.mem.getDefaultAllocator();

pub fn receive(_: ?*anyopaque, arg: JSError![]const u8) void {
    if (arg) |string| {
        std.debug.print("value = {s}\n", .{string});
        allocator.free(string);
    } else |err| {
        std.debug.print("error = {s}\n", .{@errorName(err)});
    }
}

pub fn call(f: Callback) void {
    f(allocator, .{ .callback = receive });
}
