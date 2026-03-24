const std = @import("std");
const zigar = @import("zigar");

var gpa = std.heap.GeneralPurposeAllocator(.{}){};

pub fn spawn(
    allocator: std.mem.Allocator,
    promise: zigar.function.Promise(std.mem.Allocator.Error![]const u8),
) !void {
    const ns = struct {
        fn run(
            a: std.mem.Allocator,
            p: zigar.function.Promise(std.mem.Allocator.Error![]const u8),
        ) void {
            p.resolve(a.dupe(u8, "Hello world"));
        }
    };
    const thread = try std.Thread.spawn(.{
        .allocator = gpa.allocator(),
        .stack_size = 1024 * 512,
    }, ns.run, .{ allocator, promise });
    thread.detach();
}

pub fn startup() !void {
    try zigar.thread.use();
}

pub fn shutdown() void {
    zigar.thread.end();
}
