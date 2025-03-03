const std = @import("std");
const allocator = std.heap.wasm_allocator;

extern fn main(c_int, [*c][*c]u8) c_int;

fn run() void {
    _ = main(0, null);
}

pub fn spawn() !void {
    const thread = try std.Thread.spawn(.{
        .allocator = allocator,
        .stack_size = 256 * 1024,
    }, run, .{});
    thread.detach();
}
