const std = @import("std");
const builtin = @import("builtin");

var threaded_io: std.Io.Threaded = undefined;

pub fn init() void {
    const env_block: std.process.Environ.Block = switch (builtin.target.os.tag) {
        .windows => .global,
        else => .{ .slice = @ptrCast(std.mem.sliceTo(std.c.environ, null)) },
    };
    threaded_io = .{
        .allocator = std.heap.c_allocator,
        .stack_size = std.Thread.SpawnConfig.default_stack_size,
        .async_limit = .nothing,
        .cpu_count_error = null,
        .concurrent_limit = .nothing,
        .old_sig_io = undefined,
        .old_sig_pipe = undefined,
        .have_signal_handler = false,
        .argv0 = .empty,
        .environ_initialized = env_block.isEmpty(),
        .environ = .{ .process_environ = .{ .block = env_block } },
        .worker_threads = .init(null),
        .disable_memory_mapping = false,
    };
}

pub const io: std.Io = threaded_io.io();
