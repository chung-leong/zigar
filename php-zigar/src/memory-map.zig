const std = @import("std");
const expectEqual = std.testing.expectEqual;

pub const RelativePosition = enum { ab, ba };
pub const SearchResult = struct { found: bool, index: usize };

pub fn MemoryMap(comptime T: type, comptime allocator: std.mem.Allocator, comptime compare: fn (T, anytype) ?RelativePosition) type {
    return struct {
        list: std.ArrayList(T) = .empty,

        pub fn deinit(self: *@This()) void {
            self.list.deinit(allocator);
        }

        pub fn insert(self: *@This(), result: SearchResult, value: T) !void {
            return try self.list.insert(allocator, result.index, value);
        }

        pub fn remove(self: *@This(), result: SearchResult) void {
            if (result.found) {
                _ = self.list.orderedRemove(result.index);
            }
        }

        pub fn get(self: *@This(), result: SearchResult) ?T {
            if (!result.found) return null;
            return self.list.items[result.index];
        }

        pub fn getPointer(self: *@This(), result: SearchResult) ?*T {
            if (!result.found) return null;
            return &self.list.items[result.index];
        }

        pub fn getNearest(self: *@This(), result: SearchResult) ?T {
            if (!result.found) return null;
            if (result.index + 1 >= self.list.items.len) return null;
            return self.list.items[result.index + 1];
        }

        pub fn find(self: *@This(), b: anytype) SearchResult {
            var low: usize = 0;
            var high = self.list.items.len;
            while (low != high) {
                const mid = (low + high) / 2;
                const a_ptr = &self.list.items[mid];
                const a = a_ptr.*;
                if (compare(a, b)) |diff| switch (diff) {
                    .ab => low = mid + 1,
                    .ba => high = mid,
                } else {
                    return .{ .found = true, .index = mid };
                }
            }
            return .{ .found = false, .index = high };
        }

        pub fn findFirst(self: *@This(), b: anytype) SearchResult {
            var result = self.find(b);
            if (result.found) {
                while (result.index > 0) {
                    const prev = self.list.items[result.index - 1];
                    if (compare(prev, b) != null) break;
                    result.index -= 1;
                }
            }
            return result;
        }

        pub fn findAgain(self: *@This(), b: anytype, result: SearchResult) SearchResult {
            if (result.index < self.list.items.len) {
                const next = self.list.items[result.index];
                if (compare(next, b) == null) {
                    // null means no differences
                    return .{ .found = true, .index = result.index };
                }
            }
            return .{ .found = false, .index = result.index };
        }
    };
}

var gpa: std.heap.DebugAllocator(.{}) = .{};

test "MemoryMap" {
    const Item = struct {
        bytes: []const u8,

        pub fn compareAddress(a: *const @This(), b: anytype) ?RelativePosition {
            if (@intFromPtr(a.bytes.ptr) < @intFromPtr(b.bytes.ptr)) return .ab;
            if (@intFromPtr(a.bytes.ptr) > @intFromPtr(b.bytes.ptr)) return .ba;
            return null;
        }

        pub fn compareLength(a: *const @This(), b: anytype) ?RelativePosition {
            if (a.bytes.len < b.bytes.len) return .ab;
            if (a.bytes.len > b.bytes.len) return .ba;
            return null;
        }

        pub fn compare(a: *const @This(), b: anytype) ?RelativePosition {
            return compareAddress(a, b) orelse compareLength(a, b);
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

    const result1 = map.find(&item1);
    try expectEqual(false, result1.found);
    try expectEqual(0, result1.index);
    try map.insert(result1, &item1);

    const result2 = map.find(&item1);
    try expectEqual(true, result2.found);
    try expectEqual(0, result2.index);

    const result3 = map.find(&item2);
    try expectEqual(false, result3.found);
    try expectEqual(1, result3.index);

    const result4 = map.find(&item5);
    try expectEqual(false, result4.found);
    try expectEqual(1, result4.index);

    const result5 = map.find(&item0);
    try expectEqual(false, result5.found);
    try expectEqual(0, result5.index);

    try map.insert(map.find(&item3), &item3);
    const result6 = map.find(&item5);
    try expectEqual(false, result6.found);
    try expectEqual(2, result6.index);

    try map.insert(map.find(&item4), &item4);
    const result7 = map.find(&item4);
    try expectEqual(true, result7.found);
    try expectEqual(2, result7.index);

    try map.insert(map.find(&item5), &item5);
    const result8 = map.find(&item5);
    try expectEqual(true, result8.found);
    try expectEqual(2, result8.index);

    const result9 = map.find(&item6);
    try expectEqual(false, result9.found);
    try expectEqual(3, result9.index);

    try map.insert(map.find(&item6), &item6);
    const result10 = map.find(&item6);
    try expectEqual(true, result10.found);
    try expectEqual(3, result10.index);

    try map.insert(map.find(&item0), &item0);
    const result11 = map.find(&item0);
    try expectEqual(true, result11.found);
    try expectEqual(0, result11.index);
}
