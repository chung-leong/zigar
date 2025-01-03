const std = @import("std");
const zigar = @import("zigar");

var gpa = std.heap.GeneralPurposeAllocator(.{}){};

pub var count: u64 = 0;

pub fn spawn(promise: zigar.function.Promise(i32), create: bool) !?i32 {
    try zigar.thread.use();
    const ns = struct {
        fn run(p: zigar.function.Promise(i32)) void {
            p.resolve(1234);
        }
    };
    if (create) {
        _ = try std.Thread.spawn(.{
            .allocator = gpa.allocator(),
        }, ns.run, .{promise});
        return null;
    } else {
        return 777;
    }
}

pub fn shutdown() void {
    zigar.thread.end();
}
