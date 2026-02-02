const std = @import("std");

const NodeType = enum { red, blue };
pub const Node = struct {
    type: NodeType,
    id: i64,
    parent: ?*const @This() = null,
    children: ?[]*const @This() = null,
};

pub fn getRoot(allocator: std.mem.Allocator) !*const Node {
    const root: *Node = try allocator.create(Node);
    root.* = .{ .type = .red, .id = 0 };
    const child1: *Node = try allocator.create(Node);
    child1.* = .{ .type = .blue, .id = 1, .parent = root };
    const child2: *Node = try allocator.create(Node);
    child2.* = .{ .type = .blue, .id = 2, .parent = root };
    const children = try allocator.alloc(*const Node, 2);
    children[0] = child1;
    children[1] = child2;
    root.children = children;
    return root;
}
