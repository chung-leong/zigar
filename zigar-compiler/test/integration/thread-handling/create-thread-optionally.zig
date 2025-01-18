const std = @import("std");
const zigar = @import("zigar");

var gpa = std.heap.GeneralPurposeAllocator(.{}){};
var thread_list = std.ArrayList(std.Thread).init(gpa.allocator());

pub var count: u64 = 0;

pub fn spawn(promise: zigar.function.Promise(i32), create: bool) !?i32 {
    try zigar.thread.use();
    const ns = struct {
        fn run(p: zigar.function.Promise(i32)) void {
            p.resolve(1234);
        }
    };
    if (create) {
        const thread = try std.Thread.spawn(.{
            .allocator = gpa.allocator(),
            .stack_size = 256 * 1024,
        }, ns.run, .{promise});
        try thread_list.append(thread);
        return null;
    } else {
        return 777;
    }
}

pub fn shutdown() void {
    for (thread_list.items) |t| t.join();
    thread_list.clearAndFree();
    zigar.thread.end();
}
