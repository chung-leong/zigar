const std = @import("std");
const expectEqual = std.testing.expectEqual;

const LinkedList = @import("linked-list.zig").LinkedList;

pub fn Queue(comptime T: type) type {
    return struct {
        list: LinkedList(T),
        stopped: bool = false,
        item_futex: std.atomic.Value(u32) = std.atomic.Value(u32).init(0),
        io: std.Io,

        pub fn init(allocator: std.mem.Allocator, io: std.Io) @This() {
            return .{ .list = .init(allocator), .io = io };
        }

        pub fn push(self: *@This(), value: T) !void {
            _ = try self.list.push(value);
            self.item_futex.store(1, .release);
            std.Io.futexWake(self.io, u32, &self.item_futex.raw, 1);
        }

        pub fn pull(self: *@This()) ?T {
            if (self.list.shift()) |value| return value;
            self.item_futex.store(0, .release);
            return null;
        }

        pub fn wait(self: *@This()) void {
            std.Io.futexWaitUncancelable(self.io, u32, &self.item_futex.raw, 0);
        }

        pub fn stop(self: *@This()) void {
            if (self.stopped) return;
            self.stopped = true;
            while (self.pull()) |_| {}
            // wake up awaking threads and prevent them from sleep again
            self.item_futex.store(1, .release);
            std.Io.futexWake(self.io, u32, &self.item_futex.raw, std.math.maxInt(u32));
        }

        pub fn deinit(self: *@This()) void {
            self.list.deinit();
        }
    };
}

test "Queue.pull()" {
    var gpa = std.heap.DebugAllocator(.{}).init;
    var thread_io = std.Io.Threaded.init_single_threaded;
    var queue: Queue(i32) = .init(gpa.allocator(), thread_io.io());
    defer queue.deinit();
    try queue.push(123);
    try queue.push(456);
    const value1 = queue.pull();
    try expectEqual(123, value1);
    const value2 = queue.pull();
    try expectEqual(456, value2);
    const value3 = queue.pull();
    try expectEqual(null, value3);
    try queue.push(888);
    const value4 = queue.pull();
    try expectEqual(888, value4);
}
