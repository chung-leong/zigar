const std = @import("std");

const zigar = @import("zigar");

var gpa = std.heap.GeneralPurposeAllocator(.{}){};

pub var count: u64 = 0;

pub fn spawn(generator: zigar.function.Generator(?[]const u8, true)) !void {
    const ns = struct {
        fn run(g: zigar.function.Generator(?[]const u8, true)) !void {
            for (0..5) |_| {
                const s = try g.allocator.dupe(u8, "Hello world");
                if (!g.yield(s)) break;
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

const module = @This();
pub const @"meta(zigar)" = struct {
    pub fn isDeclString(comptime T: type, comptime decl: std.meta.DeclEnum(T)) bool {
        return switch (T) {
            module => decl == .spawn,
            else => false,
        };
    }
};
