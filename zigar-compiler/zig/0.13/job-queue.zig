const std = @import("std");
const expect = std.testing.expect;

fn Queue(comptime T: type) type {
    return struct {
        const Node = struct {
            next: *Node,
            payload: T,
        };
        const tail: *Node = @ptrFromInt(std.mem.alignBackward(usize, std.math.maxInt(usize), @alignOf(Node)));

        head: *Node = tail,
        allocator: std.mem.Allocator,
        count: std.atomic.Value(u32) = std.atomic.Value(u32).init(0),
        stopped: bool = false,

        pub fn push(self: *@This(), value: T) !void {
            const new_node = try self.allocator.create(Node);
            new_node.* = .{ .next = tail, .payload = value };
            // link new node to the left of the tail
            self.attachOnLeft(new_node, tail);
            // increment count and wake up any awaking thread
            _ = self.count.fetchAdd(1, .release);
            std.Thread.Futex.wake(&self.count, std.math.maxInt(u32));
        }

        pub fn pull(self: *@This()) ?T {
            var current_node = self.head;
            const detached_node: ?*Node = while (current_node != tail) {
                const next_node = getUnmarkedReference(current_node.next);
                if (!isMarkedReference(current_node.next)) {
                    if (@cmpxchgWeak(*Node, &current_node.next, next_node, getMarkedReference(next_node), .seq_cst, .monotonic) == null) {
                        // remove current node from linked list by pointing the next pointer of the previous node to the next node
                        self.attachOnLeft(next_node, current_node);
                        break current_node;
                    }
                }
                current_node = next_node;
            } else null;
            var payload: ?T = null;
            if (detached_node) |n| {
                payload = n.payload;
                self.allocator.destroy(n);
                _ = self.count.fetchSub(1, .monotonic);
            }
            return payload;
        }

        pub fn wait(self: *@This()) void {
            std.Thread.Futex.wait(&self.count, 0);
        }

        pub fn deinit(self: *@This()) void {
            while (self.pull() != null) {}
            self.stopped = true;
            // wake up awaking threads and prevent them from sleep again
            self.count.store(std.math.maxInt(u32), .release);
            std.Thread.Futex.wake(&self.count, std.math.maxInt(u32));
        }

        fn attachOnLeft(self: *@This(), node: *Node, ref_node: *Node) void {
            while (true) {
                var next_ptr: **Node = undefined;
                var current_node = self.head;
                if (current_node == ref_node) {
                    next_ptr = &self.head;
                } else {
                    const left_node: *Node = while (current_node != tail) {
                        const next_node = getUnmarkedReference(current_node.next);
                        if (next_node == ref_node) break current_node;
                        current_node = next_node;
                    } else tail;
                    if (left_node == tail or isMarkedReference(left_node.next)) {
                        // try again
                        continue;
                    }
                    next_ptr = &left_node.next;
                }
                if (@cmpxchgWeak(*Node, next_ptr, ref_node, node, .seq_cst, .monotonic) == null) {
                    break;
                } else {
                    // try again
                }
            }
        }

        fn isMarkedReference(ptr: *Node) bool {
            return @intFromPtr(ptr) & 1 != 0;
        }

        fn getUnmarkedReference(ptr: *Node) *Node {
            return @ptrFromInt(@intFromPtr(ptr) & ~@as(usize, 1));
        }

        fn getMarkedReference(ptr: *Node) *Node {
            @setRuntimeSafety(false);
            return @ptrFromInt(@intFromPtr(ptr) | @as(usize, 1));
        }
    };
}

test "Queue" {
    var gpa = std.heap.GeneralPurposeAllocator(.{}){};
    var queue: Queue(i32) = .{ .allocator = gpa.allocator() };
    try queue.push(123);
    try queue.push(456);
    const value1 = queue.pull();
    const count1 = queue.count.load(.acquire);
    try expect(value1 == 123);
    try expect(count1 == 1);
    const value2 = queue.pull();
    const count2 = queue.count.load(.acquire);
    try expect(value2 == 456);
    try expect(count2 == 0);
    const value3 = queue.pull();
    try expect(value3 == null);
    try queue.push(888);
    queue.deinit();
    const value4 = queue.pull();
    try expect(value4 == null);
}

pub fn JobQueue(comptime f: anytype) type {
    const ArgsTuple = std.meta.ArgsTuple(@TypeOf(f));
    const tuple_fields = std.meta.fields(ArgsTuple);
    // define struct type for queue
    const Args = @Type(.{
        .Struct = .{
            .layout = .auto,
            .fields = tuple_fields,
            .decls = &.{},
            .is_tuple = false,
        },
    });
    return struct {
        n_jobs: u32,
        pool: std.Thread.Pool,
        queue: Queue(Args),
        thread: std.Thread,

        pub fn init(self: *@This(), options: std.Thread.Pool.Options) !void {
            self.n_jobs = options.n_jobs orelse 1;
            if (self.n_jobs > 1) {
                try self.pool.init(options);
            }
            self.queue = .{ .allocator = options.allocator };
            self.thread = try std.Thread.spawn(.{}, handleJobs, .{self});
        }

        pub fn deinit(self: *@This()) void {
            self.queue.deinit();
            self.thread.join();
            if (self.n_jobs > 1) {
                self.pool.deinit();
            }
        }

        pub fn push(self: *@This(), args_tuple: anytype) !void {
            var args: Args = undefined;
            inline for (tuple_fields) |field| {
                @field(args, field.name) = @field(args_tuple, field.name);
            }
            try self.queue.push(args);
        }

        fn handleJobs(self: *@This()) void {
            while (true) {
                if (self.queue.pull()) |args| {
                    if (self.n_jobs > 1) {
                        self.pool.spawn(invokeFunction, .{args}) catch {
                            invokeFunction(args);
                        };
                    } else {
                        // just call the function here when there's only one thread
                        invokeFunction(args);
                    }
                } else {
                    if (self.queue.stopped) {
                        break;
                    } else {
                        self.queue.wait();
                    }
                }
            }
        }

        fn invokeFunction(args: Args) void {
            var args_tuple: ArgsTuple = undefined;
            inline for (tuple_fields) |field| {
                @field(args_tuple, field.name) = @field(args, field.name);
            }
            _ = @call(.auto, f, args_tuple);
        }
    };
}

test "JobQueue" {
    const ns = struct {
        var total: i32 = 0;

        fn hello(num: i32) void {
            total += num;
        }
    };
    var gpa = std.heap.GeneralPurposeAllocator(.{}){};
    var queue1: JobQueue(ns.hello) = undefined;
    try queue1.init(.{ .n_jobs = 1, .allocator = gpa.allocator() });
    try queue1.push(.{123});
    try queue1.push(.{456});
    std.time.sleep(1e+8);
    try expect(ns.total == 123 + 456);
    queue1.deinit();
    var queue2: JobQueue(ns.hello) = undefined;
    try queue2.init(.{ .n_jobs = 2, .allocator = gpa.allocator() });
    try queue2.push(.{123});
    try queue2.push(.{456});
    std.time.sleep(1e+8);
    try expect(ns.total == (123 + 456) * 2);
    queue2.deinit();
}
