const std = @import("std");
const expect = std.testing.expect;
const expectEqual = std.testing.expectEqual;

fn MarkedPointer(comptime T: type) type {
    return struct {
        ptr_state: std.atomic.Value(PtrState) = .init(.{}),

        const State = enum(u2) {
            previous_in_use,
            previous_free,
            previous_allocated,
        };
        const state_mask: usize = std.math.maxInt(u2);
        const PtrState = packed struct(usize) {
            value: usize = 0,

            pub inline fn init(p: *T, s: State) @This() {
                return .{ .value = @intFromPtr(p) | @intFromEnum(s) };
            }

            pub inline fn ptr(self: @This()) *T {
                return @ptrFromInt(self.value & ~state_mask);
            }

            pub inline fn state(self: @This()) State {
                return @enumFromInt(self.value & state_mask);
            }

            pub inline fn change(self: @This(), s: State) @This() {
                return .{ .value = (self.value & ~state_mask) | @intFromEnum(s) };
            }

            pub inline fn isNull(self: @This()) bool {
                return self.value & ~state_mask == 0;
            }
        };

        pub fn load(self: *@This()) PtrState {
            return self.ptr_state.load(.unordered);
        }

        pub fn store(self: *@This(), ps: PtrState, comptime order: std.builtin.AtomicOrder) void {
            self.ptr_state.store(ps, order);
        }

        pub fn exchange(self: *@This(), expected: PtrState, new: PtrState, comptime order: std.builtin.AtomicOrder) bool {
            return self.ptr_state.cmpxchgWeak(expected, new, order, .monotonic) == null;
        }
    };
}

pub fn LinkedList(comptime T: type) type {
    return struct {
        const Node = struct {
            next: MarkedPointer(Node) = .{},
            payload: T,
        };

        head: MarkedPointer(Node) = .{},
        allocator: std.mem.Allocator,

        pub fn init(allocator: std.mem.Allocator) @This() {
            return .{ .allocator = allocator };
        }

        pub fn push(self: *@This(), payload: T) !void {
            _ = try self.pushReturnPtr(payload);
        }

        pub fn pushReturnPtr(self: *@This(), payload: T) !*const T {
            while (true) {
                var candidate_node: ?*Node = null;
                var tail_ptr = &self.head;
                var current = self.head.load();
                while (!current.isNull()) {
                    const next = current.ptr().next.load();
                    if (next.state() == .previous_free) {
                        // this node is free
                        if (candidate_node == null) {
                            candidate_node = current.ptr();
                        }
                    } else {
                        // since the new node need to be behind what's on the list already,
                        // we can't use an unused node that got picked earlier
                        candidate_node = null;
                        if (next.isNull()) {
                            tail_ptr = &current.ptr().next;
                        }
                    }
                    current = next;
                }
                if (candidate_node) |node| {
                    // set the next pointer's state to .previous_allocated first, then copy the payload
                    const next = node.next.load();
                    if (node.next.exchange(next, next.change(.previous_allocated), .monotonic)) {
                        node.payload = payload;
                        // mark the node as in-play
                        node.next.store(next.change(.previous_in_use), .release);
                        return &node.payload;
                    } else {
                        // try again
                    }
                } else {
                    // create a new node
                    const new_node = try self.allocator.create(Node);
                    new_node.* = .{ .payload = payload };
                    while (true) {
                        const next = tail_ptr.load();
                        if (next.isNull()) {
                            if (tail_ptr.exchange(next, .init(new_node, next.state()), .release)) {
                                return &new_node.payload;
                            } else {
                                // try again
                            }
                        } else {
                            // another thread has pushed another node just before we did
                            // try attaching our new node to that one instead
                            tail_ptr = &next.ptr().next;
                        }
                    }
                }
            }
        }

        pub fn shift(self: *@This()) ?T {
            while (true) {
                var current = self.head.load();
                while (!current.isNull()) {
                    const next = current.ptr().next.load();
                    if (next.state() == .previous_in_use) {
                        // this node is in use; we make a copy of its payload first
                        const payload = current.ptr().payload;
                        // then we try to it off the list by changing its next pointer's state
                        if (current.ptr().next.exchange(next, next.change(.previous_free), .monotonic)) {
                            return payload;
                        } else {
                            // start over, since the exchange failure could be spurious
                            break;
                        }
                    }
                    current = next;
                }
                break;
            }
            return null;
        }

        pub fn find(self: *@This(), comptime match_fn: anytype, arg: anytype) ?T {
            const payload, _ = self.findReturnPtr(match_fn, arg) orelse return null;
            return payload;
        }

        pub fn findReturnPtr(self: *@This(), comptime match_fn: anytype, arg: anytype) ?std.meta.Tuple(&.{ T, *const T }) {
            var current = self.head.load();
            while (!current.isNull()) {
                const next = current.ptr().next.load();
                if (next.state() == .previous_in_use) {
                    const payload = current.ptr().payload;
                    // check state again if copying cannot be done atomically
                    if (@sizeOf(T) <= @sizeOf(usize) or current.ptr().next.load().state() == .previous_in_use) {
                        if (check(match_fn, payload, arg)) {
                            return .{ payload, &current.ptr().payload };
                        }
                    }
                }
                current = next;
            }
            return null;
        }

        pub fn remove(self: *@This(), comptime match_fn: anytype, arg: anytype) ?T {
            while (true) {
                const payload, const ptr = self.findReturnPtr(match_fn, arg) orelse break;
                const node: *Node = @alignCast(@constCast(@fieldParentPtr("payload", ptr)));
                const next = node.next.load();
                if (next.state() != .previous_in_use) break;
                if (node.next.exchange(next, next.change(.previous_free), .monotonic)) {
                    return payload;
                } else {
                    // try again
                }
            }
            return null;
        }

        fn check(comptime match_fn: anytype, payload: T, arg: anytype) bool {
            return switch (@typeInfo(@TypeOf(match_fn))) {
                .@"fn" => match_fn(payload, arg),
                .enum_literal => switch (match_fn) {
                    .eql => payload == arg,
                    else => @compileLog("Unknown operation"),
                },
                else => @compileLog("Function expected"),
            };
        }

        pub fn deinit(self: *@This()) void {
            var current = self.head.load();
            while (!current.isNull()) {
                const next = current.ptr().next.load();
                self.allocator.destroy(current.ptr());
                current = next;
            }
        }
    };
}

