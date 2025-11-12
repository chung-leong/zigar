const std = @import("std");
const expectEqual = std.testing.expectEqual;

pub fn LinkedList(comptime T: type, comptime retain: usize) type {
    return struct {
        const Node = struct {
            next: *Node,
            payload: T,
        };
        const tail: *Node = @ptrFromInt(std.mem.alignBackward(usize, std.math.maxInt(usize), @alignOf(Node)));
        const cache_count = retain;

        head: *Node = tail,
        allocator: std.mem.Allocator,

        pub fn init(allocator: std.mem.Allocator) @This() {
            return .{ .allocator = allocator };
        }

        pub fn push(self: *@This(), value: T) !void {
            const new_node = try self.alloc();
            new_node.* = .{ .next = tail, .payload = value };
            self.insert(new_node);
        }

        fn alloc(self: *@This()) !*Node {
            while (true) {
                const current_head = self.head;
                if (current_head != tail and isMarkedReference(current_head.next)) {
                    const next_node = getUnmarkedReference(current_head.next);
                    if (cas(&self.head, current_head, next_node)) return current_head;
                } else break;
            }
            return try self.allocator.create(Node);
        }

        fn insert(self: *@This(), node: *Node) void {
            while (true) {
                if (self.head == tail) {
                    if (cas(&self.head, tail, node)) return;
                } else {
                    var current_node = self.head;
                    while (true) {
                        const next_node = getUnmarkedReference(current_node.next);
                        if (next_node == tail) {
                            const next = switch (isMarkedReference(current_node.next)) {
                                false => node,
                                true => getMarkedReference(node),
                            };
                            if (cas(&current_node.next, current_node.next, next)) return;
                            break;
                        }
                        current_node = next_node;
                    }
                }
            }
        }

        pub fn shift(self: *@This()) ?T {
            var current_node = self.head;
            while (current_node != tail) {
                const next_node = getUnmarkedReference(current_node.next);
                if (!isMarkedReference(current_node.next)) {
                    if (cas(&current_node.next, next_node, getMarkedReference(next_node))) {
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

        inline fn cas(ptr: **Node, old: *Node, new: *Node) bool {
            return @cmpxchgWeak(*Node, ptr, old, new, .seq_cst, .monotonic) == null;
        }
    };
}

test "ListedList (cache = 1)" {
    var gpa = std.heap.DebugAllocator(.{}).init;
    var list: LinkedList(i32, 1) = .init(gpa.allocator());
    defer list.deinit();
    try list.push(123);
    try list.push(456);
    const value1 = list.shift();
    try expectEqual(123, value1);
    const value2 = list.shift();
    try expectEqual(456, value2);
    const value3 = list.shift();
    try expectEqual(null, value3);
    try list.push(888);
    const value4 = list.shift();
    try expectEqual(888, value4);
}

test "ListedList (cache = 0)" {
    var gpa = std.heap.DebugAllocator(.{}).init;
    var list: LinkedList(i32, 0) = .init(gpa.allocator());
    defer list.deinit();
    try list.push(123);
    try list.push(456);
    const value1 = list.shift();
    try expectEqual(123, value1);
    const value2 = list.shift();
    try expectEqual(456, value2);
    const value3 = list.shift();
    try expectEqual(null, value3);
    try list.push(888);
    const value4 = list.shift();
    try expectEqual(888, value4);
}
