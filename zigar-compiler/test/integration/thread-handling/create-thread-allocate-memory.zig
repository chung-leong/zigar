const std = @import("std");
const zigar = @import("zigar");

var gpa = std.heap.GeneralPurposeAllocator(.{}){};
var thread_list = std.ArrayList(std.Thread).init(gpa.allocator());

pub fn spawn(
    allocator: std.mem.Allocator,
    promise: zigar.function.Promise(std.mem.Allocator.Error![]const u8),
) !void {
    try zigar.thread.use();
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
    }, ns.run, .{ allocator, promise });
    try thread_list.append(thread);
}

pub fn shutdown() void {
    for (thread_list.items) |t| t.join();
    thread_list.clearAndFree();
    zigar.thread.end();
}
