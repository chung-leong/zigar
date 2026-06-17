const std = @import("std");

pub fn call(fn_ptr: *const fn (i32) [3]i32) void {
    const result = fn_ptr(123);
    std.debug.print("{any}\n", .{result});
}
