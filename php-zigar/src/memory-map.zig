const std = @import("std");
const expectEqual = std.testing.expectEqual;

pub fn MemoryMap(comptime T: type, comptime allocator: std.mem.Allocator, comptime getBytes: fn (T) []const u8) type {
    return struct {
        list: std.ArrayList(T) = .empty,

        pub const SearchResult = struct {
            match_type: enum { no_match, exact, smaller, larger } = .no_match,
            index: usize = 0,
            ptr: ?*T = null,
        };

        pub fn init() !*@This() {
            const self = try allocator.create(@This());
            self.* = .{};
            return self;
        }

        pub fn deinit(self: *@This()) void {
            self.list.deinit(allocator);
            allocator.destroy(self);
        }

        pub fn add(self: *@This(), value: T) !void {
            const bytes = getBytes(value);
            const result = self.find(bytes);
            return try self.list.insert(allocator, result.index, value);
        }

        pub fn insert(self: *@This(), result: SearchResult, value: T) !void {
            return try self.list.insert(allocator, result.index, value);
        }

        pub fn remove(self: *@This(), value: T) void {
            const bytes = getBytes(value);
            const result = self.find(bytes);
            return switch (result.match_type) {
                .exact => _ = self.list.orderedRemove(result.index),
                else => {},
            };
        }

        pub fn find(self: *@This(), bytes: []const u8) SearchResult {
            const address = @intFromPtr(bytes.ptr);
            const len = bytes.len;
            var low: usize = 0;
            var high = self.list.items.len;
            if (high == 0) return .{};
            while (true) {
                const mid = (low + high) / 2;
                var ptr = &self.list.items[mid];
                const mid_bytes = getBytes(ptr.*);
                const mid_address = @intFromPtr(mid_bytes.ptr);
                if (mid_address == address) {
                    const mid_len = mid_bytes.len;
                    if (mid_len == len) {
                        return .{
                            .match_type = .exact,
                            .index = mid,
                            .ptr = &self.list.items[mid],
                        };
                    } else if (mid_len > len) {
                        // longer length comes after shorter length
                        high = mid;
                    } else {
                        low = mid + 1;
                    }
                } else if (mid_address > address) {
                    // larger address comes after smaller address
                    high = mid;
                } else {
                    low = mid + 1;
                }
                if (low == high) {
                    if (mid_address != address) {
                        if (high == 0) return .{};
                        ptr = &self.list.items[high - 1];
                    }
                    const lower_bytes = getBytes(ptr.*);
                    const lower_address = @intFromPtr(lower_bytes.ptr);
                    const lower_len = lower_bytes.len;
                    return if (lower_address == address and lower_len < len) .{
                        // existing entry is at the same address but smaller
                        .match_type = .smaller,
                        .index = high,
                        .ptr = ptr,
                    } else if (address + len <= lower_address + lower_len) .{
                        // existing entry contains the give address and len
                        .match_type = .larger,
                        .index = high,
                        .ptr = ptr,
                    } else .{
                        .index = high,
                    };
                }
            }
        }
    };
}

var gpa: std.heap.DebugAllocator(.{}) = .{};

test "MemoryMap" {
    const Item = struct {
        bytes: []const u8,

        pub fn getBytes(self: @This()) []const u8 {
            return self.bytes;
        }
    };
    const Map = MemoryMap(Item, gpa.allocator(), Item.getBytes);
    const map = try Map.init();
    defer map.deinit();
    const bytes0: []const u8 = "Stuff";
    const bytes1: []const u8 = "Hello world";
    const bytes2: []const u8 = "This is a test and this is only a test";
    const result1 = map.find(bytes1);
    try expectEqual(.no_match, result1.match_type);
    try expectEqual(0, result1.index);
    const item1: Item = .{ .bytes = bytes1 };
    try map.insert(result1, item1);

    const result2 = map.find(bytes1);
    try expectEqual(.exact, result2.match_type);
    try expectEqual(0, result2.index);

    const result3 = map.find(bytes1[0..4]);
    try expectEqual(.larger, result3.match_type);
    try expectEqual(0, result3.index);

    const result4 = map.find(bytes2);
    try expectEqual(.no_match, result4.match_type);
    try expectEqual(1, result4.index);

    const result5 = map.find(bytes0);
    try expectEqual(.no_match, result5.match_type);
    try expectEqual(0, result5.index);

    const item2: Item = .{ .bytes = bytes2[0..8] };
    try map.add(item2);
    const result6 = map.find(bytes2);
    try expectEqual(.smaller, result6.match_type);
    try expectEqual(2, result6.index);

    const item3: Item = .{ .bytes = bytes2[4..8] };
    try map.add(item3);
    const result7 = map.find(bytes2[4..8]);
    try expectEqual(.exact, result7.match_type);
    try expectEqual(2, result7.index);

    const item4: Item = .{ .bytes = bytes2 };
    try map.add(item4);
    const result8 = map.find(bytes2);
    try expectEqual(.exact, result8.match_type);
    try expectEqual(2, result8.index);

    const result9 = map.find(bytes2[3..9]);
    try expectEqual(.larger, result9.match_type);
    try expectEqual(3, result9.index);

    const item5: Item = .{ .bytes = bytes2[3..9] };
    try map.add(item5);
    const result10 = map.find(bytes2[3..9]);
    try expectEqual(.exact, result10.match_type);
    try expectEqual(3, result10.index);
}
