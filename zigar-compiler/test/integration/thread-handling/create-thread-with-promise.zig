const std = @import("std");
const zigar = @import("zigar");

var gpa = std.heap.GeneralPurposeAllocator(.{}){};

pub var count: u64 = 0;

pub fn spawn(promise: zigar.function.Promise(i32)) !void {
    try zigar.thread.use();
    const ns = struct {
        fn run(p: zigar.function.Promise(i32)) void {
            p.resolve(1234);
        }
    };
    _ = try std.Thread.spawn(.{
        .allocator = gpa.allocator(),
    }, ns.run, .{promise});
}

pub fn shutdown() !void {
    try zigar.thread.end();
}
