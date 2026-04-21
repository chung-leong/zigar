const std = @import("std");

const php = @import("php.zig");
const GarbageCollectionColor = php.GarbageCollectionColor;
const HashTable = php.HashTable;
const HashTableIterator = php.HashTableIterator;
const Object = php.Object;
const Value = php.Value;
const ZigClassEntry = @import("class-entry.zig").ZigClassEntry;

pub const GarbageCollectionBuffer = struct {
    list: std.ArrayList(Value) = .empty,

    pub const empty: @This() = .{};
    pub const debugging = false;

    pub fn start(self: *@This(), obj: *Object) *@This() {
        const class = ZigClassEntry.fromObject(obj);
        if (debugging) {
            std.debug.print("getGarbageCollection: {}, object {d}, refcount = {d} ({})\n", .{
                class.type,
                obj.handle,
                obj.gc.refcount,
                php.GarbageCollectionColor.get(obj),
            });
        }
        self.list.clearRetainingCapacity();
        return self;
    }

    pub fn deinit(self: *@This()) void {
        self.list.deinit(php.allocator);
    }

    fn show(self: *@This(), value: *const Value) void {
        switch (php.getValueType(value)) {
            .object => {
                const obj = php.getValueObject(value) catch unreachable;
                std.debug.print("adding object {d}, refcount = {d}, ({})\n", .{
                    obj.handle,
                    obj.gc.refcount,
                    php.GarbageCollectionColor.get(obj),
                });
            },
            .array => {
                const ht = php.getValueArray(value) catch unreachable;
                var iter: HashTableIterator = .init(ht, .{});
                std.debug.print("adding array, refcount = {d}, ({})\n", .{
                    ht.gc.refcount,
                    php.GarbageCollectionColor.get(ht),
                });
                while (iter.next()) |e| {
                    self.show(e);
                }
            },
            else => {},
        }
    }

    pub fn add(self: *@This(), value: *const Value) !void {
        if (debugging) self.show(value);
        try self.list.append(php.allocator, value.*);
    }

    pub fn addObject(self: *@This(), obj: *Object) !void {
        const value = php.createValueObject(obj);
        try self.add(&value);
    }

    pub fn use(self: *@This(), table: *[*c]Value, n: *c_int) void {
        table.* = self.list.items.ptr;
        n.* = @intCast(self.list.items.len);
    }
};
