const std = @import("std");
const zigar = @import("zigar");

var gpa = std.heap.GeneralPurposeAllocator(.{}){};

pub fn spawn(cb: *const fn () void) !void {
    try zigar.thread.use(true);
    const ns = struct {
        fn run(f: *const fn () void) void {
            f();
        }
    };
    _ = try std.Thread.spawn(.{
        .allocator = gpa.allocator(),
    }, ns.run, .{cb});
}

pub fn shutdown() !void {
    try zigar.thread.use(false);
}
