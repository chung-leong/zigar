const std = @import("std");

const Error = error{some_error};

pub fn fail() void {
    @call(.never_inline, a, .{}) catch {
        const trace = @errorReturnTrace() orelse return;
        std.debug.dumpStackTrace(trace.*);
    };
}

fn a() !void {
    try @call(.never_inline, b, .{});
}

fn b() !void {
    try @call(.never_inline, c, .{});
}

fn c() !void {
    try @call(.never_inline, d, .{});
}

fn d() !void {
    return error.HomerSimpson;
}
