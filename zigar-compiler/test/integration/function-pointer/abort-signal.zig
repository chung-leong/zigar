const std = @import("std");
var threaded_io = std.Io.Threaded.init_single_threaded;

const zigar = @import("zigar");

const io = threaded_io.io();

pub const Callback = *const fn (signal: zigar.function.AbortSignal) void;

var int: i32 = 0;
var gpa = std.heap.DebugAllocator(.{}).init;
const allocator = gpa.allocator();

pub fn call(f: Callback) !void {
    const signal: zigar.function.AbortSignal = .{ .ptr = &int };
    f(signal);
    zigar.function.release(f);
    const ns = struct {
        fn run(ptr: *i32) void {
            std.Io.sleep(io, .fromMilliseconds(10), .real) catch unreachable;
            ptr.* = 1;
        }
    };
    _ = try std.Thread.spawn(.{
        .allocator = allocator,
        .stack_size = 1024 * 1024,
    }, ns.run, .{&int});
}
