const std = @import("std");

const accessor = @import("../accessor.zig");
const ByteBuffer = @import("../buffer.zig").ByteBuffer;
const Error = @import("../failure.zig").Error;
const php_ng = @import("../php/root.zig");
const Value = php_ng.Value;

pub fn get(_: @This()) Error!Value {
    return .fromNull();
}

pub fn set(_: @This(), value: Value) Error!void {
    try .getNull(value);
}

pub fn getElement(self: @This(), _: usize) Error!Value {
    return self.get();
}

pub fn setElement(self: @This(), _: usize, value: Value) Error!void {
    return self.set(value);
}

const Attributes = struct {};

comptime type: accessor.Type = .null,
comptime attributes: Attributes = .{},