test "ListedList.push()" {
    var gpa = std.heap.DebugAllocator(.{}).init;
    var list: LinkedList(i32) = .init(gpa.allocator());
    defer list.deinit();
    try list.push(123);
    try list.push(456);
}

test "ListedList.shift()" {
    var gpa = std.heap.DebugAllocator(.{}).init;
    var list: LinkedList(i32) = .init(gpa.allocator());
    defer list.deinit();
    try list.push(123);
    try list.push(456);
    try expectEqual(123, list.shift());
    try expectEqual(456, list.shift());
    try expectEqual(null, list.shift());
    try list.push(888);
    try expectEqual(888, list.shift());
    try list.push(111);
    try list.push(222);
    try list.push(333);
    try expectEqual(111, list.shift());
    try expectEqual(222, list.shift());
    try list.push(444);
    try list.push(555);
    try expectEqual(333, list.shift());
    try expectEqual(444, list.shift());
    try expectEqual(555, list.shift());
    try expectEqual(null, list.shift());
}

test "ListedList.find()" {
    var gpa = std.heap.DebugAllocator(.{}).init;
    var list: LinkedList(i32) = .init(gpa.allocator());
    defer list.deinit();
    try list.push(123);
    try list.push(456);
    try expectEqual(123, list.find(.eql, 123));
    try expectEqual(123, list.find(.eql, 123));
    try expectEqual(123, list.shift());
    try expectEqual(null, list.find(.eql, 123));
    try expectEqual(456, list.shift());
    try expectEqual(null, list.find(.eql, 456));
}

test "ListedList.remove()" {
    var gpa = std.heap.DebugAllocator(.{}).init;
    var list: LinkedList(i32) = .init(gpa.allocator());
    defer list.deinit();
    try list.push(123);
    try list.push(456);
    try expectEqual(123, list.remove(.eql, 123));
    try expectEqual(null, list.remove(.eql, 123));
    try expectEqual(456, list.shift());
    try expectEqual(null, list.remove(.eql, 456));
}

test "Multithreaded: push() + shift()" {
    const operations = 1000;
    const pushers = 4;
    const pullers = 8;
    const test_ns = struct {
        var ready_futex: std.atomic.Value(u32) = .init(0);
        var finish_futex: std.atomic.Value(u32) = .init(0);
        var thread_count: std.atomic.Value(usize) = .init(0);
        var finish_count: std.atomic.Value(usize) = .init(0);
        var pusher_count: std.atomic.Value(usize) = .init(0);

        var gpa = std.heap.DebugAllocator(.{}).init;
        var sum: std.atomic.Value(isize) = .init(0);
        var list: LinkedList(isize) = .init(gpa.allocator());

        fn run() !void {
            for (0..pushers) |i| {
                const thread = try std.Thread.spawn(.{}, runPush, .{i});
                thread.detach();
            }
            for (0..pullers) |i| {
                const thread = try std.Thread.spawn(.{}, runPull, .{i});
                thread.detach();
            }
            std.Thread.Futex.wait(&finish_futex, 0);
        }

        fn runPush(_: usize) !void {
            waitForOthers();
            defer done();
            _ = pusher_count.fetchAdd(1, .monotonic);
            defer _ = pusher_count.fetchSub(1, .monotonic);
            for (0..operations) |i| {
                const num: isize = @intCast(i);
                try list.push(num);
                _ = sum.fetchAdd(num, .monotonic);
            }
        }

        fn runPull(_: usize) !void {
            waitForOthers();
            defer done();
            while (true) {
                if (list.shift()) |num| {
                    _ = sum.fetchSub(num, .monotonic);
                } else {
                    if (pusher_count.load(.unordered) == 0) break;
                }
            }
        }

        fn waitForOthers() void {
            const prev_count = thread_count.fetchAdd(1, .monotonic);
            if (prev_count == pushers + pullers - 1) {
                ready_futex.store(1, .unordered);
                std.Thread.Futex.wake(&ready_futex, std.math.maxInt(u32));
            }
            std.Thread.Futex.wait(&ready_futex, 0);
        }

        fn done() void {
            const prev_count = finish_count.fetchAdd(1, .monotonic);
            if (prev_count == pushers + pullers - 1) {
                finish_futex.store(1, .unordered);
                std.Thread.Futex.wake(&finish_futex, std.math.maxInt(u32));
            }
        }
    };
    try test_ns.run();
    const sum = test_ns.sum.load(.unordered);
    try expectEqual(0, sum);
}
