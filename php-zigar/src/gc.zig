const std = @import("std");

const php = @import("php.zig");
const GarbageCollectionColor = php.GarbageCollectionColor;
const HashTableIterator = php.HashTableIterator;
const Object = php.Object;
const Value = php.Value;

pub const GarbageCollectionBuffer = struct {
    list: std.ArrayList(Value) = .empty,

    pub const empty: @This() = .{};

    pub fn reset(self: *@This()) void {
        self.list.clearRetainingCapacity();
    }

    pub fn deinit(self: *@This()) void {
        self.list.deinit(php.allocator);
    }

    pub fn add(self: *@This(), arg: anytype) !void {
        if (@typeInfo(@TypeOf(arg)) != .pointer) @compileError("Pointer required");
        const T = @TypeOf(arg.*);
        switch (T) {
            Value => switch (php.getValueType(arg)) {
                .object => {
                    const obj = php.getValueObject(arg) catch unreachable;
                    try self.add(obj);
                },
                .array => {
                    var iter: HashTableIterator = .init(arg.value.arr, .{});
                    while (iter.next()) |value| {
                        try self.add(value);
                    }
                },
                else => {},
            },
            ?Value => if (arg.*) |*v| try self.add(v),
            Object => {
                // std.debug.print("adding object {d}, refcount = {d}, ({})\n", .{
                //     arg.handle,
                //     arg.gc.refcount,
                //     php.GarbageCollectionColor.get(arg),
                // });
                const value = php.createValueObject(arg);
                try self.list.append(php.allocator, value);
            },
            else => @compileError("Unrecognized type: " ++ @typeName(T)),
        }
    }

    pub fn use(self: *@This(), table: *[*c]Value, n: *c_int) void {
        table.* = self.list.items.ptr;
        n.* = @intCast(self.list.items.len);
    }
};
