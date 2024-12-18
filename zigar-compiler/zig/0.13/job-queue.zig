const std = @import("std");
const builtin = @import("builtin");
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
}

pub fn JobQueue(comptime fn_map: anytype) type {
    const st = @typeInfo(@TypeOf(fn_map)).Struct;
    return struct {
        pub const JobEnum = init: {
            var enum_fields: [st.fields.len]std.builtin.Type.EnumField = undefined;
            for (st.fields, 0..) |field, i| {
                enum_fields[i] = .{ .name = field.name, .value = i };
            }
            break :init @Type(.{
                .Enum = .{
                    .tag_type = if (enum_fields.len <= 256) u8 else u16,
                    .fields = &enum_fields,
                    .decls = &.{},
                    .is_exhaustive = false,
                },
            });
        };
        pub const Job = init: {
            var union_fields: [st.fields.len]std.builtin.Type.UnionField = undefined;
            for (st.fields, 0..) |field, i| {
                union_fields[i] = .{
                    .name = field.name,
                    .type = ArgStruct(field.type),
                    .alignment = @alignOf(ArgStruct(field.type)),
                };
            }
            break :init @Type(.{
                .Union = .{
                    .layout = .auto,
                    .tag_type = JobEnum,
                    .fields = &union_fields,
                    .decls = &.{},
                },
            });
        };
        fn ArgStruct(comptime FT: type) type {
            const ArgsTuple = std.meta.ArgsTuple(FT);
            return @Type(.{
                .Struct = .{
                    .layout = .auto,
                    .fields = std.meta.fields(ArgsTuple),
                    .decls = &.{},
                    .is_tuple = false,
                },
            });
        }

        queue: Queue(Job),
        thread: std.Thread,
        pool: ?*std.Thread.Pool,

        pub fn init(self: *@This(), allocator: std.mem.Allocator, pool: ?*std.Thread.Pool) !void {
            self.pool = pool;
            self.queue = .{ .allocator = allocator };
            self.thread = try std.Thread.spawn(.{ .allocator = allocator }, handleJobs, .{self});
        }

        pub fn deinit(self: *@This()) void {
            self.queue.deinit();
            if (comptime builtin.os.tag == .wasi) {
                const thread = self.thread.impl.thread;
                const wasi = struct {
                    const WasiThread = @TypeOf(thread);
                    export fn wasi_thread_free(arg: WasiThread) void {
                        // need a copy of the allocator struct since it's stored in the memory being freed
                        var allocator = arg.allocator;
                        allocator.free(arg.memory);
                    }
                    extern "wasi" fn @"thread-join"(tid: *i32, arg: WasiThread) void;
                };
                wasi.@"thread-join"(&thread.tid.raw, thread);
            } else {
                self.thread.join();
            }
        }

        pub fn push(self: *@This(), comptime key: JobEnum, args: anytype) !void {
            try self.queue.push(@unionInit(Job, @tagName(key), args));
        }

        pub fn clear(self: *@This()) void {
            while (self.queue.pull() != null) {}
            self.pool = null;
        }

        fn handleJobs(self: *@This()) void {
            while (true) {
                if (self.queue.pull()) |job| {
                    if (self.pool) |pool| {
                        // spawn can fail in low-memory situation, in which case we just
                        // run the function here
                        pool.spawn(invokeFunction, .{job}) catch invokeFunction(job);
                    } else {
                        invokeFunction(job);
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

        fn invokeFunction(job: Job) void {
            inline for (st.fields) |field| {
                const key = @field(JobEnum, field.name);
                if (job == key) {
                    const ArgsTuple = std.meta.ArgsTuple(field.type);
                    const f = @field(fn_map, field.name);
                    const args = @field(job, field.name);
                    var args_tuple: ArgsTuple = undefined;
                    inline for (std.meta.fields(ArgsTuple)) |arg_field| {
                        @field(args_tuple, arg_field.name) = @field(args, arg_field.name);
                    }
                    _ = @call(.auto, f, args_tuple);
                }
            }
        }
    };
}

test "JobQueue" {
    const ns = struct {
        var total: i32 = 0;

        fn hello(num: i32) void {
            total += num;
        }

        fn world() void {}
    };
    var gpa = std.heap.GeneralPurposeAllocator(.{}){};
    var queue: JobQueue(.{
        .hi = ns.hello,
        .ho = ns.world,
    }) = undefined;
    try queue.init(gpa.allocator(), null);
    try queue.push(.hi, .{123});
    try queue.push(.hi, .{456});
    try queue.push(.ho, .{});
    std.time.sleep(1e+8);
    try expect(ns.total == 123 + 456);
    queue.deinit();
}
