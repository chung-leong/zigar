const std = @import("std");
const expectEqual = std.testing.expectEqual;

pub fn @"fn"(comptime T: type, comptime allocator: std.mem.Allocator) type {
    return struct {
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

        pub fn getMatching(self: *@This(), b: anytype, result: SearchResult, comptime match: anytype) ?T {
            if (result.index > 0) {
                const a = self.list.items[result.index - 1];
                if (match(a, b)) return a;
            }
            if (result.index < self.list.items.len) {
                const a = self.list.items[result.index];
                if (match(a, b)) return a;
            }
            return null;
        }

        pub fn find(self: *@This(), b: anytype, comptime compare: anytype) SearchResult {
            var low: usize = 0;
            var high = self.list.items.len;
            while (low != high) {
                const mid = (low + high) / 2;
                const a_ptr = &self.list.items[mid];
                const a = a_ptr.*;
                switch (compare(a, b)) {
                    .lt => low = mid + 1,
                    .gt => high = mid,
                    .eq => return .{ .found = true, .index = mid },
                }
            }
            return .{ .found = false, .index = high };
        }

        pub fn findFirst(self: *@This(), b: anytype, comptime compare: anytype) SearchResult {
            var result = self.find(b, compare);
            if (result.found) {
                while (result.index > 0) {
                    const prev = self.list.items[result.index - 1];
                    if (compare(prev, b) != .eq) break;
                    result.index -= 1;
                }
            }
            return result;
        }

        pub fn findAgain(self: *@This(), b: anytype, result: SearchResult, comptime compare: anytype) SearchResult {
            if (result.index < self.list.items.len) {
                const next = self.list.items[result.index];
                if (compare(next, b) == .eq) {
                    return .{ .found = true, .index = result.index };
                }
            }
            return .{ .found = false, .index = result.index };
        }

        pub const RelativePosition = enum { ab, ba };
        pub const SearchResult = struct { found: bool, index: usize };

        list: std.ArrayList(T) = .empty,

        test "MemoryMap" {
            var map: @This() = .{};
            defer map.deinit();
            const bytes0: []const u8 = "Stuff";
            const bytes1: []const u8 = "Hello world";
            const bytes2: []const u8 = "This is a test and this is only a test";
            const item0: T = .{ .bytes = bytes0 };
            const item1: T = .{ .bytes = bytes1 };
            const item2: T = .{ .bytes = bytes1[1..4] };
            const item3: T = .{ .bytes = bytes2[0..8] };
            const item4: T = .{ .bytes = bytes2[4..8] };
            const item5: T = .{ .bytes = bytes2 };
            const item6: T = .{ .bytes = bytes2[3..7] };

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
    };
}

test {
    const Item = struct {
        bytes: []const u8,

        pub fn compareAddress(a: *const @This(), b: anytype) ?std.math.Order {
            if (@intFromPtr(a.bytes.ptr) < @intFromPtr(b.bytes.ptr)) return .lt;
            if (@intFromPtr(a.bytes.ptr) > @intFromPtr(b.bytes.ptr)) return .gt;
            return null;
        }

        pub fn compareLength(a: *const @This(), b: anytype) ?std.math.Order {
            if (a.bytes.len < b.bytes.len) return .lt;
            if (a.bytes.len > b.bytes.len) return .gt;
            return null;
        }

        pub fn compare(a: *const @This(), b: anytype) std.math.Order {
            return compareAddress(a, b) orelse compareLength(a, b) orelse .eq;
        }
    };
    var gpa: std.heap.DebugAllocator(.{}) = .{};
    _ = @"fn"(*const Item, gpa.allocator(), Item.compare);
}
