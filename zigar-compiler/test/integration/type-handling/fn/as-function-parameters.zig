const std = @import("std");

pub fn hello() void {
    std.debug.print("hello\n", .{});
}

pub fn world() void {
    std.debug.print("world\n", .{});
}

pub fn call1(cb: *const fn () void) void {
    cb();
}

pub fn call2(cb: *const fn () error{unexpected}!void) !void {
    try cb();
}

pub fn call3(cb: *const fn (i32) i32) i32 {
    return cb(1234);
}

pub var call4_result: i32 = 0;

var gpa = std.heap.GeneralPurposeAllocator(.{}){};
var allocator = gpa.allocator();

pub fn call4(cb: *const fn (i32) i32) !void {
    const ns = struct {
        fn run(f: *const fn (i32) i32) void {
            call4_result = f(1234);
        }
    };
    _ = try std.Thread.spawn(.{
        .allocator = allocator,
    }, ns.run, .{cb});
}
