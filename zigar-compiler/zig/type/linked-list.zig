const std = @import("std");
const expect = std.testing.expect;
const expectEqual = std.testing.expectEqual;

pub fn LinkedList(comptime T: type) type {
    return struct {
        const Node = struct {
            next: std.atomic.Value(*@This()),
            ref_count: std.atomic.Value(usize),
            payload: T,
        };
        const tail: *Node = @ptrFromInt(std.mem.alignBackward(usize, std.math.maxInt(usize), @alignOf(Node)));

        head: std.atomic.Value(*Node) = .init(tail),
        allocator: std.mem.Allocator,

        pub fn init(allocator: std.mem.Allocator) @This() {
            return .{ .allocator = allocator };
        }

        pub fn push(self: *@This(), value: T) !*T {
            const new_node = try self.alloc();
            new_node.payload = value;
            new_node.next = .init(tail);
            // use .release to ensure the payload shows up fully in other CPU cores
            new_node.ref_count.store(1, .release);
            self.insert(new_node);
            return &new_node.payload;
        }

        fn alloc(self: *@This()) !*Node {
            var current = self.head.load(.unordered);
            var current_ptr = &self.head;
            var prev_deleted = false;
            while (current != tail) {
                const next_m = current.next.load(.unordered);
                const next = getUnmarkedReference(next_m);
                if (isMarkedReference(next_m)) {
                    // the next pointer is marked, meaning this node is off the list; since its payload
                    // might still be in use, we need to make use sure ref_count is zero
                    if (current.ref_count.cmpxchgWeak(0, 1, .monotonic, .monotonic) == null) {
                        // now we detach the node from the list altogether by change the previous node's
                        // next pointer to point to this node's next node
                        var current_m = current;
                        var new_next_m = next;
                        if (prev_deleted) {
                            // the previous node isn't on the list (but wasn't picked due to ref count);
                            // mark both pointers
                            current_m = getMarkedReference(current_m);
                            new_next_m = getMarkedReference(new_next_m);
                        }
                        current_ptr.*.store(current_m, .unordered);
                        if (current_ptr.*.cmpxchgWeak(current_m, new_next_m, .monotonic, .monotonic) == null) {
                            return current;
                        } else {
                            // couldn't make the update (probably because the previous node was removed);
                            // set the ref count back to zero
                            current.ref_count.store(0, .unordered);
                        }
                    }
                }
                current_ptr = &current.next;
                current = next;
                prev_deleted = isMarkedReference(next_m);
            }
            // otherwise allocate memory for a new node
            const new_node = try self.allocator.create(Node);
            return new_node;
        }

        fn insert(self: *@This(), node: *Node) void {
            while (true) {
                const head = self.head.load(.unordered);
                if (head == tail) {
                    if (self.head.cmpxchgWeak(tail, node, .monotonic, .monotonic) == null) {
                        break;
                    }
                } else {
                    while (true) {
                        var current = head;
                        while (true) {
                            const next_m = current.next.load(.unordered);
                            const next = getUnmarkedReference(next_m);
                            if (next == tail) {
                                // this node is the last node
                                var new_next_m = node;
                                if (isMarkedReference(next_m)) {
                                    // the node is off the list--its new next pointer also needs to be marked
                                    new_next_m = getMarkedReference(node);
                                }
                                if (current.next.cmpxchgWeak(next_m, new_next_m, .monotonic, .monotonic) == null) {
                                    return;
                                } else {
                                    // start from beginning again
                                    break;
                                }
                            }
                            current = next;
                        }
                    }
                }
            }
        }

        pub fn find(self: *@This(), match: anytype, args: anytype) ?*T {
            var current = self.head.load(.unordered);
            while (current != tail) {
                const next_m = current.next.load(.unordered);
                const next = getUnmarkedReference(next_m);
                if (!isMarkedReference(next_m)) {
                    // see if we have a match; using .acquire to make sure the payload is valid on this CPU core
                    const prev_ref_count = current.ref_count.fetchAdd(1, .acquire);
                    //
                    if (prev_ref_count != 0) {
                        if (match(&current.payload, args)) {
                            // make sure the item hasn't been removed while we're checking it
                            return &current.payload;
                        }
                    }
                    _ = current.ref_count.fetchSub(1, .monotonic);
                }
                current = next;
            }
            return null;
        }

        pub fn addRef(_: *@This(), payload_ptr: *T) void {
            const node: *Node = @fieldParentPtr("payload", payload_ptr);
            node.ref_count.fetchAdd(1, .monotonic);
        }

        pub fn release(_: *@This(), payload_ptr: *T) void {
            const node: *Node = @fieldParentPtr("payload", payload_ptr);
            node.ref_count.fetchSub(1, .monotonic);
        }

        pub fn shift(self: *@This()) ?T {
            var current = self.head.load(.unordered);
            while (current != tail) {
                const next_m = current.next.load(.unordered);
                if (!isMarkedReference(next_m)) {
                    // the next pointer isn't marked, meaning this node is on the list; mark the
                    // pointer to take it off the list
                    const new_next_m = getMarkedReference(next_m);
                    if (current.next.cmpxchgWeak(next_m, new_next_m, .monotonic, .monotonic) == null) {
                        // make sure payload is fully available
                        _ = current.ref_count.load(.acquire);
                        // make node available for reuse after copying is finished
                        defer _ = current.ref_count.fetchSub(1, .monotonic);
                        return current.payload;
                    } else {
                        // start from begining again
                        break;
                    }
                }
                current = getUnmarkedReference(next_m);
            }
            return null;
        }

        pub fn deinit(self: *@This()) void {
            var current = self.head.load(.unordered);
            return while (current != tail) {
                const next_m = current.next.load(.unordered);
                self.allocator.destroy(current);
                current = getUnmarkedReference(next_m);
            };
        }

        inline fn isMarkedReference(ptr: *Node) bool {
            return @intFromPtr(ptr) & 1 != 0;
        }

        inline fn getUnmarkedReference(ptr: *Node) *Node {
            @setRuntimeSafety(false);
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
