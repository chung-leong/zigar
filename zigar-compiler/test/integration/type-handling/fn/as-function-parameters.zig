const std = @import("std");
const zigar = @import("zigar");

pub fn hello() void {
    std.debug.print("hello\n", .{});
}

pub fn world() void {
    std.debug.print("world\n", .{});
}

pub const Callback1 = fn () void;

pub fn call1(cb: *const fn () void) void {
    defer zigar.function.release(cb);
    cb();
}

pub fn call2(cb: *const fn () error{Unexpected}!void) !void {
    defer zigar.function.release(cb);
    try cb();
}

pub fn call3(cb: *const fn (i32) i32) i32 {
    defer zigar.function.release(cb);
    return cb(1234);
}

pub var call4_result: i32 = 0;

var gpa = std.heap.GeneralPurposeAllocator(.{}){};
var allocator = gpa.allocator();

pub fn call4(cb: *const fn (i32) i32) !void {
    try zigar.thread.use();
    const ns = struct {
        fn run(f: *const fn (i32) i32) void {
            call4_result = f(1234);
        }
    };
    const thread = try std.Thread.spawn(.{
        .allocator = allocator,
        .stack_size = 1024 * 1024,
    }, ns.run, .{cb});
    thread.detach();
}

pub fn shutdown() void {
    zigar.thread.end();
}
