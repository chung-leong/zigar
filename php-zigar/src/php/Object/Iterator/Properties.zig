const std = @import("std");

const php = @import("../../root.zig");
const Object = php.Object;
const String = php.String;
const Value = php.Value;

pub fn @"fn"(comptime T: type, comptime getter_names: []const u8) type {
    return struct {
        pub fn init(object: *Object) @This() {
            return .{ .object = object.retain() };
        }

        pub fn deinit(self: *@This()) void {
            self.release();
        }

        pub fn next(self: *@This()) !?@Tuple(&.{ *String, Value }) {
            if (self.index >= getter_names.len) return null;
            const custom = self.object.toCustom(T);
            const get = @field(T, "get " ++ getter_names[self.index]);
            const payload = try get(custom);
            return .fromAny(payload);
        }

        pub fn reset(self: *@This()) void {
            self.index = 0;
        }

        object: *Object,
        index: usize = 0,
    };
}
