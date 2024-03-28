const std = @import("std");

const Error = error{some_error};

pub fn fail() void {
    @call(.never_inline, a, .{});
}

fn a() void {
    @call(.never_inline, b, .{});
}

fn b() void {
    @call(.never_inline, c, .{});
}

fn c() void {
    @call(.never_inline, d, .{});
}

fn d() void {
    unreachable;
}
