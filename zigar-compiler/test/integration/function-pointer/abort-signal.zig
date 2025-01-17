const std = @import("std");
const zigar = @import("zigar");

pub const Callback = *const fn (signal: zigar.function.AbortSignal) void;

var int: i32 = 0;

pub fn call(f: Callback) !void {
    const signal: zigar.function.AbortSignal = .{ .ptr = &int };
    f(signal);
    zigar.function.release(f);
    const ns = struct {
        fn run(ptr: *i32) void {
            std.time.sleep(10 * 1000000);
            ptr.* = 1;
        }
    };
    _ = try std.Thread.spawn(.{
        .allocator = zigar.mem.getDefaultAllocator(),
        .stack_size = 65536,
    }, ns.run, .{&int});
}
