const std = @import("std");
const zigar = @import("zigar");

var gpa = std.heap.GeneralPurposeAllocator(.{}){};

pub var count: u64 = 0;

pub fn spawn(generator: zigar.function.Generator(?[]const u8)) !void {
    const ns = struct {
        fn run(g: zigar.function.Generator(?[]const u8)) void {
            for (0..5) |_| {
                if (!g.yield("Hello world")) break;
            } else g.end();
        }
    };
    const thread = try std.Thread.spawn(.{
        .allocator = gpa.allocator(),
        .stack_size = 1024 * 1024,
    }, ns.run, .{generator});
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
