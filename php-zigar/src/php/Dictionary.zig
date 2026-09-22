pub const std = @import("std");

const php = @import("root.zig");
const Array = php.Array;
const Object = php.Object;
const String = php.String;
const Value = php.Value;

pub const Dictionary = union(enum) {
    pub fn addRef(self: *@This()) void {
        return switch (self) {
            .array => |a| a.addRef(),
            .object => |o| o.addRef(),
        };
    }

    pub fn release(self: *@This()) void {
        return switch (self) {
            .array => |a| a.release(),
            .object => |o| o.release(),
        };
    }

    pub fn has(self: @This(), key: anytype) bool {
        return if (self.get(key)) |_| true else |_| false;
    }

    pub fn get(self: @This(), key: anytype) !Value {
        return switch (self) {
            .array => |a| try a.get(key),
            .object => |o| try o.getProperty(key),
        };
    }

    pub fn iterate(self: @This(), options: Iterator.Options) !Iterator {
        return .init(self, options);
    }

    pub fn toValue(self: @This()) Value {
        return switch (self) {
            .array => |a| a.toValue(),
            .object => |o| o.toValue(),
        };
    }

    pub const Iterator = struct {
        pub fn init(dict: Dictionary, options: Options) !@This() {
            const arr, const props = switch (dict) {
                .array => |a| .{ a, null },
                .object => |o| get: {
                    const p = o.getProperties();
                    break :get .{ p, p };
                },
            };
            return .{
                .array_iter = arr.iterate(options),
                .object_props = props,
            };
        }

        pub fn deinit(self: *@This()) void {
            if (self.object_props) |props| props.release();
        }

        pub fn next(self: *@This()) ?Value {
            return self.array_iter.next();
        }

        pub fn name(self: *@This()) *String {
            const key = self.array_iter.key();
            std.debug.assert(key.kind() == .string);
            return key.string();
        }

        pub const Options = Array.Iterator.Options;

        array_iter: Array.Iterator,
        object_props: ?*Array,
    };

    array: *Array,
    object: *Object,
};
