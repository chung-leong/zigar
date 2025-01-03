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
            while (s.off()) {}
            p.resolve(if (f) Error.Aborted else 1234);
        }
    };
    _ = try std.Thread.spawn(.{
        .allocator = gpa.allocator(),
    }, ns.run, .{ fail, promise, signal });
}

pub fn shutdown() void {
    zigar.thread.end();
}
