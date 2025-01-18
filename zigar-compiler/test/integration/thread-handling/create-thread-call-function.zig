const std = @import("std");
const zigar = @import("zigar");

var gpa = std.heap.GeneralPurposeAllocator(.{}){};
var thread_list = std.ArrayList(std.Thread).init(gpa.allocator());

pub fn spawn(cb: *const fn () error{Unexpected}!void) !void {
    try zigar.thread.use();
    const ns = struct {
        fn run(f: *const fn () error{Unexpected}!void) void {
            f() catch |err| {
                std.debug.print("Error: {s}\n", .{@errorName(err)});
            };
        }
    };
    const thread = try std.Thread.spawn(.{
        .allocator = gpa.allocator(),
        .stack_size = 256 * 1024,
    }, ns.run, .{cb});
    try thread_list.append(thread);
}

pub fn shutdown() void {
    for (thread_list.items) |t| t.join();
    thread_list.clearAndFree();
    zigar.thread.end();
}
