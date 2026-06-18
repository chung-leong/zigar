const std = @import("std");

const zigar = @import("zigar");

pub fn spawn1(callback: *const fn () void, promise: zigar.function.Promise(i32)) !void {
    const ns = struct {
        fn run(cb: *const fn () void, p: zigar.function.Promise(i32)) void {
            cb();
            p.resolve(1234);
        }
    };
    const thread = try std.Thread.spawn(.{}, ns.run, .{ callback, promise });
    thread.detach();
}

pub fn spawn2(promise: zigar.function.Promise(i32)) !void {
    const ns = struct {
        fn run(p: zigar.function.Promise(i32)) void {
            p.resolve(4567);
        }
    };
    const thread = try std.Thread.spawn(.{}, ns.run, .{promise});
    thread.detach();
}

pub fn startup() !void {
    try zigar.thread.use();
}

pub fn shutdown() void {
    zigar.thread.end();
}
