const std = @import("std");
var threaded_io = std.Io.Threaded.init_single_threaded;

const Error = error{some_error};
const io = threaded_io.io();

pub fn fail() void {
    @call(.never_inline, a, .{}) catch {};
    var buffer: [1024]u8 = undefined;
    var writer = std.Io.File.stderr().writer(io, &buffer);
    const wi = &writer.interface;
    std.debug.writeCurrentStackTrace(.{}, .{ .writer = wi, .mode = .no_color }) catch {};
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
