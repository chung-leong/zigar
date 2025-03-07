const std = @import("std");

var gpa = std.heap.GeneralPurposeAllocator(.{}){};

pub fn spawn() !i32 {
    const ns = struct {
        fn run() void {
            std.debug.print("Hello!", .{});
        }
    };
    _ = try std.Thread.spawn(.{
        .allocator = gpa.allocator(),
        .stack_size = 64 * 1024,
    }, ns.run, .{});
    return 123;
}
