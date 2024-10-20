const std = @import("std");
const zigar = @import("zigar");

var gpa = std.heap.GeneralPurposeAllocator(.{}){};

pub fn spawn(cb: *const fn () error{Unexpected}!void) !void {
    try zigar.thread.use(true);
    const ns = struct {
        fn run(f: *const fn () error{Unexpected}!void) void {
            f() catch |err| {
                std.debug.print("{s}\n", .{@errorName(err)});
            };
        }
    };
    _ = try std.Thread.spawn(.{
        .allocator = gpa.allocator(),
    }, ns.run, .{cb});
}

pub fn spawnBad(cb: *const fn () error{Disabled}!void) !void {
    const ns = struct {
        fn run(f: *const fn () error{Disabled}!void) void {
            f() catch |err| {
                std.debug.print("{s}\n", .{@errorName(err)});
            };
        }
    };
    _ = try std.Thread.spawn(.{
        .allocator = gpa.allocator(),
    }, ns.run, .{cb});
}

pub fn shutdown() !void {
    try zigar.thread.use(false);
}
