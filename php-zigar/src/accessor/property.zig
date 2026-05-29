const std = @import("std");

const accessor = @import("../accessor.zig");
const ZigClassEntry = @import("../class-entry.zig").ZigClassEntry;
const Error = @import("../failure.zig").Error;
const php = @import("../php.zig");
const Object = php.Object;
const String = php.String;
const Value = php.Value;

const Attributes = struct {};

pub const Property = struct {
    getter: ?*String = null,
    setter: ?*String = null,
    comptime type: accessor.Type = .property,
    comptime attributes: Attributes = .{},

    pub fn get(self: @This(), obj: *Object) Error!Value {
        const container_value = php.createValueObject(obj);
        const method_name = self.getter orelse return error.WriteOnly;
        const method_value = php.createValueString(method_name);
        return try php.invokeMethod(&container_value, &method_value, &.{});
    }

    pub fn set(self: @This(), obj: *Object, value: *const Value) Error!void {
        const container_value = php.createValueObject(obj);
        const method_name = self.setter orelse return error.WriteProtected;
        const method_value = php.createValueString(method_name);
        _ = try php.invokeMethod(&container_value, &method_value, &.{value.*});
    }
};
