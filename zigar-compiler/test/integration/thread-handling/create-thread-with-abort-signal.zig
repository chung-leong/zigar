const std = @import("std");
const zigar = @import("zigar");

var gpa = std.heap.GeneralPurposeAllocator(.{}){};
var thread_list = std.ArrayList(std.Thread).init(gpa.allocator());

const Error = error{Aborted};

pub fn spawn(
    fail: bool,
    promise: zigar.function.Promise(Error!i32),
    signal: zigar.function.AbortSignal,
) !void {
    try zigar.thread.use();
    const ns = struct {
        fn run(f: bool, p: zigar.function.Promise(Error!i32), s: zigar.function.AbortSignal) void {
            while (s.off()) {}
            p.resolve(if (f) Error.Aborted else 1234);
        }
    };
    const thread = try std.Thread.spawn(.{
        .allocator = gpa.allocator(),
        .stack_size = 1024 * 1024,
    }, ns.run, .{ fail, promise, signal });
    try thread_list.append(thread);
}

pub fn shutdown() void {
    for (thread_list.items) |t| t.join();
    thread_list.clearAndFree();
    zigar.thread.end();
}
