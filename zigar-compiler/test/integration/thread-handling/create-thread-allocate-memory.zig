const std = @import("std");
const zigar = @import("zigar");

var gpa = std.heap.GeneralPurposeAllocator(.{}){};

pub fn spawn(
    allocator: std.mem.Allocator,
    promise: zigar.function.Promise(std.mem.Allocator.Error![]const u8),
) !void {
    try zigar.thread.use(true);
    const ns = struct {
        fn run(
            a: std.mem.Allocator,
            p: zigar.function.Promise(std.mem.Allocator.Error![]const u8),
        ) void {
            p.resolve(a.dupe(u8, "Hello world"));
        }
    };
    _ = try std.Thread.spawn(.{
        .allocator = gpa.allocator(),
    }, ns.run, .{ allocator, promise });
}

pub fn shutdown() !void {
    try zigar.thread.use(false);
}
