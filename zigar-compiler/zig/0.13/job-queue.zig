const std = @import("std");
const builtin = @import("builtin");
const types = @import("types.zig");
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
            std.Thread.Futex.wake(&self.count, 1);
        }

        pub fn pull(self: *@This()) ?T {
            var current_node = self.head;
            return while (current_node != tail) {
                const next_node = getUnmarkedReference(current_node.next);
                if (!isMarkedReference(current_node.next)) {
                    if (@cmpxchgWeak(*Node, &current_node.next, next_node, getMarkedReference(next_node), .seq_cst, .monotonic) == null) {
                        // remove current node from linked list by pointing the next pointer of the previous node to the next node
                        self.attachOnLeft(next_node, current_node);
                        defer self.allocator.destroy(current_node);
                        _ = self.count.fetchSub(1, .release);
                        break current_node.payload;
                    }
                }
                current_node = next_node;
            } else null;
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

const Promise = types.Promise;
const PromiseOf = types.PromiseOf;

pub fn JobQueue(comptime ns: type) type {
    const st = switch (@typeInfo(ns)) {
        .Struct => |st| st,
        else => @compileError("Struct expected, received " ++ @typeName(ns)),
    };
    return struct {
        queue: Queue(Job) = undefined,
        threads: []std.Thread = undefined,
        thread_count: std.atomic.Value(usize) = .{ .raw = 0 },
        initialized: bool = false,
        deinit_promise: ?Promise(void) = null,

        pub const Options = struct {
            allocator: std.mem.Allocator,
            n_jobs: usize = 1,
        };

        pub fn init(self: *@This(), options: Options) !void {
            if (self.initialized) return error.AlreadyInitialized;
            const allocator = options.allocator;
            self.queue = .{ .allocator = allocator };
            self.threads = try allocator.alloc(std.Thread, options.n_jobs);
            errdefer allocator.free(self.threads);
            var thread_count: usize = 0;
            errdefer for (0..thread_count) |i| self.threads[i].join();
            errdefer self.queue.deinit();
            for (0..options.n_jobs) |i| {
                self.threads[i] = try std.Thread.spawn(.{ .allocator = allocator }, handleJobs, .{self});
                thread_count += 1;
            }
            self.thread_count.store(thread_count, .release);
            self.initialized = true;
        }

        pub fn deinit(self: *@This()) void {
            if (!self.initialized) return;
            self.initialized = false;
            self.queue.deinit();
            for (self.threads) |thread| thread.join();
            self.queue.allocator.free(self.threads);
        }

        pub fn deinitAsync(self: *@This(), promise: types.Promise(void)) !void {
            if (!self.initialized) return error.NotInitialized;
            self.initialized = false;
            self.deinit_promise = promise;
            self.queue.deinit();
        }

        pub fn push(self: *@This(), comptime f: anytype, args: anytype, promise: ?PromiseOf(f)) !void {
            if (!self.initialized) return error.NotInitialized;
            const key = comptime EnumOf(f);
            const job = @unionInit(Job, @tagName(key), .{ .args = args, .promise = promise });
            try self.queue.push(job);
        }

        pub fn clear(self: *@This()) void {
            if (!self.initialized) return;
            while (self.queue.pull() != null) {}
        }

        const Job = init: {
            var enum_fields: [st.decls.len]std.builtin.Type.EnumField = undefined;
            var union_fields: [st.decls.len]std.builtin.Type.UnionField = undefined;
            var count = 0;
            for (st.decls) |decl| {
                const DT = @TypeOf(@field(ns, decl.name));
                if (@typeInfo(DT) == .Fn) {
                    const Task = struct {
                        args: ArgStruct(DT),
                        promise: ?types.PromiseOf(DT),
                    };
                    enum_fields[count] = .{ .name = decl.name, .value = count };
                    union_fields[count] = .{
                        .name = decl.name,
                        .type = Task,
                        .alignment = @alignOf(Task),
                    };
                    count += 1;
                }
            }
            break :init @Type(.{
                .Union = .{
                    .layout = .auto,
                    .tag_type = @Type(.{
                        .Enum = .{
                            .tag_type = if (count <= 256) u8 else u16,
                            .fields = enum_fields[0..count],
                            .decls = &.{},
                            .is_exhaustive = true,
                        },
                    }),
                    .fields = union_fields[0..count],
                    .decls = &.{},
                },
            });
        };
        const JobEnum = @typeInfo(Job).Union.tag_type.?;

        fn EnumOf(comptime f: anytype) JobEnum {
            return for (st.decls) |decl| {
                const dv = @field(ns, decl.name);
                if (@TypeOf(dv) == @TypeOf(f)) {
                    if (dv == f) break @field(JobEnum, decl.name);
                }
            } else @compileError("Function not found in " ++ @typeName(ns));
        }

        fn ArgsOf(comptime f: anytype) type {
            if (@typeInfo(@TypeOf(f)) != .Fn) @compileError("Function expected");
            return ArgStruct(@TypeOf(f));
        }

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

        fn handleJobs(self: *@This()) void {
            while (true) {
                if (self.queue.pull()) |job| {
                    invokeFunction(job);
                } else {
                    if (self.queue.stopped) {
                        break;
                    } else {
                        self.queue.wait();
                    }
                }
            }
            if (self.deinit_promise) |promise| {
                if (self.thread_count.fetchSub(1, .acq_rel) == 0) {
                    for (self.threads) |thread| thread.join();
                    self.queue.allocator.free(self.threads);
                    promise.resolve({});
                }
            }
        }

        fn invokeFunction(job: Job) void {
            const un = @typeInfo(Job).Union;
            inline for (un.fields) |field| {
                const key = @field(JobEnum, field.name);
                if (job == key) {
                    const func = @field(ns, field.name);
                    const ArgsTuple = std.meta.ArgsTuple(@TypeOf(func));
                    const task = @field(job, field.name);
                    var args_tuple: ArgsTuple = undefined;
                    inline for (std.meta.fields(ArgsTuple)) |arg_field| {
                        @field(args_tuple, arg_field.name) = @field(task.args, arg_field.name);
                    }
                    const result = @call(.auto, func, args_tuple);
                    if (task.promise) |promise| {
                        promise.resolve(result);
                    }
                }
            }
        }
    };
}

test "JobQueue" {
    const test_ns = struct {
        var total: i32 = 0;

        pub fn hello(num: i32) void {
            total += num;
        }

        pub fn world() void {}
    };
    var gpa = std.heap.GeneralPurposeAllocator(.{}){};
    var queue: JobQueue(test_ns) = .{};
    try queue.init(.{ .allocator = gpa.allocator(), .n_jobs = 1 });
    try queue.push(test_ns.hello, .{123}, null);
    try queue.push(test_ns.hello, .{456}, null);
    try queue.push(test_ns.world, .{}, null);
    std.time.sleep(1e+8);
    try expect(test_ns.total == 123 + 456);
    queue.deinit();
}
