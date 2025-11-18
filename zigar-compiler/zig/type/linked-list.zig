const std = @import("std");
const expect = std.testing.expect;
const expectEqual = std.testing.expectEqual;

pub fn LinkedList(comptime T: type) type {
    return struct {
        const Node = struct {
            next: *@This(),
            ref_count: usize,
            payload: T,

            pub inline fn replace(self: *@This(), new: *@This(), dest: **@This()) bool {
                return @cmpxchgWeak(*@This(), dest, self, new, .seq_cst, .monotonic) == null;
            }
        };
        const tail: *Node = @ptrFromInt(std.mem.alignBackward(usize, std.math.maxInt(usize), @alignOf(Node)));

        head: *Node = tail,
        allocator: std.mem.Allocator,

        pub fn init(allocator: std.mem.Allocator) @This() {
            return .{ .allocator = allocator };
        }

        pub fn push(self: *@This(), value: T) !*T {
            const new_node = try self.alloc();
            new_node.* = .{ .next = tail, .ref_count = 1, .payload = value };
            self.insert(new_node);
            return &new_node.payload;
        }

        fn alloc(self: *@This()) !*Node {
            while (true) {
                const current_head = self.head;
                if (current_head != tail and isMarkedReference(current_head.next)) {
                    // make sure the detached Node is not being used
                    if (@cmpxchgWeak(usize, &current_head.ref_count, 0, 1, .monotonic, .monotonic) == null) {
                        const next_node = getUnmarkedReference(current_head.next);
                        if (current_head.replace(next_node, &self.head)) return current_head;
                    }
                } else break;
            }
            return try self.allocator.create(Node);
        }

        fn insert(self: *@This(), node: *Node) void {
            while (true) {
                if (self.head == tail) {
                    if (tail.replace(node, &self.head)) return;
                } else {
                    var current_node = self.head;
                    while (true) {
                        const next_node = getUnmarkedReference(current_node.next);
                        if (next_node == tail) {
                            const next = switch (isMarkedReference(current_node.next)) {
                                false => node,
                                true => getMarkedReference(node),
                            };
                            if (current_node.next.replace(next, &current_node.next)) return;
                            break;
                        }
                        current_node = next_node;
                    }
                }
            }
        }

        pub fn find(self: *@This(), match: anytype, args: anytype) ?*T {
            var current_node = self.head;
            while (current_node != tail) {
                const next_node = getUnmarkedReference(current_node.next);
                if (!isMarkedReference(current_node.next)) {
                    // see if we have a match
                    const prev_ref_count = @atomicRmw(usize, &current_node.ref_count, .Add, 1, .monotonic);
                    if (prev_ref_count > 0) {
                        if (@call(.always_inline, match, .{ &current_node.payload, args })) {
                            // make sure the item hasn't been removed while we're checking it
                            return &current_node.payload;
                        }
                    }
                    _ = @atomicRmw(usize, &current_node.ref_count, .Sub, 1, .monotonic);
                }
                current_node = next_node;
            }
            return null;
        }

        pub fn addRef(_: *@This(), payload_ptr: *T) void {
            const node: *Node = @fieldParentPtr("payload", payload_ptr);
            _ = @atomicRmw(usize, &node.ref_count, .Add, 1, .monotonic);
        }

        pub fn release(_: *@This(), payload_ptr: *T) void {
            const node: *Node = @fieldParentPtr("payload", payload_ptr);
            _ = @atomicRmw(usize, &node.ref_count, .Sub, 1, .monotonic);
        }

        pub fn shift(self: *@This()) ?T {
            var current_node = self.head;
            while (current_node != tail) {
                const next_node = getUnmarkedReference(current_node.next);
                if (!isMarkedReference(current_node.next)) {
                    if (next_node.replace(getMarkedReference(next_node), &current_node.next)) {
                        // release node after copying is completed
                        defer _ = @atomicRmw(usize, &current_node.ref_count, .Sub, 1, .monotonic);
                        return current_node.payload;
                    }
                }
                current_node = next_node;
            }
            return null;
        }

        pub fn deinit(self: *@This()) void {
            var current_node = self.head;
            return while (current_node != tail) {
                const next_node = getUnmarkedReference(current_node.next);
                self.allocator.destroy(current_node);
                current_node = next_node;
            };
        }

        inline fn isMarkedReference(ptr: *Node) bool {
            return @intFromPtr(ptr) & 1 != 0;
        }

        inline fn getUnmarkedReference(ptr: *Node) *Node {
            return @ptrFromInt(@intFromPtr(ptr) & ~@as(usize, 1));
        }

        inline fn getMarkedReference(ptr: *Node) *Node {
            @setRuntimeSafety(false);
            return @ptrFromInt(@intFromPtr(ptr) | @as(usize, 1));
        }
    };
}

test "ListedList.push()" {
    var gpa = std.heap.DebugAllocator(.{}).init;
    var list: LinkedList(i32) = .init(gpa.allocator());
    defer list.deinit();
    const ptr1 = try list.push(123);
    try expectEqual(123, ptr1.*);
    const ptr2 = try list.push(456);
    try expectEqual(456, ptr2.*);
}

test "ListedList.shift()" {
    var gpa = std.heap.DebugAllocator(.{}).init;
    var list: LinkedList(i32) = .init(gpa.allocator());
    defer list.deinit();
    _ = try list.push(123);
    _ = try list.push(456);
    const value1 = list.shift();
    try expectEqual(123, value1);
    const value2 = list.shift();
    try expectEqual(456, value2);
    const value3 = list.shift();
    try expectEqual(null, value3);
    _ = try list.push(888);
    const value4 = list.shift();
    try expectEqual(888, value4);
}

test "ListedList.find()" {
    var gpa = std.heap.DebugAllocator(.{}).init;
    var list: LinkedList(i32) = .init(gpa.allocator());
    defer list.deinit();
    _ = try list.push(123);
    _ = try list.push(456);
    const ns = struct {
        fn match(self: *i32, other: i32) bool {
            return self.* == other;
        }
    };
    const ptr = list.find(ns.match, 456);
    try expect(ptr != null);
    try expectEqual(456, ptr.?.*);
}
