const std = @import("std");
const zigar = @import("zigar");

var gpa = std.heap.GeneralPurposeAllocator(.{}){};

pub fn spawn(cb: *const fn () error{Unexpected}!void) !void {
    const ns = struct {
        fn run(f: *const fn () error{Unexpected}!void) void {
            f() catch |err| {
                std.debug.print("Error: {s}\n", .{@errorName(err)});
            };
        }
    };
    const thread = try std.Thread.spawn(.{
        .allocator = gpa.allocator(),
        .stack_size = 1024 * 512,
    }, ns.run, .{cb});
    thread.detach();
}

pub fn startup() !void {
    try zigar.thread.use();
}

pub fn shutdown() void {
    zigar.thread.end();
}
