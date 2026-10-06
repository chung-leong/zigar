const std = @import("std");

const php_ng = @import("php/root.zig");
const Array = php_ng.Array;
const Object = php_ng.Object;
const php_al = php_ng.php_al;
const Value = php_ng.Value;
const ZigClassEntry = @import("class-entry.zig").ZigClassEntry;

pub const empty: @This() = .{};
pub const debugging = false;

pub fn start(self: *@This(), obj: *Object) *@This() {
    const class = ZigClassEntry.fromObject(obj);
    if (debugging) {
        std.debug.print("getGarbageCollection: {}, object {d}, refcount = {d} ({})\n", .{
            class.type,
            obj.handle,
            obj.gc.refcount,
            Color.get(obj),
        });
    }
    self.list.clearRetainingCapacity();
    return self;
}

pub fn deinit(self: *@This()) void {
    self.list.deinit(php_al);
}

fn show(self: *@This(), value: Value) void {
    switch (value.kind()) {
        .object => {
            const obj = value.getObject() catch unreachable;
            std.debug.print("adding object {d}, refcount = {d}, ({})\n", .{
                obj.handle,
                obj.gc.refcount,
                Color.get(obj),
            });
        },
        .array => {
            const arr = value.getArray() catch unreachable;
            var iter = arr.iterate(.{});
            std.debug.print("adding array, refcount = {d}, ({})\n", .{
                arr.gc.refcount,
                Color.get(arr),
            });
            while (iter.next()) |e| {
                self.show(e);
            }
        },
        else => {},
    }
}

pub fn add(self: *@This(), value: Value) !void {
    if (debugging) self.show(value);
    try self.list.append(php_al, value);
}

pub fn addObject(self: *@This(), obj: *Object) !void {
    try self.add(.fromObject(obj));
}

pub fn addArray(self: *@This(), arr: *Array) !void {
    try self.add(.fromArray(arr));
}

pub fn use(self: *@This(), table: *[*c]Value, n: *c_int) void {
    table.* = self.list.items.ptr;
    n.* = @intCast(self.list.items.len);
}

pub const Color = enum(u2) {
    black,
    white,
    grey,
    purple,

    pub fn get(obj: anytype) @This() {
        return @enumFromInt(obj.gc.u.type_info >> 30);
    }
};

list: std.ArrayList(Value) = .empty,
