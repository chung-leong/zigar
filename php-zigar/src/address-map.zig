const std = @import("std");

const php = @import("php.zig");

pub fn AddressMap(comptime T: type, comptime getAddress: fn (T) usize) type {
    return struct {
        list: std.ArrayList(T) = .empty,

        pub fn init() !*@This() {
            const self = try php.allocator.create(@This());
            self.* = .{};
            return self;
        }

        pub fn deinit(self: *@This()) void {
            self.list.deinit(php.allocator);
            php.allocator.destroy(self);
        }

        pub fn add(self: *@This(), value: T) !void {
            const address = getAddress(value);
            const index = findSortedIndex(T, &self.list, address);
            try self.list.insert(php.allocator, index, value);
        }

        pub fn remove(self: *@This(), value: T) !void {
            const address = getAddress(value);
            const index = findSortedIndex(T, &self.list, address, getAddress);
            if (index > 0) {
                if (getAddress(self.list.items[index - 1]) == address) {
                    try self.list.orderedRemove(index - 1);
                }
            }
        }

        pub fn find(self: *@This(), address: usize) ?*T {
            const index = findSortedIndex(T, &self.list, address, getAddress);
            if (index > 0) {
                const ptr = &self.list.items[index - 1];
                if (getAddress(ptr.*) == address) return ptr;
            }
        }
    };
}

pub fn findSortedIndex(comptime T: type, list: *std.ArrayList(T), address: usize, comptime getAddress: fn (T) usize) usize {
    var low: usize = 0;
    var high = list.items.len;
    if (high == 0) return 0;
    while (low < high) {
        const mid = (low + high) / 2;
        const mid_address = getAddress(list.items[mid]);
        if (mid_address <= address) low = mid + 1 else high = mid;
    }
    return high;
}
