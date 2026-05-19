const std = @import("std");
const foo = @import("foo");

pub fn hello(a: i32, b: i32) void {
    std.debug.print("sum = {d}\n", .{foo.add(a, b)});
}
