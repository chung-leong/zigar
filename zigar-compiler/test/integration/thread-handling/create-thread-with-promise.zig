const std = @import("std");
const zigar = @import("zigar");

var gpa = std.heap.GeneralPurposeAllocator(.{}){};
var thread_list = std.ArrayList(std.Thread).init(gpa.allocator());

pub var count: u64 = 0;

pub fn spawn(promise: zigar.function.Promise(i32)) !void {
    try zigar.thread.use();
    const ns = struct {
        fn run(p: zigar.function.Promise(i32)) void {
            p.resolve(1234);
        }
    };
    const thread = try std.Thread.spawn(.{
        .allocator = gpa.allocator(),
        .stack_size = 1024 * 1024,
    }, ns.run, .{promise});
    try thread_list.append(thread);
}

pub fn shutdown() void {
    for (thread_list.items) |t| t.join();
    thread_list.clearAndFree();
    zigar.thread.end();
}
