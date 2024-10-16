const std = @import("std");
const zigar = @import("zigar");

var gpa = std.heap.GeneralPurposeAllocator(.{}){};

pub var count: u64 = 0;

pub fn spawn(signal: zigar.function.AbortSignal) !void {
    try zigar.thread.use(true);
    const ns = struct {
        fn run(s: zigar.function.AbortSignal) void {
            while (!s.signaledAtomic()) {
                count += 1;
            }
        }
    };
    _ = try std.Thread.spawn(.{
        .allocator = gpa.allocator(),
    }, ns.run, .{signal});
}

pub fn shutdown() !void {
    try zigar.thread.use(false);
}
