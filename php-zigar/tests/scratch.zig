const std = @import("std");

const zigar = @import("zigar");

const Fn = fn (i32) i32;

pub fn call(fn_ptr: *const Fn, int: i32) !void {
    const thread = try std.Thread.spawn(.{}, run, .{
        fn_ptr,
        int,
    });
    thread.detach();
}

fn run(fn_ptr: *const Fn, int: i32) void {
    const result = fn_ptr(int);
    std.debug.print("result = {d}\n", .{result});
}
