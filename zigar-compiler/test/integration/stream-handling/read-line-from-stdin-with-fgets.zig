const std = @import("std");

const zigar = @import("zigar");

const stdio = @cImport({
    @cInclude("stdio.h");
});

var gpa = std.heap.GeneralPurposeAllocator(.{}){};

pub fn print(promise: zigar.function.Promise(void)) !void {
    const thread = try std.Thread.spawn(.{
        .allocator = gpa.allocator(),
    }, run, .{promise});
    thread.detach();
}

fn run(promise: zigar.function.Promise(void)) !void {
    const stdin = switch (@typeInfo(@TypeOf(stdio.stdin))) {
        .@"fn" => stdio.stdin(),
        else => stdio.stdin,
    };
    var buffer: [128]u8 = undefined;
    while (true) {
        const result = stdio.fgets(&buffer, @intCast(buffer.len), stdin);
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
