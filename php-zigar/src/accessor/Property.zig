const std = @import("std");

const accessor = @import("../accessor.zig");
const ZigClassEntry = @import("../class-entry.zig").ZigClassEntry;
const Error = @import("../failure.zig").Error;
const php_ng = @import("../php/root.zig");
const Object = php_ng.Object;
const String = php_ng.String;
const Value = php_ng.Value;

pub fn get(self: @This(), obj: *Object) Error!Value {
    const container_value: Value = .fromObject(obj);
    const method_name = self.getter orelse return error.WriteOnly;
    const method_value = .fromString(method_name);
    return try php.invokeMethod(&container_value, &method_value, &.{});
}

pub fn set(self: @This(), obj: *Object, value: Value) Error!void {
    const container_value: Value = .fromObject(obj);
    const method_name = self.setter orelse return error.WriteProtected;
    const method_value = .fromString(method_name);
    _ = try php.invokeMethod(&container_value, &method_value, &.{value.*});
}

const Attributes = struct {};

getter: ?*String = null,
setter: ?*String = null,
comptime type: accessor.Type = .property,
comptime attributes: Attributes = .{},
