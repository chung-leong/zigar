const std = @import("std");
const expectEqual = std.testing.expectEqual;

pub const RelativePosition = enum { a_is_b, a_before_b, b_before_a, a_inside_b, b_inside_a };

pub fn MemoryMap(comptime T: type, comptime allocator: std.mem.Allocator, comptime compare: fn (T, T) RelativePosition) type {
    return struct {
        list: std.ArrayList(T) = .empty,

        pub const SearchResult = struct {
            match: Match = .no,
            index: usize = 0,
            ptr: ?*T = null,

            pub const Match = enum { yes, no, inside, outside };

            pub inline fn value(self: @This()) T {
                return self.ptr.?.*;
            }
        };

        pub fn deinit(self: *@This()) void {
            self.list.deinit(allocator);
        }

        pub fn add(self: *@This(), value: T) !void {
            const result = self.search(value);
            return try self.list.insert(allocator, result.index, value);
        }

        pub fn remove(self: *@This(), value: T) !void {
            const result = self.search(value);
            return switch (result.match) {
                .yes => _ = self.list.orderedRemove(result.index),
                else => error.NoFound,
            };
        }

        pub fn insert(self: *@This(), result: SearchResult, value: T) !void {
            return try self.list.insert(allocator, result.index, value);
        }

        pub fn eject(self: *@This(), result: SearchResult) ?T {
            return switch (result.match) {
                .yes => self.list.orderedRemove(result.index),
                else => null,
            };
        }

        pub fn search(self: *@This(), b: T) SearchResult {
            var low: usize = 0;
            var high = self.list.items.len;
            if (high == 0) return .{};
            var match: SearchResult.Match = .no;
            var match_ptr: ?*T = null;
            while (low != high) {
                const mid = (low + high) / 2;
                const a_ptr = &self.list.items[mid];
                const a = a_ptr.*;
                const pos = compare(a, b);
                switch (pos) {
                    .a_before_b => low = mid + 1,
                    .b_before_a => high = mid,
                    .a_is_b => {
                        match = .yes;
                        match_ptr = a_ptr;
                        high = mid;
                        break;
                    },
                    .a_inside_b => {
                        match = .inside;
                        match_ptr = a_ptr;
                        high = mid;
                    },
                    .b_inside_a => {
                        match = .outside;
                        match_ptr = a_ptr;
                        low = mid + 1;
                    },
                }
            }
            return .{
                .match = match,
                .index = high,
                .ptr = match_ptr,
            };
        }
    };
}

var gpa: std.heap.DebugAllocator(.{}) = .{};

test "MemoryMap" {
    const Item = struct {
        bytes: []const u8,

        pub fn compare(a: *const @This(), b: *const @This()) RelativePosition {
            const a_start = @intFromPtr(a.bytes.ptr);
            const a_end = a_start + a.bytes.len;
            const b_start = @intFromPtr(b.bytes.ptr);
            const b_end = b_start + b.bytes.len;
            if (a_start < b_start) {
                return if (a_end >= b_end)
                    .b_inside_a
                else
                    .a_before_b;
            } else if (a_start > b_start) {
                return if (a_end <= b_end)
                    .a_inside_b
                else
                    .b_before_a;
            } else {
                return if (a_end == b_end)
                    .a_is_b
                else if (a_end <= b_end)
                    .a_inside_b
                else
                    .b_inside_a;
            }
        }
    };
    const Map = MemoryMap(*const Item, gpa.allocator(), Item.compare);
    var map: Map = .{};
    defer map.deinit();
    const bytes0: []const u8 = "Stuff";
    const bytes1: []const u8 = "Hello world";
    const bytes2: []const u8 = "This is a test and this is only a test";
    const item0: Item = .{ .bytes = bytes0 };
    const item1: Item = .{ .bytes = bytes1 };
    const item2: Item = .{ .bytes = bytes1[1..4] };
    const item3: Item = .{ .bytes = bytes2[0..8] };
    const item4: Item = .{ .bytes = bytes2[4..8] };
    const item5: Item = .{ .bytes = bytes2 };
    const item6: Item = .{ .bytes = bytes2[3..7] };

    const result1 = map.search(&item1);
    try expectEqual(.no, result1.match);
    try expectEqual(0, result1.index);
    try map.insert(result1, &item1);

    const result2 = map.search(&item1);
    try expectEqual(.yes, result2.match);
    try expectEqual(0, result2.index);

    const result3 = map.search(&item2);
    try expectEqual(.outside, result3.match);
    try expectEqual(1, result3.index);

    const result4 = map.search(&item5);
    try expectEqual(.no, result4.match);
    try expectEqual(1, result4.index);

    const result5 = map.search(&item0);
    try expectEqual(.no, result5.match);
    try expectEqual(0, result5.index);

    try map.add(&item3);
    const result6 = map.search(&item5);
    try expectEqual(.inside, result6.match);
    try expectEqual(1, result6.index);

    try map.add(&item4);
    const result7 = map.search(&item4);
    try expectEqual(.yes, result7.match);
    try expectEqual(2, result7.index);

    try map.add(&item5);
    const result8 = map.search(&item5);
    try expectEqual(.yes, result8.match);
    try expectEqual(1, result8.index);

    const result9 = map.search(&item6);
    try expectEqual(.outside, result9.match);
    try expectEqual(3, result9.index);

    try map.add(&item6);
    const result10 = map.search(&item6);
    try expectEqual(.yes, result10.match);
    try expectEqual(3, result10.index);
}
