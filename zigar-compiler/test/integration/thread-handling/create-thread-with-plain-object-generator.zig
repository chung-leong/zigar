const std = @import("std");

const zigar = @import("zigar");

var gpa = std.heap.GeneralPurposeAllocator(.{}){};

pub var count: u64 = 0;

const Struct = struct {
    x: u64,
    y: u64,
};

pub fn spawn(generator: zigar.function.Generator(?Struct, false)) !void {
    const ns = struct {
        fn run(g: zigar.function.Generator(?Struct, false)) void {
            for (0..5) |i| {
                if (!g.yield(.{ .x = i * 10, .y = i * 100 })) break;
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
    pub fn isDeclPlain(comptime T: type, comptime decl: std.meta.DeclEnum(T)) bool {
        return switch (T) {
            module => decl == .spawn,
            else => false,
        };
    }
};
