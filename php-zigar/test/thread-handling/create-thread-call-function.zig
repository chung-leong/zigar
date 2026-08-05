const std = @import("std");

const zigar = @import("zigar");

pub fn spawn(cb: *const fn () error{Unexpected}!void) !void {
    const ns = struct {
        fn run(f: *const fn () error{Unexpected}!void) void {
            f() catch |err| {
                std.debug.print("Error: {s}\n", .{@errorName(err)});
            };
        }
    };
    const thread = try std.Thread.spawn(.{}, ns.run, .{cb});
    thread.detach();
}

pub fn startup() !void {
    try zigar.thread.use();
}

pub fn shutdown() void {
    zigar.thread.end();
}
