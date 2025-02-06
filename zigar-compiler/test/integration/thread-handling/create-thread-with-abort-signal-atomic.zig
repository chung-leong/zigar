const std = @import("std");
const zigar = @import("zigar");

var gpa = std.heap.GeneralPurposeAllocator(.{}){};

const Error = error{Aborted};

pub fn spawn(
    fail: bool,
    promise: zigar.function.Promise(Error!i32),
    signal: zigar.function.AbortSignal,
) !void {
    try zigar.thread.use();
    const ns = struct {
        fn run(f: bool, p: zigar.function.Promise(Error!i32), s: zigar.function.AbortSignal) void {
            while (@atomicLoad(i32, s.ptr, .acquire) == 0) {}
            p.resolve(if (f) Error.Aborted else 1234);
        }
    };
    const thread = try std.Thread.spawn(.{
        .allocator = gpa.allocator(),
        .stack_size = 1024 * 1024,
    }, ns.run, .{ fail, promise, signal });
    thread.detach();
}

pub fn shutdown() void {
    zigar.thread.end();
}
