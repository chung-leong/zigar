const std = @import("std");
const builtin = @import("builtin");

const c = @import("c");
const zigar = @import("zigar");

const os = switch (builtin.target.os.tag) {
    .linux => .linux,
    .driverkit, .ios, .macos, .tvos, .visionos, .watchos => .darwin,
    .windows => .windows,
    else => .unknown,
};

var gpa = std.heap.GeneralPurposeAllocator(.{}){};

pub fn print(promise: zigar.function.Promise(void)) !void {
    const thread = try std.Thread.spawn(.{
        .allocator = gpa.allocator(),
    }, run, .{promise});
    thread.detach();
}

fn run(promise: zigar.function.Promise(void)) !void {
    const stdin = switch (os) {
        .darwin => c.stdin(),
        .windows => c.__acrt_iob_func(0),
        else => c.stdin,
    };
    var buffer: [128]u8 = undefined;
    while (true) {
        const result = c.fgets(&buffer, @intCast(buffer.len), stdin);
        if (result == null) break;
        const line: [*:0]const u8 = @ptrCast(result);
        std.debug.print("> {s}", .{line});
    }
    promise.resolve({});
}

pub fn startup() !void {
    try zigar.thread.use();
}

pub fn shutdown() void {
    zigar.thread.end();
}
