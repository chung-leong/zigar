const std = @import("std");

const Fn = fn (i32) i32;

pub fn call(fn_ptr: *const Fn, int: i32) void {
    const result = fn_ptr(int);
    std.debug.print("result = {d}\n", .{result});
}
