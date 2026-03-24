const std = @import("std");
const zigar = @import("zigar");

var gpa = std.heap.GeneralPurposeAllocator(.{}){};

pub var count: u64 = 0;

pub fn spawn(promise: zigar.function.Promise(i32), create: bool) !?i32 {
    const ns = struct {
        fn run(p: zigar.function.Promise(i32)) void {
            p.resolve(1234);
        }
    };
    if (create) {
        const thread = try std.Thread.spawn(.{
            .allocator = gpa.allocator(),
            .stack_size = 1024 * 1024,
        }, ns.run, .{promise});
        thread.detach();
        return null;
    } else {
        return 777;
    }
}

pub fn startup() !void {
    try zigar.thread.use();
}

pub fn shutdown() void {
    zigar.thread.end();
}
