const std = @import("std");
const zigar = @import("zigar");

var gpa = std.heap.GeneralPurposeAllocator(.{}){};

pub var count: u64 = 0;

pub fn spawn(promise: zigar.function.Promise([]const u8)) !void {
    const ns = struct {
        fn run(p: zigar.function.Promise([]const u8)) void {
            p.resolve("Hello world");
        }
    };
    const thread = try std.Thread.spawn(.{
        .allocator = gpa.allocator(),
        .stack_size = 1024 * 1024,
    }, ns.run, .{promise});
    thread.detach();
}

pub fn startup() !void {
    try zigar.thread.use();
}

pub fn shutdown() void {
    zigar.thread.end();
}

pub const @"meta(zigar)" = struct {
    pub fn isRetvalString(comptime func: anytype) bool {
        return func == spawn;
    }
};
