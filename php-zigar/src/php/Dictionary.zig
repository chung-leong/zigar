pub const std = @import("std");

pub const Iterator = @import("Dictionary/Iterator.zig");
const php = @import("root.zig");
const Array = php.Array;
const Object = php.Object;
const String = php.String;
const Value = php.Value;

pub const @"union" = union(enum) {
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

    array: *Array,
    object: *Object,
};
