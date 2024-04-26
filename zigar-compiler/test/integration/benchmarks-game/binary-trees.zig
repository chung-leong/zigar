// Adopted from https://github.com/tiehuis/zig-benchmarks-game/blob/master/src/binary-trees.zig

const std = @import("std");
const Allocator = std.mem.Allocator;

const TreeNode = struct {
    l: ?*TreeNode,
    r: ?*TreeNode,

    pub fn new(a: Allocator, l: ?*TreeNode, r: ?*TreeNode) !*TreeNode {
        var node = try a.create(TreeNode);
        node.l = l;
        node.r = r;
        return node;
    }

    pub fn free(self: *TreeNode, a: *Allocator) void {
        a.destroy(self);
    }
};

fn itemCheck(node: *TreeNode) usize {
    if (node.l) |left| {
        // either have both nodes or none
        return 1 + itemCheck(left) + itemCheck(node.r.?);
    } else {
        return 1;
    }
}

fn bottomUpTree(a: Allocator, depth: usize) Allocator.Error!*TreeNode {
    if (depth > 0) {
        const left = try bottomUpTree(a, depth - 1);
        const right = try bottomUpTree(a, depth - 1);

        return try TreeNode.new(a, left, right);
    } else {
        return try TreeNode.new(a, null, null);
    }
}

fn deleteTree(a: Allocator, node: *TreeNode) void {
    if (node.l) |left| {
        // either have both nodes or none
        deleteTree(a, left);
        deleteTree(a, node.r.?);
    }

    a.destroy(node);
}

var gpa = std.heap.GeneralPurposeAllocator(.{}){};

pub fn binaryTree(n: usize) !void {
    var buffered_stdout = std.io.bufferedWriter(std.io.getStdOut().writer());
    defer buffered_stdout.flush() catch unreachable;
    const stdout = buffered_stdout.writer();
    const allocator = gpa.allocator();

    const min_depth: usize = 4;
    const max_depth: usize = n;
    const stretch_depth = max_depth + 1;

    const stretch_tree = try bottomUpTree(allocator, stretch_depth);
    _ = try stdout.print("stretch tree of depth {}\t check: {}\n", .{ stretch_depth, itemCheck(stretch_tree) });
    deleteTree(allocator, stretch_tree);

    const long_lived_tree = try bottomUpTree(allocator, max_depth);
    var depth = min_depth;
    while (depth <= max_depth) : (depth += 2) {
        const iterations: usize = @intFromFloat(std.math.pow(f32, 2, @as(f32, @floatFromInt(max_depth - depth + min_depth))));
        var check: usize = 0;

        var i: usize = 1;
        while (i <= iterations) : (i += 1) {
            const temp_tree = try bottomUpTree(allocator, depth);
            check += itemCheck(temp_tree);
            deleteTree(allocator, temp_tree);
        }

        _ = try stdout.print("{}\t trees of depth {}\t check: {}\n", .{ iterations, depth, check });
    }

    _ = try stdout.print("long lived tree of depth {}\t check: {}\n", .{ max_depth, itemCheck(long_lived_tree) });
    deleteTree(allocator, long_lived_tree);
}
