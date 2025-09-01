const std = @import("std");

pub const U32Slice = []u32;

const LinearGradient = struct {
    stops: []u32,
};

const RadialGradient = struct {
    stops: []u32,
};

const Fill = union(enum) {
    linear: LinearGradient,
    radial: RadialGradient,
};

pub fn hello(fill: Fill) void {
    std.debug.print("{}\n", .{fill});
}
