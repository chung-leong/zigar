const std = @import("std");

const Options = struct {
    a: bool = true,
    b: bool = false,
    c: bool = true,
};

pub fn call(options: Options) void {
    std.debug.print("{}\n", .{options});
}
